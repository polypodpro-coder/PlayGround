const $ = (id) => document.getElementById(id);
const logEl = $('log');

let running = false;

init();

async function init() {
  const status = await send({ type: 'status' });
  setRunning(Boolean(status?.running));

  const res = await send({ type: 'get-settings' });
  if (res?.settings) {
    $('model-badge').textContent = `${res.settings.model} @ ${hostOf(res.settings.endpoint)}`;
  }

  $('run').addEventListener('click', run);
  $('stop').addEventListener('click', () => send({ type: 'stop' }));
  $('clear').addEventListener('click', () => (logEl.innerHTML = ''));
  $('options').addEventListener('click', () => chrome.runtime.openOptionsPage());
  $('ask-send').addEventListener('click', sendAnswer);
  $('ask-input').addEventListener('keydown', (e) => e.key === 'Enter' && sendAnswer());
  $('goal').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) run();
  });
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.target !== 'panel') return;
  render(msg.event);
});

async function run() {
  const goal = $('goal').value.trim();
  if (!goal) return;
  hideAsk();
  const res = await send({ type: 'start', goal });
  if (!res?.ok) {
    add('err', 'Could not start', res?.error || 'unknown error');
    return;
  }
  setRunning(true);
}

async function sendAnswer() {
  const text = $('ask-input').value.trim();
  if (!text) return;
  await send({ type: 'answer', text });
  add('info', 'You answered', text);
  hideAsk();
}

function render(event) {
  switch (event.type) {
    case 'started':
      add('info', 'Started', `${event.goal}\non ${event.url}`);
      setRunning(true);
      break;
    case 'observation':
      add('info', `Step ${event.step}`, `${event.elements} elements · ${event.url}`);
      break;
    case 'thought':
      add('act', `Step ${event.step}`, event.thought || '(no reasoning given)', formatAction(event.action));
      break;
    case 'action-error':
      add('err', 'Action failed', event.message);
      break;
    case 'question':
      showAsk(event.question);
      break;
    case 'finished':
      add(event.status === 'done' ? 'ok' : event.status === 'error' ? 'err' : 'info', labelFor(event.status), event.message);
      setRunning(false);
      hideAsk();
      break;
  }
}

function labelFor(status) {
  return { done: 'Done', error: 'Error', limit: 'Step limit reached', blocked: 'Blocked', stopped: 'Stopped' }[status] || status;
}

function formatAction(action) {
  if (!action) return '';
  const { name, ...args } = action;
  const parts = Object.entries(args).map(([k, v]) => `${k}=${JSON.stringify(v)}`);
  return `${name}(${parts.join(', ')})`;
}

function add(kind, title, body, action) {
  const li = document.createElement('li');
  li.className = kind;

  const head = document.createElement('div');
  head.className = 'step';
  head.textContent = title;
  li.append(head);

  if (body) {
    const p = document.createElement('div');
    p.textContent = body;
    li.append(p);
  }
  if (action) {
    const code = document.createElement('div');
    code.className = 'action';
    code.textContent = action;
    li.append(code);
  }

  logEl.append(li);
  li.scrollIntoView({ block: 'end' });
}

function showAsk(question) {
  $('ask-question').textContent = question;
  $('ask-input').value = '';
  $('ask').classList.remove('hidden');
  $('ask-input').focus();
}

function hideAsk() {
  $('ask').classList.add('hidden');
}

function setRunning(value) {
  running = value;
  $('run').disabled = value;
  $('stop').disabled = !value;
  $('goal').disabled = value;
}

function hostOf(endpoint) {
  try {
    return new URL(endpoint).host;
  } catch {
    return endpoint;
  }
}

function send(message) {
  return chrome.runtime.sendMessage({ ...message, target: 'background' }).catch(() => null);
}
