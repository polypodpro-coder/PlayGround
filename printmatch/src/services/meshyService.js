// Meshy BYOK generation service.
//
// Generation is optional and buyer-owned: the browser talks to a user-deployed
// CORS proxy (see serverless-proxy.js) which forwards to Meshy using the user's
// own API key. Poly Pod Pro never stores the key or pays for credits. The classic
// "open Meshy's website" portal (MESHY_PORTAL / safeMeshyReferral) remains
// available for users who prefer not to bring a key.
export { MESHY_PORTAL, safeMeshyReferral } from '../config/meshyPortal.js';
import { safeProxyUrl } from '../lib/meshySettings.js';

// Meshy task lifecycle. Progress is an integer 0-100.
export const TERMINAL_STATUSES = Object.freeze(['SUCCEEDED', 'FAILED', 'CANCELED', 'EXPIRED']);
export const POLL_INTERVAL_MS = 4000;

export const MESHY_PATHS = Object.freeze({
  text: '/openapi/v2/text-to-3d',
  image: '/openapi/v1/image-to-3d',
});

// ---- Pure helpers (unit-tested) -------------------------------------------

export function buildTextTo3dPayload(prompt) {
  const text = typeof prompt === 'string' ? prompt.trim() : '';
  if (!text) throw new Error('Enter a prompt describing the model you want.');
  return { mode: 'preview', prompt: text, art_style: 'realistic', target_formats: ['stl'] };
}

export function buildImageTo3dPayload(dataUri) {
  if (typeof dataUri !== 'string' || !dataUri.startsWith('data:image/')) {
    throw new Error('Add a reference image first.');
  }
  return { image_url: dataUri, target_formats: ['stl'] };
}

export function clampProgress(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function isTerminalStatus(status) {
  return TERMINAL_STATUSES.includes(status);
}

// Extract the printable STL result URL from a finished task object.
export function extractStlUrl(task) {
  const url = task?.model_urls?.stl;
  return typeof url === 'string' && /^https:\/\//.test(url) ? url : null;
}

// Join the configured proxy base with a Meshy path (or full segment).
export function proxyEndpoint(proxyUrl, path) {
  const base = safeProxyUrl(proxyUrl);
  if (!base) throw new Error('Add your proxy URL in Meshy settings first.');
  return base + (path.startsWith('/') ? path : '/' + path);
}

export function taskStatusPath(kind, taskId) {
  const base = kind === 'image' ? MESHY_PATHS.image : MESHY_PATHS.text;
  return `${base}/${encodeURIComponent(taskId)}`;
}

// ---- Network calls ---------------------------------------------------------

async function proxyFetch({ proxyUrl, apiKey, path, method = 'GET', body, signal }) {
  const headers = { 'X-User-Meshy-Key': (apiKey || '').trim() };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  let response;
  try {
    response = await fetch(proxyEndpoint(proxyUrl, path), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (failure) {
    if (failure?.name === 'AbortError') throw failure;
    throw new Error('Could not reach the proxy. Check the Proxy URL in settings and that the Worker is deployed (its base URL should return a JSON message in the browser).');
  }
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  if (!response.ok) {
    const message = data?.error?.message || data?.message || `Meshy request failed (HTTP ${response.status}).`;
    throw new Error(message);
  }
  return data;
}

// Create a task; returns the Meshy task id.
export async function createTask({ proxyUrl, apiKey, kind, prompt, imageDataUri, signal }) {
  const path = kind === 'image' ? MESHY_PATHS.image : MESHY_PATHS.text;
  const body = kind === 'image' ? buildImageTo3dPayload(imageDataUri) : buildTextTo3dPayload(prompt);
  const data = await proxyFetch({ proxyUrl, apiKey, path, method: 'POST', body, signal });
  const id = typeof data?.result === 'string' ? data.result : data?.id;
  if (!id) throw new Error('Meshy did not return a task id. Check your API key and try again.');
  return id;
}

export async function getTask({ proxyUrl, apiKey, kind, taskId, signal }) {
  return proxyFetch({ proxyUrl, apiKey, path: taskStatusPath(kind, taskId), method: 'GET', signal });
}

// Poll a task until it reaches a terminal status. Calls onProgress(progress, status)
// on every tick. Resolves with the final task object, or throws on failure/abort.
export async function pollTask({ proxyUrl, apiKey, kind, taskId, onProgress, signal, intervalMs = POLL_INTERVAL_MS }) {
  for (;;) {
    if (signal?.aborted) throw new Error('Generation cancelled.');
    const task = await getTask({ proxyUrl, apiKey, kind, taskId, signal });
    const status = task?.status;
    onProgress?.(clampProgress(task?.progress), status);
    if (status === 'SUCCEEDED') return task;
    if (isTerminalStatus(status)) {
      throw new Error(task?.task_error?.message || `Generation ${String(status || '').toLowerCase() || 'failed'}.`);
    }
    await delay(intervalMs, signal);
  }
}

// Download the finished STL through the proxy and return a File the viewer accepts.
export async function downloadStlFile({ proxyUrl, stlUrl, fileName = 'meshy-model.stl', signal }) {
  const endpoint = proxyEndpoint(proxyUrl, `/download?url=${encodeURIComponent(stlUrl)}`);
  let response;
  try {
    response = await fetch(endpoint, { method: 'GET', signal });
  } catch (failure) {
    if (failure?.name === 'AbortError') throw failure;
    throw new Error('Could not reach the proxy to download the model. Check the Proxy URL in settings.');
  }
  if (!response.ok) throw new Error(`The generated model could not be downloaded (HTTP ${response.status}).`);
  const blob = await response.blob();
  if (!blob.size) throw new Error('The generated model came back empty. Try generating again.');
  return new File([blob], fileName, { type: 'application/octet-stream' });
}

function delay(ms, signal) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => { clearTimeout(timer); reject(new Error('Generation cancelled.')); }, { once: true });
  });
}
