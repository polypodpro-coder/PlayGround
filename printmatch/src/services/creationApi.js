import { API_ENABLED } from '../config/runtime';
import { MAX_STL_BYTES } from '../lib/stlValidation';

async function request(path, { method = 'GET', body, csrfToken, binary = false } = {}) {
  if (!API_ENABLED) throw new Error('Private sharing is not connected in this preview.');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  try {
    const response = await fetch(path, {
      method, credentials: 'same-origin', signal: controller.signal,
      headers: { Accept: binary ? 'application/octet-stream' : 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!response.ok) {
      const result = response.headers.get('content-type')?.includes('application/json') ? await response.json() : null;
      throw new Error(result?.error?.message || 'Private creation service is unavailable.');
    }
    if (!binary) {
      if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('Private sharing is not configured on this host.');
      return response.json();
    }
    if (!response.headers.get('content-type')?.match(/application\/octet-stream|model\/stl/)) throw new Error('The model download is unavailable.');
    if (Number(response.headers.get('content-length')) > MAX_STL_BYTES) throw new Error('The model exceeds the 10 MB limit.');
    const reader = response.body.getReader(); const chunks = []; let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        size += value.byteLength;
        if (size > MAX_STL_BYTES) { await reader.cancel(); throw new Error('The model exceeds the 10 MB limit.'); }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    return new Blob(chunks, { type: 'model/stl' });
  } finally { clearTimeout(timeout); }
}

export async function encodeModel(file) {
  if (!file?.size || file.size > MAX_STL_BYTES) throw new Error('Choose a non-empty STL up to 10 MB.');
  const bytes = new Uint8Array(await file.arrayBuffer()); let binary = '';
  for (let i = 0; i < bytes.length; i += 32768) binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
  return btoa(binary);
}

const id = value => encodeURIComponent(value);
export const creationApi = {
  status: () => request('/api/creation-status'),
  list: () => request('/api/creations'),
  farms: () => request('/api/creation-farms'),
  inbox: () => request('/api/creation-inbox'),
  create: (body, csrfToken) => request('/api/creations', { method: 'POST', body, csrfToken }),
  share: (creationId, body, csrfToken) => request(`/api/creations/${id(creationId)}/shares`, { method: 'POST', body, csrfToken }),
  respond: (shareId, body, csrfToken) => request(`/api/creation-shares/${id(shareId)}/quote`, { method: 'POST', body, csrfToken }),
  revoke: (shareId, csrfToken) => request(`/api/creation-shares/${id(shareId)}`, { method: 'DELETE', csrfToken }),
  model: creationId => request(`/api/creations/${id(creationId)}/model`, { binary: true }),
};
