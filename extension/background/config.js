export const DEFAULTS = {
  endpoint: 'http://localhost:11434',
  model: 'qwen3:8b',
  maxSteps: 25,
  temperature: 0.2,
  contextWindow: 8192,
  stepMode: false,      // ask for approval before every action
  useVision: false,     // send a screenshot too (needs a vision model)
  allowNavigate: true   // let the agent open URLs directly
};

export async function getConfig() {
  const stored = await chrome.storage.local.get(Object.keys(DEFAULTS));
  return { ...DEFAULTS, ...stored };
}

export async function setConfig(patch) {
  await chrome.storage.local.set(patch);
  return getConfig();
}
