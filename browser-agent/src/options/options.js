import { DEFAULT_SETTINGS } from '../shared/protocol.js';
import { getSettings, saveSettings } from '../background/state.js';
import { listModels } from '../background/llm-client.js';

const $ = (id) => document.getElementById(id);

function numberOr(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function load() {
  const settings = await getSettings();
  $('endpoint').value = settings.endpoint;
  $('model').value = settings.model;
  $('temperature').value = settings.temperature;
  $('maxSteps').value = settings.maxSteps;
  $('timeout').value = Math.round(settings.requestTimeoutMs / 1000);
  $('allowlist').value = (settings.allowlist || []).join('\n');
}

$('save').addEventListener('click', async () => {
  await saveSettings({
    endpoint: $('endpoint').value.trim() || DEFAULT_SETTINGS.endpoint,
    model: $('model').value.trim() || DEFAULT_SETTINGS.model,
    temperature: numberOr($('temperature').value, DEFAULT_SETTINGS.temperature),
    maxSteps: Math.max(1, numberOr($('maxSteps').value, DEFAULT_SETTINGS.maxSteps)),
    requestTimeoutMs:
      Math.max(5, numberOr($('timeout').value, DEFAULT_SETTINGS.requestTimeoutMs / 1000)) *
      1000,
    allowlist: $('allowlist')
      .value.split('\n')
      .map((line) => line.trim())
      .filter(Boolean),
  });
  $('test-result').textContent = 'Saved.';
});

$('test').addEventListener('click', async () => {
  const result = $('test-result');
  result.textContent = 'Checking…';
  try {
    const models = await listModels({ endpoint: $('endpoint').value.trim() });
    result.textContent = models.length
      ? `Connected. Loaded: ${models.join(', ')}`
      : 'Connected, but no model is loaded in LM Studio.';
  } catch (error) {
    result.textContent = error.message;
  }
});

load();
