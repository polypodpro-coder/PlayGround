import { randomUUID } from 'node:crypto';
import { fail } from './security.mjs';

export const CREATION_LIBRARY_LIMIT = 100;

const META = 'c.id,c.owner_id,c.title,c.file_name,c.source,c.source_units,c.sha256,c.byte_length,c.triangle_count,c.created_at';
const OFFER = `CASE WHEN o.share_id IS NULL THEN NULL ELSE jsonb_build_object(
  'productionCents',o.production_cents,'fulfillmentCents',o.fulfillment_cents,
  'leadDays',o.lead_days,'notes',o.notes) END`;
const SHARED = `sh.id,sh.creation_id,sh.seller_id,s.legal_name AS seller_name,sh.notes,
  sh.target_height_mm,sh.created_at,sh.consent_at,sh.request_version,${OFFER} AS offer`;
const SHARE_JOINS = `FROM creation_shares sh JOIN sellers s ON s.id=sh.seller_id
  LEFT JOIN creation_offers o ON o.share_id=sh.id AND o.request_version=sh.request_version`;
const ACCESS = `c.id=$1 AND (c.owner_id=$2 OR EXISTS(
  SELECT 1 FROM creation_shares access_share
  JOIN sellers access_seller ON access_seller.id=access_share.seller_id
  JOIN seller_members access_member ON access_member.seller_id=access_seller.id
  WHERE access_share.creation_id=c.id AND access_share.revoked_at IS NULL
    AND access_seller.status='approved' AND access_seller.country='US' AND access_member.user_id=$2))`;

async function transaction(pool, work) {
  const client = await pool.connect();
  try { await client.query('BEGIN'); const result = await work(client); await client.query('COMMIT'); return result; }
  catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
async function shareRow(client, id) {
  const result = await client.query(`SELECT ${SHARED} ${SHARE_JOINS} WHERE sh.id=$1`, [id]);
  return result.rows[0];
}
export class CreationRepository {
  constructor(pool) { this.pool = pool; }
  async create(input, dailyLimit) {
    return transaction(this.pool, async client => {
      // Serializes all of one user's imports across API processes and restarts.
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['creation-import:' + input.userId]);
      const total = await client.query('SELECT count(*)::int AS count FROM creations WHERE owner_id=$1', [input.userId]);
      if (total.rows[0].count >= CREATION_LIBRARY_LIMIT) {
        fail(409, 'creation_library_limit', 'Your private library has reached its 100-model limit. New imports are paused.');
      }
      const count = await client.query(`SELECT count(*)::int AS count FROM creations
        WHERE owner_id=$1 AND created_at >= (date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')`, [input.userId]);
      if (count.rows[0].count >= dailyLimit) fail(429, 'creation_daily_limit', 'Your daily model import limit has been reached. Try again tomorrow.');
      const result = await client.query(`INSERT INTO creations(
        id,owner_id,title,file_name,source,source_units,notes,model_bytes,sha256,byte_length,triangle_count,consent_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,now()) RETURNING
        id,owner_id,title,file_name,source,source_units,sha256,byte_length,triangle_count,created_at`,
      [input.id,input.userId,input.title,input.fileName,input.source,input.sourceUnits,input.notes,
        input.bytes,input.sha256,input.bytes.length,input.triangleCount]);
      return result.rows[0];
    });
  }
  async list(userId) {
    const result = await this.pool.query(`SELECT ${META} FROM creations c WHERE c.owner_id=$1 ORDER BY c.created_at DESC LIMIT 100`, [userId]);
    if (!result.rows.length) return [];
    const shares = await this.pool.query(`SELECT ${SHARED} ${SHARE_JOINS}
      JOIN creations c ON c.id=sh.creation_id
      WHERE c.owner_id=$1 AND sh.creation_id=ANY($2::uuid[]) AND sh.revoked_at IS NULL ORDER BY sh.created_at DESC`,
    [userId,result.rows.map(row => row.id)]);
    const grouped = new Map();
    for (const share of shares.rows) {
      const values = grouped.get(share.creation_id) || []; values.push(share); grouped.set(share.creation_id,values);
    }
    return result.rows.map(row => ({ ...row, shares: grouped.get(row.id) || [] }));
  }
  async get(id, userId) {
    const result = await this.pool.query(`SELECT ${META} FROM creations c WHERE ${ACCESS}`, [id,userId]);
    return result.rows[0] || null;
  }
  async model(id, userId) {
    const result = await this.pool.query(`SELECT c.model_bytes,c.file_name,c.sha256 FROM creations c WHERE ${ACCESS}`, [id,userId]);
    return result.rows[0] || null;
  }
  async shares(creationId, userId) {
    const result = await this.pool.query(`SELECT ${SHARED} ${SHARE_JOINS}
      JOIN creations c ON c.id=sh.creation_id
      WHERE sh.creation_id=$1 AND c.owner_id=$2 AND sh.revoked_at IS NULL ORDER BY sh.created_at DESC`, [creationId,userId]);
    return result.rows;
  }
  async farms() {
    const result = await this.pool.query("SELECT id,legal_name FROM sellers WHERE status='approved' AND country='US' ORDER BY legal_name LIMIT 1000");
    return result.rows;
  }
  async share(input, maximum) {
    return transaction(this.pool, async client => {
      const creation = await client.query('SELECT id FROM creations WHERE id=$1 AND owner_id=$2 FOR UPDATE', [input.creationId,input.userId]);
      if (!creation.rows[0]) fail(404, 'creation_not_found', 'Model not found.');
      const seller = await client.query("SELECT id FROM sellers WHERE id=$1 AND status='approved' AND country='US' FOR SHARE", [input.sellerId]);
      if (!seller.rows[0]) fail(404, 'creation_seller_unavailable', 'This farm is not available for private requests.');
      const existingResult = await client.query('SELECT * FROM creation_shares WHERE creation_id=$1 AND seller_id=$2 FOR UPDATE', [input.creationId,input.sellerId]);
      const existing = existingResult.rows[0];
      if (!existing || existing.revoked_at) {
        const count = await client.query('SELECT count(*)::int AS count FROM creation_shares WHERE creation_id=$1 AND revoked_at IS NULL', [input.creationId]);
        if (count.rows[0].count >= maximum) fail(409, 'creation_share_limit', 'A model can be actively shared with at most 10 farms. Revoke an existing share first.');
      }
      if (existing && !existing.revoked_at && existing.notes === input.notes && existing.target_height_mm === input.targetHeightMm) {
        return shareRow(client, existing.id);
      }
      let id = existing?.id;
      if (existing) {
        // Any changed instructions or regrant invalidate offers for the old request revision.
        await client.query(`UPDATE creation_shares SET notes=$2,target_height_mm=$3,consent_at=now(),revoked_at=NULL,
          request_version=request_version+1 WHERE id=$1`, [id,input.notes,input.targetHeightMm]);
      } else {
        id = randomUUID();
        await client.query(`INSERT INTO creation_shares(id,creation_id,seller_id,notes,target_height_mm,consent_at)
          VALUES($1,$2,$3,$4,$5,now())`, [id,input.creationId,input.sellerId,input.notes,input.targetHeightMm]);
      }
      return shareRow(client, id);
    });
  }
  async inbox(userId) {
    const result = await this.pool.query(`SELECT ${SHARED},u.name AS buyer_label,
      jsonb_build_object('id',c.id,'title',c.title,'file_name',c.file_name,'source',c.source,
        'source_units',c.source_units,'sha256',c.sha256,'byte_length',c.byte_length,
        'triangle_count',c.triangle_count,'created_at',c.created_at) AS creation
      ${SHARE_JOINS} JOIN creations c ON c.id=sh.creation_id JOIN app_users u ON u.id=c.owner_id
      JOIN seller_members m ON m.seller_id=s.id
      WHERE m.user_id=$1 AND s.status='approved' AND s.country='US' AND sh.revoked_at IS NULL
      ORDER BY sh.created_at DESC`, [userId]);
    return result.rows;
  }
  async respond(input) {
    return transaction(this.pool, async client => {
      const access = await client.query(`SELECT sh.id,sh.request_version FROM creation_shares sh
        JOIN sellers s ON s.id=sh.seller_id JOIN seller_members m ON m.seller_id=s.id
        WHERE sh.id=$1 AND m.user_id=$2 AND sh.revoked_at IS NULL AND s.status='approved' AND s.country='US'
        FOR UPDATE OF sh FOR SHARE OF s,m`, [input.shareId,input.userId]);
      if (!access.rows[0]) fail(404, 'creation_share_not_found', 'Shared request not found.');
      if (access.rows[0].request_version !== input.requestVersion) {
        fail(409, 'creation_request_changed', 'The buyer changed this request. Refresh its instructions before preparing a new estimate.');
      }
      const result = await client.query(`INSERT INTO creation_offers(
        share_id,request_version,author_id,production_cents,fulfillment_cents,lead_days,notes)
        VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(share_id,request_version) DO UPDATE SET
        author_id=excluded.author_id,production_cents=excluded.production_cents,
        fulfillment_cents=excluded.fulfillment_cents,lead_days=excluded.lead_days,notes=excluded.notes,updated_at=now()
        RETURNING production_cents,fulfillment_cents,lead_days,notes`,
      [input.shareId,access.rows[0].request_version,input.userId,input.productionCents,input.fulfillmentCents,input.leadDays,input.notes]);
      return result.rows[0];
    });
  }
  async revoke(shareId, userId) {
    const result = await this.pool.query(`UPDATE creation_shares sh SET
      revoked_at=COALESCE(sh.revoked_at,now()),
      request_version=CASE WHEN sh.revoked_at IS NULL THEN sh.request_version+1 ELSE sh.request_version END
      WHERE sh.id=$1 AND EXISTS(SELECT 1 FROM creations c WHERE c.id=sh.creation_id AND c.owner_id=$2)
      RETURNING sh.id`, [shareId,userId]);
    return result.rowCount > 0;
  }
}



