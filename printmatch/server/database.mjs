import { randomUUID, createHash, createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { fail } from './security.mjs';

const orderView = row => row && ({
  id: row.id, sellerName: row.legal_name, totalCents: row.total_cents, currency: row.currency,
  paymentState: row.payment_state, fulfillmentState: row.fulfillment_state, createdAt: row.created_at,
});
const reservedOrder = row => ({
  id: row.id, quoteId: row.quote_id, quoteVersion: row.quote_version, buyerId: row.buyer_id,
  sellerId: row.seller_id, sellerAccountId: row.seller_account_id, snapshot: row.snapshot,
  totalCents: row.total_cents, currency: row.currency, providerKey: row.provider_key,
  sessionId: row.checkout_session_id, sessionExpiresAt: new Date(row.checkout_expires_at).getTime(),
  paymentIntentId: row.payment_intent_id, paymentState: row.payment_state,
  createdAt: new Date(row.created_at).getTime(),
});
async function transaction(pool, action) {
  const client = await pool.connect();
  try { await client.query('BEGIN'); const result = await action(client); await client.query('COMMIT'); return result; }
  catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
export class Repository {
  constructor(pool) { this.pool = pool; }
  async principal(claims) {
    if (typeof claims?.sub !== 'string' || !claims.sub || claims.sub.length > 255) fail(401, 'invalid_identity', 'Please sign in again.');
    const result = await this.pool.query(
      `INSERT INTO app_users(id, auth_subject, name, email, email_verified) VALUES($1,$2,$3,$4,$5)
       ON CONFLICT(auth_subject) DO UPDATE SET name=excluded.name, email=excluded.email, email_verified=excluded.email_verified
       RETURNING id, name, email, email_verified, blocked_at`,
      [randomUUID(), claims.sub, String(claims.name || '').slice(0,200), String(claims.email || '').slice(0,320), claims.email_verified === true]);
    const user = result.rows[0];
    return { id:user.id, name:user.name, email:user.email, emailVerified:user.email_verified, blockedAt:user.blocked_at };
  }
  async listOrders(userId) {
    const result = await this.pool.query(
      `SELECT o.*, s.legal_name FROM orders o JOIN sellers s ON s.id=o.seller_id
       WHERE o.buyer_id=$1 OR EXISTS(SELECT 1 FROM seller_members m WHERE m.seller_id=o.seller_id AND m.user_id=$1)
       ORDER BY o.created_at DESC LIMIT 100`, [userId]);
    return result.rows.map(orderView);
  }
  async getOrder(id, userId) {
    const result = await this.pool.query(
      `SELECT o.*, s.legal_name FROM orders o JOIN sellers s ON s.id=o.seller_id WHERE o.id=$1
       AND (o.buyer_id=$2 OR EXISTS(SELECT 1 FROM seller_members m WHERE m.seller_id=o.seller_id AND m.user_id=$2))`, [id,userId]);
    return orderView(result.rows[0]);
  }
  async loadQuoteForBuyer(id, userId) {
    const result = await this.pool.query(
      `SELECT q.*, s.stripe_account_id, s.legal_name, s.status seller_status FROM quotes q
       JOIN sellers s ON s.id=q.seller_id WHERE q.id=$1 AND q.buyer_id=$2`, [id,userId]);
    const row = result.rows[0];
    if (!row) fail(404, 'quote_not_found', 'Quote not found.');
    if (row.seller_status !== 'approved') fail(409, 'seller_unavailable', 'This seller is not available for checkout.');
    return { ...row.data, id:row.id, buyerId:row.buyer_id, sellerId:row.seller_id, sellerAccountId:row.stripe_account_id,
      sellerName:row.legal_name, version:row.version, status:row.status, expiresAt:new Date(row.expires_at).getTime() };
  }
  async sellerForOwner(id, userId) {
    const result = await this.pool.query(
      `SELECT s.* FROM sellers s JOIN seller_members m ON m.seller_id=s.id
       WHERE s.id=$1 AND m.user_id=$2 AND m.role='owner' AND s.status <> 'suspended'`, [id,userId]);
    if (!result.rows[0]) fail(404, 'seller_not_found', 'Seller account not found.');
    return result.rows[0];
  }
  async reserveOrder(quote, prepared, now) {
    return transaction(this.pool, async client => {
      const current = await client.query('SELECT * FROM quotes WHERE id=$1 AND buyer_id=$2 FOR UPDATE', [quote.id,quote.buyerId]);
      const row = current.rows[0];
      if (!row || row.status !== 'accepted' || row.version !== quote.version || row.seller_id !== quote.sellerId || new Date(row.expires_at).getTime() <= now) {
        fail(409,'quote_changed','The accepted quote is no longer available.');
      }
      const seller = await client.query('SELECT stripe_account_id, status FROM sellers WHERE id=$1 FOR SHARE', [row.seller_id]);
      if (seller.rows[0]?.status !== 'approved' || seller.rows[0].stripe_account_id !== prepared.connectedAccountId) {
        fail(409,'seller_changed','The seller payment account changed. Review this quote before checkout.');
      }
      const existing = await client.query('SELECT * FROM orders WHERE quote_id=$1', [quote.id]);
      if (existing.rows[0]) return reservedOrder(existing.rows[0]);
      const expiresAt = Math.min(quote.expiresAt, now + 40 * 60 * 1000);
      if (expiresAt < now + 31 * 60 * 1000) fail(409,'quote_expiring','Ask the seller to renew this quote before checkout.');
      const id = randomUUID();
      const inserted = await client.query(
        `INSERT INTO orders(id,quote_id,buyer_id,seller_id,seller_account_id,quote_version,snapshot,total_cents,currency,provider_key,checkout_expires_at,created_at)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,'usd',$9,$10,$11) RETURNING *`,
        [id,quote.id,quote.buyerId,quote.sellerId,prepared.connectedAccountId,quote.version,JSON.stringify(quote),prepared.totalCents,
         'checkout:'+id,new Date(expiresAt),new Date(now)]);
      await client.query('INSERT INTO audit_events(action,actor_id,order_id) VALUES($1,$2,$3)', ['checkout_reserved',quote.buyerId,id]);
      return reservedOrder(inserted.rows[0]);
    });
  }
  async attachSession(orderId, sessionId) {
    const result = await this.pool.query(
      `UPDATE orders SET checkout_session_id=$2 WHERE id=$1 AND (checkout_session_id IS NULL OR checkout_session_id=$2) RETURNING id`, [orderId,sessionId]);
    if (!result.rowCount) fail(409,'checkout_conflict','Checkout needs reconciliation before another attempt.');
  }
  async applyEvent(event, selectTransition) {
    return transaction(this.pool, async client => {
      const inserted = await client.query(
        'INSERT INTO stripe_events(event_id,connected_account_id,event_type) VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING event_id',
        [event.id,event.account,event.type]);
      if (!inserted.rowCount) return { duplicate:true };
      const id = event.data.object.metadata?.orderId;
      const result = await client.query('SELECT * FROM orders WHERE id=$1 FOR UPDATE', [id]);
      if (!result.rows[0]) fail(409,'order_not_ready','Order has not been recorded yet; retry this event.');
      const order = reservedOrder(result.rows[0]);
      const transition = selectTransition(order);
      await client.query(
        `UPDATE orders SET payment_state=$2, payment_intent_id=COALESCE($3,payment_intent_id),
         checkout_session_id=COALESCE(checkout_session_id,$4), paid_at=CASE WHEN $2='paid' THEN COALESCE(paid_at,now()) ELSE paid_at END
         WHERE id=$1`, [order.id,transition.state,transition.paymentIntentId,event.data.object.id]);
      await client.query('INSERT INTO audit_events(action,order_id,provider_event_id) VALUES($1,$2,$3)',
        ['payment_'+transition.state,order.id,event.id]);
      return { duplicate:false };
    });
  }
}
// Encrypted server-side OIDC sessions. Browsers receive an SDK-signed random identifier.
export class PostgresSessionStore {
  constructor(pool, secret, { purpose='session', now=Date.now }={}) {
    if (!['session','logout'].includes(purpose)) throw new Error('Invalid session store purpose');
    this.pool=pool; this.purpose=purpose; this.now=now;
    this.key=createHash('sha256').update('polypod:sessions:'+secret).digest();
  }
  sessionKey(id) { return createHash('sha256').update(this.purpose+':'+id).digest('hex'); }
  encrypt(value) {
    const iv=randomBytes(12); const cipher=createCipheriv('aes-256-gcm',this.key,iv);
    const ciphertext=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);
    return Buffer.concat([iv,cipher.getAuthTag(),ciphertext]).toString('base64');
  }
  decrypt(value) {
    const bytes=Buffer.from(value,'base64'); const cipher=createDecipheriv('aes-256-gcm',this.key,bytes.subarray(0,12));
    cipher.setAuthTag(bytes.subarray(12,28));
    return JSON.parse(Buffer.concat([cipher.update(bytes.subarray(28)),cipher.final()]).toString('utf8'));
  }
  get(id, callback) {
    this.pool.query('SELECT encrypted_payload FROM auth_sessions WHERE session_key=$1 AND revoked_at IS NULL AND expires_at>now()', [this.sessionKey(id)])
      .then(result => callback(null,result.rows[0] ? this.decrypt(result.rows[0].encrypted_payload) : null)).catch(callback);
  }
  set(id, value, callback) {
    Promise.resolve().then(async()=>{
      // The SDK also checks its own expiry. Refuse invalid expiry and cap retention.
      const requestedExpiry=this.purpose==='session' ? Number(value?.header?.exp)*1000 : Number(value?.cookie?.expires);
      if (!Number.isFinite(requestedExpiry) || requestedExpiry<=this.now()) throw new Error('Session expiry is invalid');
      const expiresAt=new Date(Math.min(requestedExpiry,this.now()+8*60*60*1000));
      const result=await this.pool.query(
        `INSERT INTO auth_sessions(session_key,encrypted_payload,expires_at) VALUES($1,$2,$3)
         ON CONFLICT(session_key) DO UPDATE SET encrypted_payload=excluded.encrypted_payload,expires_at=excluded.expires_at
         WHERE auth_sessions.revoked_at IS NULL`,
        [this.sessionKey(id),this.encrypt(value),expiresAt]);
      // A request loaded before logout cannot recreate that session at response end.
      if (!result.rowCount) throw new Error('Session has been revoked');
    }).then(()=>callback?.()).catch(error=>callback?.(error));
  }
  destroy(id, callback) {
    // The SDK clears back-channel markers on login; isolate their lifecycle from
    // session tombstones so clearing a marker does not block a future logout event.
    const pending=this.purpose==='logout'
      ? this.pool.query('DELETE FROM auth_sessions WHERE session_key=$1',[this.sessionKey(id)])
      : this.pool.query(
        `INSERT INTO auth_sessions(session_key,encrypted_payload,expires_at,revoked_at) VALUES($1,$2,$3,now())
         ON CONFLICT(session_key) DO UPDATE SET encrypted_payload=excluded.encrypted_payload,
         expires_at=GREATEST(auth_sessions.expires_at,excluded.expires_at),revoked_at=now()`,
        [this.sessionKey(id),this.encrypt({}),new Date(this.now()+8*60*60*1000)]);
    pending.then(()=>callback?.()).catch(error=>callback?.(error));
  }
}

