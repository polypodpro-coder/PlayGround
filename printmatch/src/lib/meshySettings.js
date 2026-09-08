// Browser-side storage for the user's own Meshy credentials (BYOK).
// The API key is saved in this browser's localStorage and forwarded to Meshy
// through the selected proxy, whose operator can receive it. All access is wrapped in try/catch so the
// app still works where storage is unavailable (private windows, blocked cookies).

const KEY_STORAGE = 'ppp.meshy.apiKey';
const PROXY_STORAGE = 'ppp.meshy.proxyUrl';

export const MESHY_DASHBOARD_URL = 'https://www.meshy.ai/settings/api';
export const DEFAULT_MESHY_PROXY_URL = 'https://poly-pod-meshy.polypodpro.workers.dev';

// Accept only an https origin/path we can safely POST to; reject credentials,
// non-https schemes, and obvious junk. Returns a normalized href or null.
export function safeProxyUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:') return null;
    if (url.username || url.password) return null;
    if (url.href.includes('?') || url.href.includes('#')) return null;
    // Strip any trailing slash so callers can join paths predictably.
    return url.href.replace(/\/+$/, '');
  } catch {
    return null;
  }
}

// A Meshy key is an opaque token; we only sanity-check it is a non-trivial string.
export function isPlausibleApiKey(value) {
  return typeof value === 'string' && value.trim().length >= 8 && /^[\x21-\x7e]+$/.test(value.trim());
}

export function readMeshySettings(storage) {
  const store = storage ?? safeLocalStorage();
  let apiKey = '';
  let proxyUrl = '';
  try { apiKey = store?.getItem(KEY_STORAGE) || ''; } catch { apiKey = ''; }
  try { proxyUrl = store?.getItem(PROXY_STORAGE) || ''; } catch { proxyUrl = ''; }
  // Preserve explicit overrides (even invalid ones) so a key is never silently
  // rerouted to another operator. Empty settings use the site's public Worker.
  return { apiKey, proxyUrl: proxyUrl.trim() || DEFAULT_MESHY_PROXY_URL };
}

export function saveMeshySettings({ apiKey, proxyUrl }, storage) {
  const store = storage ?? safeLocalStorage();
  if (!store) return false;
  try {
    if (typeof apiKey === 'string') store.setItem(KEY_STORAGE, apiKey.trim());
    if (typeof proxyUrl === 'string') store.setItem(PROXY_STORAGE, proxyUrl.trim());
    return true;
  } catch {
    return false;
  }
}

export function clearMeshySettings(storage) {
  const store = storage ?? safeLocalStorage();
  if (!store) return;
  try { store.removeItem(KEY_STORAGE); } catch { /* ignore */ }
  try { store.removeItem(PROXY_STORAGE); } catch { /* ignore */ }
}

// True only when both a plausible key and a valid proxy URL are configured.
export function isMeshyConfigured(settings) {
  return isPlausibleApiKey(settings?.apiKey) && !!safeProxyUrl(settings?.proxyUrl);
}

function safeLocalStorage() {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}
