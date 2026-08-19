const port = chrome.runtime.connect({ name: 'agent' });

const $ = (id) => document.getElementById(id);
const goal = $('goal');
const log = $('log');
const dot = $('status-dot');
const approval = $('approval');

let running = false;

function setRunning(value) {
  running = value;
  $('run').disabled = value;
  $('stop').disabled = !value;
  dot.className = `dot${value ? ' busy' : ''}`;
}

function entry(kind, head, body) {
  const el = document.createElement('div');
  el.className = `entry ${kind}`;
  const h = document.createElement('div');
  h.className = 'head';
  h.textContent = head;
  const b = document.createElement('div');
  b.className = 'body';
  b.textContent = body;
  el.append(h, b);
  log.append(el);
  log.scrollTop = log.scrollHeight;
  return el;
}

function describe(d) {
  const bits = [d.action];
  if (d.ref !== undefined && d.ref !== null) bits.push(`[${d.ref}]`);
  if (d.text) bits.push(JSON.stringify(d.text));
  if (d.url) bits.push(d.url);
  if (d.direction) bits.push(d.direction);
  if (d.submit) bits.push('+Enter');
  return bits.join(' ');
}

function askUser(text, label) {
  approval.classList.remove('hidden');
  $('approval-text').textContent = text;
  $('approval-note').value = '';
  $('approve').textContent = label;
  $('approval-note').focus();
}

port.onMessage.addListener((e) => {
  switch (e.type) {
    case 'start':
      setRunning(true);
      entry('thought', 'Task', `${e.goal}\n(model: ${e.model}, up to ${e.maxSteps} steps)`);
      break;
    case 'page':
      entry('page', `Step ${e.step} — page`, `${e.title || '(untitled)'}\n${e.url}`);
      break;
    case 'thinking':
      entry('thought', `Step ${e.step} — thinking`, '…');
      break;
    case 'decision': {
      const last = log.lastElementChild;
      if (last?.classList.contains('thought')) last.querySelector('.body').textContent = e.decision.thought || '(no reasoning)';
      entry('action', 'Action', describe(e.decision));
      break;
    }
    case 'result':
      entry(e.failed ? 'error' : 'result', 'Result', e.result);
      break;
    case 'approval':
      askUser(`Approve this action?\n${describe(e.decision)}`, 'Run action');
      break;
    case 'ask':
      entry('thought', 'Agent asks', e.question);
      askUser(e.question, 'Send reply');
      break;
    case 'done':
      entry('answer', e.exhausted ? 'Stopped' : 'Answer', e.answer);
      setRunning(false);
      dot.className = 'dot ok';
      break;
    case 'error':
      entry('error', 'Error', e.error);
      setRunning(false);
      dot.className = 'dot err';
      approval.classList.add('hidden');
      break;
  }
});

async function refreshTarget() {
  const res = await chrome.runtime.sendMessage({ type: 'activeTab' });
  const tab = res?.data;
  $('target').textContent = tab?.url ? `Acting on: ${tab.title || tab.url}` : 'No page selected';
}

$('run').addEventListener('click', async () => {
  const text = goal.value.trim();
  if (!text) return goal.focus();
  log.replaceChildren();
  approval.classList.add('hidden');
  const res = await chrome.runtime.sendMessage({ type: 'activeTab' });
  port.postMessage({ type: 'run', goal: text, tabId: res?.data?.id });
  setRunning(true);
});

$('stop').addEventListener('click', () => {
  port.postMessage({ type: 'stop' });
  approval.classList.add('hidden');
});

$('approve').addEventListener('click', () => {
  port.postMessage({ type: 'approval', approved: true, note: $('approval-note').value.trim() });
  approval.classList.add('hidden');
});

$('reject').addEventListener('click', () => {
  port.postMessage({ type: 'approval', approved: false, note: $('approval-note').value.trim() });
  approval.classList.add('hidden');
});

$('stepMode').addEventListener('change', (e) => {
  chrome.runtime.sendMessage({ type: 'setConfig', patch: { stepMode: e.target.checked } });
});

$('settings').addEventListener('click', () => chrome.runtime.openOptionsPage());

goal.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !running) $('run').click();
});

chrome.tabs.onActivated.addListener(refreshTarget);
chrome.tabs.onUpdated.addListener(refreshTarget);

(async () => {
  const cfg = await chrome.runtime.sendMessage({ type: 'getConfig' });
  $('stepMode').checked = Boolean(cfg?.data?.stepMode);
  refreshTarget();
})();
