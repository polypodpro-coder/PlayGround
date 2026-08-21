import { DEFAULT_SETTINGS, PROVIDERS } from '../shared/protocol.js';
import { getSettings, saveSettings } from '../background/state.js';
import { listModels } from '../background/llm-client.js';

const $ = (id) => document.getElementById(id);

function numberOr(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

let currentProvider = DEFAULT_SETTINGS.provider;

function selectProvider(provider) {
  currentProvider = provider;
  for (const tab of document.querySelectorAll('.provider-tab')) {
    tab.classList.toggle('selected', tab.dataset.provider === provider);
  }
  $('section-local').hidden = provider !== PROVIDERS.LOCAL;
  $('section-gemini').hidden = provider !== PROVIDERS.GEMINI;
}

document.getElementById('provider-tabs').addEventListener('click', (event) => {
  const tab = event.target.closest('.provider-tab');
  if (tab) selectProvider(tab.dataset.provider);
});

$('toggle-key').addEventListener('click', () => {
  const input = $('geminiApiKey');
  const showing = input.type === 'text';
  input.type = showing ? 'password' : 'text';
  $('toggle-key').textContent = showing ? 'Show' : 'Hide';
});

async function load() {
  const settings = await getSettings();
  selectProvider(settings.provider);

  $('endpoint').value = settings.endpoint;
  $('model').value = settings.model;
  $('geminiApiKey').value = settings.geminiApiKey;
  $('geminiModel').value = settings.geminiModel;
  $('approvalMode').value = settings.approvalMode;
  $('temperature').value = settings.temperature;
  $('maxSteps').value = settings.maxSteps;
  $('timeout').value = Math.round(settings.requestTimeoutMs / 1000);
  $('allowlist').value = (settings.allowlist || []).join('\n');
}

function readForm() {
  return {
    provider: currentProvider,
    endpoint: $('endpoint').value.trim() || DEFAULT_SETTINGS.endpoint,
    model: $('model').value.trim() || DEFAULT_SETTINGS.model,
    geminiApiKey: $('geminiApiKey').value.trim(),
    geminiModel: $('geminiModel').value.trim() || DEFAULT_SETTINGS.geminiModel,
    approvalMode: $('approvalMode').value,
    temperature: numberOr($('temperature').value, DEFAULT_SETTINGS.temperature),
    maxSteps: Math.max(1, numberOr($('maxSteps').value, DEFAULT_SETTINGS.maxSteps)),
    requestTimeoutMs:
      Math.max(5, numberOr($('timeout').value, DEFAULT_SETTINGS.requestTimeoutMs / 1000)) *
      1000,
    allowlist: $('allowlist')
      .value.split('\n')
      .map((line) => line.trim())
      .filter(Boolean),
  };
}

$('save').addEventListener('click', async () => {
  await saveSettings(readForm());
  $('test-result').textContent = 'Saved.';
});

$('test').addEventListener('click', async () => {
  const result = $('test-result');
  result.textContent = 'Checking…';
  try {
    const models = await listModels(readForm());
    result.textContent = models.length
      ? `Connected. Available: ${models.join(', ')}`
      : 'Connected, but no model was reported.';
  } catch (error) {
    result.textContent = error.message;
  }
});

load();
