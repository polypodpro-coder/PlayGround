export const DEFAULTS = {
  provider: 'ollama',                    // 'ollama' | 'openai'
  endpoint: 'http://localhost:11434',    // Ollama root, or OpenAI-compatible root (e.g. http://localhost:1234)
  model: 'qwen3:8b',
  apiKey: '',                            // only used by OpenAI-compatible servers that require one
  temperature: 0,
  maxSteps: 25,
  stepTimeoutMs: 120000,
  allowedDomains: ''                     // comma separated; empty = any site
};

export async function getSettings() {
  const stored = await chrome.storage.local.get('settings');
  return { ...DEFAULTS, ...(stored.settings || {}) };
}

export async function saveSettings(patch) {
  const current = await getSettings();
  const next = { ...current, ...patch };
  await chrome.storage.local.set({ settings: next });
  return next;
}

export function domainAllowed(url, allowedDomains) {
  const list = String(allowedDomains || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (list.length === 0) return true;
  let host;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }
  return list.some((d) => host === d || host.endsWith('.' + d));
}
