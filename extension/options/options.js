const $ = (id) => document.getElementById(id);
const TEXT_FIELDS = ['endpoint'];
const NUMBER_FIELDS = ['maxSteps', 'temperature', 'contextWindow'];
const BOOL_FIELDS = ['stepMode', 'allowNavigate', 'useVision'];

function status(message, ok = true) {
  const el = $('status');
  el.textContent = message;
  el.style.color = ok ? 'var(--ok)' : 'var(--err)';
  if (ok) setTimeout(() => { el.textContent = ''; }, 3000);
}

async function loadModels(endpoint, selected) {
  const select = $('model');
  const res = await chrome.runtime.sendMessage({ type: 'listModels', endpoint });
  if (!res?.ok) {
    $('model-hint').textContent = `Could not reach Ollama: ${res?.error || 'unknown error'}`;
    select.replaceChildren(new Option(selected, selected, true, true));
    return;
  }
  const models = res.data.length ? res.data : [selected];
  select.replaceChildren(...models.map((m) => new Option(m, m, m === selected, m === selected)));
  if (!models.includes(selected)) select.append(new Option(`${selected} (not installed)`, selected, true, true));
  $('model-hint').textContent = `${res.data.length} model(s) installed. Pull more with: ollama pull <name>`;
}

(async () => {
  const { data: cfg } = await chrome.runtime.sendMessage({ type: 'getConfig' });
  for (const f of [...TEXT_FIELDS, ...NUMBER_FIELDS]) $(f).value = cfg[f];
  for (const f of BOOL_FIELDS) $(f).checked = cfg[f];
  await loadModels(cfg.endpoint, cfg.model);
})();

$('endpoint').addEventListener('change', (e) => loadModels(e.target.value, $('model').value));

$('save').addEventListener('click', async () => {
  const patch = { model: $('model').value };
  for (const f of TEXT_FIELDS) patch[f] = $(f).value.trim();
  for (const f of NUMBER_FIELDS) patch[f] = Number($(f).value);
  for (const f of BOOL_FIELDS) patch[f] = $(f).checked;
  const res = await chrome.runtime.sendMessage({ type: 'setConfig', patch });
  status(res?.ok ? 'Saved.' : `Failed: ${res?.error}`, Boolean(res?.ok));
});

$('test').addEventListener('click', async () => {
  const res = await chrome.runtime.sendMessage({ type: 'listModels', endpoint: $('endpoint').value.trim() });
  status(res?.ok ? `Connected — ${res.data.length} model(s) available.` : res.error, Boolean(res?.ok));
});
