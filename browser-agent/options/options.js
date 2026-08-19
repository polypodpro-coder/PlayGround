const FIELDS = ['provider', 'endpoint', 'model', 'apiKey', 'temperature', 'maxSteps', 'allowedDomains'];
const $ = (id) => document.getElementById(id);

load();

async function load() {
  const res = await send({ type: 'get-settings' });
  const settings = res?.settings || {};
  for (const key of FIELDS) {
    if ($(key) && settings[key] !== undefined) $(key).value = settings[key];
  }
  $('save').addEventListener('click', save);
  $('test').addEventListener('click', test);
}

async function save() {
  const patch = {};
  for (const key of FIELDS) patch[key] = $(key).value.trim();
  patch.temperature = Number(patch.temperature) || 0;
  patch.maxSteps = Math.max(1, Number(patch.maxSteps) || 25);
  const res = await send({ type: 'save-settings', patch });
  status(res?.ok ? 'Saved.' : `Save failed: ${res?.error || 'unknown error'}`);
}

async function test() {
  status('Contacting server…');
  await save();
  const res = await send({ type: 'list-models' });
  if (!res?.ok) {
    status(
      `Could not reach the server: ${res?.error || 'unknown error'}. ` +
        'If you are running Ollama, make sure OLLAMA_ORIGINS allows chrome-extension://* and that it is restarted.'
    );
    return;
  }
  const list = $('model-list');
  list.innerHTML = '';
  for (const name of res.models) {
    const option = document.createElement('option');
    option.value = name;
    list.append(option);
  }
  status(`Connected. ${res.models.length} model(s) available: ${res.models.slice(0, 6).join(', ')}`);
}

function status(text) {
  $('status').textContent = text;
}

function send(message) {
  return chrome.runtime.sendMessage({ ...message, target: 'background' }).catch((e) => ({ ok: false, error: String(e) }));
}
