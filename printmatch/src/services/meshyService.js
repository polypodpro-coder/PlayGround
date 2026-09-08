// Meshy BYOK generation service.
//
// Generation is optional and buyer-owned: the browser sends the user's API key
// through the configured CORS proxy (see serverless-proxy.js) to Meshy. The proxy
// operator receives the key in transit; Meshy bills the user's account. The classic
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

const CONNECTION_TIMEOUT_MS = 15_000;
const INVALID_RESPONSE = 'The proxy returned an unexpected response. Check the Proxy URL in advanced Meshy settings.';

function safeUpstreamMessage(value, apiKey) {
  if (typeof value !== 'string') return '';
  let message = value;
  const key = typeof apiKey === 'string' ? apiKey.trim() : '';
  if (key) {
    for (const form of new Set([key, encodeURIComponent(key), JSON.stringify(key).slice(1, -1)])) {
      message = message.split(form).join('[redacted]');
    }
  }
  return message.replace(/msy_[A-Za-z0-9._-]+/g, '[redacted]').slice(0, 500);
}

function requestError(status, data, apiKey) {
  const messages = {
    401: 'Meshy did not accept this API key. Copy your API key from the Meshy dashboard and reconnect.',
    402: 'Meshy requires available API credits for this request. Check your API balance and plan in Meshy.',
    403: 'Access was denied. Check your Meshy API permissions and whether the proxy allows this site origin.',
    404: 'The Meshy endpoint was not found. Check the Proxy URL in advanced Meshy settings.',
    429: 'Meshy is receiving too many requests. Wait a moment and try again.',
  };
  const detail = safeUpstreamMessage(data?.error?.message || data?.message, apiKey);
  return new Error(messages[status] || (detail ? `Meshy request failed (HTTP ${status}): ${detail}` : `Meshy request failed (HTTP ${status}). Try again shortly.`));
}

async function readProxyResponse({ proxyUrl, apiKey, path, method = 'GET', body, signal }) {
  const endpoint = proxyEndpoint(proxyUrl, path);
  const headers = {};
  if (apiKey !== undefined) headers['X-User-Meshy-Key'] = (apiKey || '').trim();
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const init = { method, headers, signal, credentials: 'omit', redirect: 'error' };
  if (body !== undefined) init.body = JSON.stringify(body);
  let response;
  let text;
  try {
    response = await fetch(endpoint, init);
    text = await response.text();
  } catch (failure) {
    if (signal?.aborted) throw signal.reason || failure;
    if (failure?.name === 'AbortError') throw failure;
    throw new Error('Could not reach the Meshy proxy. Check your internet connection and the Proxy URL in advanced settings. The proxy must allow requests from this site.');
  }
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  return { response, data };
}

async function proxyFetch(options) {
  const { response, data } = await readProxyResponse(options);
  if (!response.ok) throw requestError(response.status, data, options.apiKey);
  if (!data || typeof data !== 'object') throw new Error(INVALID_RESPONSE);
  return data;
}

async function withConnectionTimeout(signal, operation) {
  signal?.throwIfAborted();
  const controller = new AbortController();
  const forwardAbort = () => controller.abort(signal.reason);
  signal?.addEventListener('abort', forwardAbort, { once: true });
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, CONNECTION_TIMEOUT_MS);
  try {
    return await operation(controller.signal);
  } catch (failure) {
    if (timedOut) throw new Error('The Meshy connection check timed out. Check your connection and try again.');
    throw failure;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', forwardAbort);
  }
}

// Verify API access by listing at most one existing task. This creates no model.
export async function checkMeshyConnection({ proxyUrl, apiKey, signal }) {
  if (typeof apiKey !== 'string' || !apiKey.trim()) throw new Error('Add your Meshy API key to connect.');
  return withConnectionTimeout(signal, async (checkSignal) => {
    const data = await proxyFetch({ proxyUrl, apiKey, path: `${MESHY_PATHS.text}?page_size=1`, signal: checkSignal });
    if (!Array.isArray(data) || data.some((task) => !task || typeof task !== 'object' || typeof task.id !== 'string')) {
      throw new Error(INVALID_RESPONSE);
    }
    return true;
  });
}

// A missing-key response verifies browser access to the proxy without credentials.
export async function checkMeshyProxy({ proxyUrl, signal }) {
  return withConnectionTimeout(signal, async (checkSignal) => {
    const { response, data } = await readProxyResponse({ proxyUrl, path: `${MESHY_PATHS.text}?page_size=1`, signal: checkSignal });
    if (response.status === 401 && typeof data?.error?.message === 'string' && /missing\s+X-User-Meshy-Key\b/i.test(data.error.message)) return true;
    if (!response.ok && response.status !== 401) throw requestError(response.status, data);
    throw new Error(INVALID_RESPONSE);
  });
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
      throw new Error(safeUpstreamMessage(task?.task_error?.message, apiKey) || `Generation ${String(status || '').toLowerCase() || 'failed'}.`);
    }
    await delay(intervalMs, signal);
  }
}

// Download the finished STL through the proxy and return a File the viewer accepts.
export async function downloadStlFile({ proxyUrl, stlUrl, fileName = 'meshy-model.stl', signal }) {
  const endpoint = proxyEndpoint(proxyUrl, `/download?url=${encodeURIComponent(stlUrl)}`);
  let response;
  try {
    response = await fetch(endpoint, { method: 'GET', signal, credentials: 'omit', redirect: 'error' });
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
