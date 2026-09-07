import { createHash, randomUUID } from 'node:crypto';
import { fail } from './security.mjs';

export const MAX_CREATION_BYTES = 10 * 1024 * 1024;
export const MAX_CREATION_TRIANGLES = 150000;
export const CREATION_IMPORT_DAILY_LIMIT = 5;
export const MAX_CREATION_SHARES = 10;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const NUMBER = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i;

function uuid(value) {
  if (typeof value !== 'string' || !UUID.test(value)) fail(400, 'invalid_id', 'A valid record identifier is required.');
  return value;
}
function text(value, name, max, required = false) {
  if (value === undefined && !required) return '';
  // oxlint-disable-next-line eslint/no-control-regex -- Reject non-printable control bytes in user text.
  if (typeof value !== 'string' || value.length > max || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value)) {
    fail(400, 'invalid_creation', name + ' is invalid or too long.');
  }
  const result = value.trim();
  if (required && !result) fail(400, 'invalid_creation', name + ' is required.');
  return result;
}
function bodyFields(body, allowed) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !allowed.includes(key))) {
    fail(400, 'invalid_creation', 'This request contains unsupported fields.');
  }
}
function finiteCoordinates(values) {
  if (values.some(value => !Number.isFinite(value) || Math.abs(value) >= 1000000)) {
    fail(400, 'invalid_stl', 'The STL contains non-finite or extreme coordinates. Check its units and export it again.');
  }
}
export function validateCreationSTL(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 1 || bytes.length > MAX_CREATION_BYTES) {
    fail(400, 'invalid_stl', 'Choose a complete STL file no larger than 10 MB.');
  }
  if (bytes.length >= 84) {
    const count = bytes.readUInt32LE(80);
    if (84 + count * 50 === bytes.length) {
      if (!count || count > MAX_CREATION_TRIANGLES) fail(400, 'invalid_stl', 'Use an STL containing 1–150,000 triangles.');
      for (let triangle = 0; triangle < count; triangle++) {
        const start = 84 + triangle * 50;
        for (let component = 0; component < 12; component++) finiteCoordinates([bytes.readFloatLE(start + component * 4)]);
      }
      return count;
    }
  }
  // Strict ASCII grammar avoids accepting partial facets or non-numeric vertices.
  const source = bytes.toString('utf8');
  // oxlint-disable-next-line eslint/no-control-regex -- ASCII STL permits only printable bytes and whitespace.
  if (/[^\x09\x0a\x0d\x20-\x7e]/.test(source)) fail(400, 'invalid_stl', 'The STL is incomplete or has an invalid binary length.');
  const lines = source.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  if (!/^solid(?:\s|$)/i.test(lines[0] || '') || !/^endsolid(?:\s|$)/i.test(lines.at(-1) || '')) {
    fail(400, 'invalid_stl', 'Export a complete ASCII or binary STL file.');
  }
  let cursor = 1, count = 0;
  const vector = (line, prefix) => {
    const parts = (line || '').split(/\s+/);
    if (parts.length !== prefix.length + 3 || prefix.some((word, index) => parts[index]?.toLowerCase() !== word) ||
        parts.slice(prefix.length).some(value => !NUMBER.test(value))) {
      fail(400, 'invalid_stl', 'The STL contains incomplete or invalid triangles.');
    }
    finiteCoordinates(parts.slice(prefix.length).map(Number));
  };
  while (cursor < lines.length - 1) {
    vector(lines[cursor++], ['facet', 'normal']);
    if (!/^outer\s+loop$/i.test(lines[cursor++] || '')) fail(400, 'invalid_stl', 'The STL contains an incomplete triangle loop.');
    for (let i = 0; i < 3; i++) vector(lines[cursor++], ['vertex']);
    if (lines[cursor++]?.toLowerCase() !== 'endloop' || lines[cursor++]?.toLowerCase() !== 'endfacet') {
      fail(400, 'invalid_stl', 'The STL contains an incomplete triangle.');
    }
    if (++count > MAX_CREATION_TRIANGLES) fail(400, 'invalid_stl', 'Use an STL containing 1–150,000 triangles.');
  }
  if (!count || cursor !== lines.length - 1) fail(400, 'invalid_stl', 'The STL contains incomplete triangles.');
  return count;
}
export function decodeCreationModel(value) {
  if (typeof value !== 'string' || !value || value.length > Math.ceil(MAX_CREATION_BYTES / 3) * 4) {
    fail(413, 'model_too_large', 'Choose an STL file no larger than 10 MB.');
  }
  if (value.length % 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) fail(400, 'invalid_stl', 'The model must be a base64-encoded STL file.');
  const bytes = Buffer.from(value, 'base64');
  if (bytes.toString('base64') !== value || bytes.length > MAX_CREATION_BYTES) fail(400, 'invalid_stl', 'The model encoding is invalid.');
  const triangleCount = validateCreationSTL(bytes);
  return { bytes, triangleCount, sha256: createHash('sha256').update(bytes).digest('hex') };
}
function filename(title, id) {
  const safeTitle = title.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 72);
  return (safeTitle || 'model') + '-' + id.slice(0, 8) + '.stl';
}
function offer(row) {
  if (!row) return null;
  return {
    productionCents: row.productionCents ?? row.production_cents,
    fulfillmentCents: row.fulfillmentCents ?? row.fulfillment_cents,
    leadDays: row.leadDays ?? row.lead_days, notes: row.notes || '',
    nonbinding: true,
  };
}
function shareView(row) {
  return {
    id: row.id, creationId: row.creation_id, sellerId: row.seller_id, sellerName: row.seller_name,
    notes: row.notes || '', targetHeightMm: row.target_height_mm ?? null,
    createdAt: row.created_at, offer: offer(row.offer), consentAt: row.consent_at, requestVersion: row.request_version,
  };
}
function creationView(row, shares = []) {
  return {
    id: row.id, title: row.title, fileName: row.file_name, source: row.source,
    sourceUnits: row.source_units, sha256: row.sha256, byteLength: row.byte_length,
    triangleCount: row.triangle_count, createdAt: row.created_at, shares: shares.map(shareView),
  };
}
export class CreationService {
  constructor({ repository, config = {} }) { this.repository = repository; this.config = config; }
  enabled() {
    if (this.config.creationSharingEnabled !== true) fail(503, 'creation_sharing_unavailable', 'Private model imports and sharing are not open yet.');
  }
  async create(userId, body) {
    uuid(userId); this.enabled();
    bodyFields(body, ['modelBase64', 'title', 'source', 'sourceUnits', 'notes', 'consent']);
    if (body.consent !== true || body.source !== 'meshy' || !['mm', 'cm', 'in'].includes(body.sourceUnits)) {
      fail(400, 'model_review_required', 'Confirm your rights to this Meshy-exported model and choose its source units.');
    }
    const title = text(body.title, 'Title', 120, true), notes = text(body.notes, 'Notes', 2000);
    const model = decodeCreationModel(body.modelBase64), id = randomUUID();
    const row = await this.repository.create({
      id, userId, title, notes, source: 'meshy', sourceUnits: body.sourceUnits,
      fileName: filename(title, id), ...model,
    }, CREATION_IMPORT_DAILY_LIMIT);
    return creationView(row);
  }
  async list(userId) {
    uuid(userId);
    return (await this.repository.list(userId)).map(row => creationView(row, row.shares || []));
  }
  async get(id, userId) {
    uuid(id); uuid(userId);
    const row = await this.repository.get(id, userId);
    if (!row) fail(404, 'creation_not_found', 'Model not found.');
    const shares = row.owner_id === userId ? await this.repository.shares(id, userId) : [];
    return creationView(row, shares);
  }
  async model(id, userId) {
    uuid(id); uuid(userId);
    const row = await this.repository.model(id, userId);
    if (!row) fail(404, 'creation_not_found', 'Model not found.');
    if (!Buffer.isBuffer(row.model_bytes) || row.model_bytes.length > MAX_CREATION_BYTES ||
        createHash('sha256').update(row.model_bytes).digest('hex') !== row.sha256) {
      fail(503, 'model_integrity_failed', 'This stored model needs integrity review before download.');
    }
    return { bytes: row.model_bytes, filename: row.file_name, sha256: row.sha256 };
  }
  async share(id, userId, body) {
    uuid(id); uuid(userId); this.enabled();
    bodyFields(body, ['sellerId', 'notes', 'targetHeightMm', 'consent']);
    if (body.consent !== true) fail(400, 'sharing_consent_required', 'Confirm sharing this model and its notes with the selected farm.');
    uuid(body.sellerId);
    const notes = text(body.notes, 'Notes', 2000);
    const targetHeightMm = body.targetHeightMm ?? null;
    if (targetHeightMm !== null && (typeof targetHeightMm !== 'number' || !Number.isFinite(targetHeightMm) || targetHeightMm <= 0 || targetHeightMm > 2000)) {
      fail(400, 'invalid_target_height', 'Requested height must be greater than zero and no more than 2,000 mm.');
    }
    return shareView(await this.repository.share({ creationId: id, userId, sellerId: body.sellerId, notes, targetHeightMm }, MAX_CREATION_SHARES));
  }
  async inbox(userId) {
    uuid(userId);
    return (await this.repository.inbox(userId)).map(row => ({
      ...shareView(row), buyerLabel: row.buyer_label || 'Buyer',
      creation: creationView(row.creation),
    }));
  }
  async farms(userId) {
    uuid(userId);
    return (await this.repository.farms()).map(row => ({ id: row.id, name: row.legal_name }));
  }
  async respond(shareId, userId, body) {
    uuid(shareId); uuid(userId); this.enabled();
    bodyFields(body, ['productionCents', 'fulfillmentCents', 'leadDays', 'notes', 'requestVersion']);
    if (!Number.isInteger(body.requestVersion) || body.requestVersion < 1 || body.requestVersion > 2147483647) {
      fail(400, 'invalid_request_version', 'Refresh the shared request before preparing an estimate.');
    }
    if (!Number.isSafeInteger(body.productionCents) || body.productionCents < 1 || body.productionCents > 10000000 ||
        !Number.isSafeInteger(body.fulfillmentCents) || body.fulfillmentCents < 0 || body.fulfillmentCents > 100000 ||
        !Number.isSafeInteger(body.leadDays) || body.leadDays < 1 || body.leadDays > 90) {
      fail(400, 'invalid_creation_offer', 'Use valid integer-cent amounts and a lead time of 1–90 days.');
    }
    const row = await this.repository.respond({
      shareId, userId, requestVersion: body.requestVersion, productionCents: body.productionCents, fulfillmentCents: body.fulfillmentCents,
      leadDays: body.leadDays, notes: text(body.notes, 'Notes', 2000),
    });
    return { ...offer(row), shareId, requestVersion: body.requestVersion };
  }
  async revoke(shareId, userId) {
    uuid(shareId); uuid(userId);
    if (!(await this.repository.revoke(shareId, userId))) fail(404, 'creation_share_not_found', 'Shared request not found.');
    return { id: shareId, revoked: true };
  }
}



