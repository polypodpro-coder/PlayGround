/**
 * The side panel, rendered as a running chat transcript: your goal as a
 * message, the agent's narration and actions appended inline as it works —
 * rather than a single card that gets replaced each step.
 *
 * Two render paths, matching how the state actually changes:
 *   - Completed steps (state.history) are APPENDED once and never touched
 *     again — the permanent transcript.
 *   - The current in-flight step (typing indicator, a pending approval, a
 *     question, or the final done/error message) is the "live" node: it gets
 *     fully replaced on every state update, because the same step moves
 *     through several statuses (thinking → awaiting_approval → executing)
 *     before it either becomes a history entry or ends the run.
 *
 * A side panel rather than a popup because a popup closes the instant you
 * click the page — which, in a run with live checkpoints, happens constantly.
 */

import { BG_MSG, PANEL_MSG, PORT_NAME, STATUS } from '../shared/protocol.js';

const $ = (id) => document.getElementById(id);

const thread = $('thread');
const emptyState = $('empty-state');
const composerForm = $('composer-form');
const composerInput = $('composer-input');
const sendBtn = $('send-btn');
const stopBtn = $('stop-btn');

const ACTIVE = [
  STATUS.OBSERVING,
  STATUS.THINKING,
  STATUS.EXECUTING,
  STATUS.AWAITING_APPROVAL,
  STATUS.AWAITING_ANSWER,
];

/** Which field of an action the user may correct before approving it. */
const EDITABLE_FIELD = { type: 'text', navigate: 'url', select: 'value' };

const port = chrome.runtime.connect({ name: PORT_NAME });
let state = null;
let renderedRunId = Symbol('unset');
let renderedHistoryCount = 0;
let liveEl = null;

port.onMessage.addListener((message) => {
  if (message?.type === BG_MSG.STATE) render(message.state);
});

port.postMessage({ type: PANEL_MSG.HELLO });

function send(type, extra = {}) {
  port.postMessage({ type, ...extra });
}

// ── icons ──────────────────────────────────────────────────────────────────

const ICONS = {
  navigate: '<path d="M12 2 2 22l10-6 10 6z"/>',
  click: '<path d="M9 2v6M3.5 8.5 8 12M9 22V12h9l-5-8-4 8"/>',
  type: '<path d="M4 7V5h16v2M9 19h6M12 5v14"/>',
  select: '<path d="M8 9l4-4 4 4M8 15l4 4 4-4"/>',
  scroll: '<path d="M12 3v18M7 8l5-5 5 5M7 16l5 5 5-5"/>',
  wait: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>',
  ask_user: '<path d="M12 17h.01M9 9a3 3 0 1 1 5 2.24c-.6.53-1 1.02-1 1.76v.5"/><circle cx="12" cy="12" r="9"/>',
};

const CHECK_ICON = '<path d="M20 6 9 17l-5-5"/>';
const CROSS_ICON = '<path d="M18 6 6 18M6 6l12 12"/>';
const SPINNER_ICON = '<circle cx="12" cy="12" r="9" opacity="0.25"/><path d="M21 12a9 9 0 0 0-9-9"/>';

function svg(inner, viewBox = '0 0 24 24') {
  return `<svg viewBox="${viewBox}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
}

function el(tag, className, html) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (html !== undefined) node.innerHTML = html;
  return node;
}

// ── top-level render ───────────────────────────────────────────────────────

function render(next) {
  state = next;

  if (state.id !== renderedRunId) startNewThread(state);
  appendNewHistory(state);
  renderLive(state);
  renderComposer(state);

  emptyState.hidden = Boolean(state.goal);
  scrollToBottom();
}

function startNewThread(runState) {
  renderedRunId = runState.id;
  renderedHistoryCount = 0;
  liveEl = null;
  thread.replaceChildren(emptyState);
  if (runState.goal) {
    thread.appendChild(el('div', 'msg msg-user', escapeHtml(runState.goal)));
  }
}

function scrollToBottom() {
  thread.scrollTop = thread.scrollHeight;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = String(text ?? '');
  return div.innerHTML;
}

// ── permanent transcript: completed steps ───────────────────────────────────

function appendNewHistory(runState) {
  const history = runState.history || [];
  for (let i = renderedHistoryCount; i < history.length; i += 1) {
    appendHistoryEntry(history[i]);
  }
  renderedHistoryCount = history.length;
}

/** Appends one or more nodes for a completed step directly onto the thread. */
function appendHistoryEntry(entry) {
  if (entry.tool === 'ask_user') return appendAnsweredQuestion(entry);

  const wrap = el('div', 'msg msg-agent');
  if (entry.reasoning) wrap.appendChild(el('p', 'narration', escapeHtml(entry.reasoning)));
  wrap.appendChild(buildChip(entry.tool, entry.summary, entry.result));
  thread.appendChild(wrap);
}

/** ask_user renders as a Q&A pair: the agent's question, then the user's reply. */
function appendAnsweredQuestion(entry) {
  const question = el('div', 'msg msg-agent');
  question.appendChild(el('p', 'narration', escapeHtml(entry.summary)));

  const match = /^the user answered: (.*)$/s.exec(entry.result?.message || '');
  if (!entry.result?.ok || !match || match[1] === '(no answer)') {
    question.appendChild(el('p', 'narration muted', escapeHtml(entry.result?.message || 'not answered')));
    thread.appendChild(question);
    return;
  }

  thread.appendChild(question);
  thread.appendChild(el('div', 'msg msg-user', escapeHtml(match[1])));
}

/** icon + one-line description + status glyph, for a step that has already run. */
function buildChip(tool, description, result) {
  const chip = el('div', 'chip');
  chip.appendChild(el('div', 'chip-icon', svg(ICONS[tool] || ICONS.click)));

  const body = el('div', 'chip-body');
  body.appendChild(el('div', 'chip-desc', escapeHtml(description)));
  if (result && !result.ok && result.message) {
    body.appendChild(el('div', 'chip-detail failed', escapeHtml(result.message)));
  }
  chip.appendChild(body);

  const ok = result ? result.ok : true;
  chip.appendChild(el('div', `chip-status ${ok ? 'ok' : 'bad'}`, svg(ok ? CHECK_ICON : CROSS_ICON)));
  return chip;
}

// ── live node: whatever is currently in flight ──────────────────────────────

function renderLive(runState) {
  if (liveEl) {
    liveEl.remove();
    liveEl = null;
  }

  switch (runState.status) {
    case STATUS.OBSERVING:
    case STATUS.THINKING:
      liveEl = buildTyping();
      break;
    case STATUS.EXECUTING:
      liveEl = runState.pending ? buildRunningChip(runState.pending) : buildTyping();
      break;
    case STATUS.AWAITING_APPROVAL:
      liveEl = buildApproval(runState.pending);
      break;
    case STATUS.AWAITING_ANSWER:
      liveEl = buildQuestion(runState.pending);
      break;
    case STATUS.DONE:
      liveEl = buildFinal('ok', runState.answer || 'Done.');
      break;
    case STATUS.ERROR:
      liveEl = buildFinal('bad', runState.error || 'Something went wrong.');
      break;
    case STATUS.ABORTED:
      liveEl = buildFinal('bad', runState.error || 'Stopped.');
      break;
    default:
      liveEl = null;
  }

  if (liveEl) thread.appendChild(liveEl);
}

function buildTyping() {
  const wrap = el('div', 'msg msg-agent');
  wrap.appendChild(el('div', 'typing', '<span></span><span></span><span></span>'));
  return wrap;
}

function buildRunningChip(pending) {
  const wrap = el('div', 'msg msg-agent');
  if (pending.action.reasoning) {
    wrap.appendChild(el('p', 'narration', escapeHtml(pending.action.reasoning)));
  }
  const chip = el('div', 'chip');
  chip.appendChild(el('div', 'chip-icon', svg(ICONS[pending.action.tool] || ICONS.click)));
  chip.appendChild(el('div', 'chip-body', `<div class="chip-desc">${escapeHtml(pending.description)}</div>`));
  chip.appendChild(el('div', 'chip-status pending', svg(SPINNER_ICON)));
  wrap.appendChild(chip);
  return wrap;
}

function buildApproval(pending) {
  const { action, description, offAllowlist } = pending;
  const wrap = el('div', 'msg msg-agent');
  if (action.reasoning) wrap.appendChild(el('p', 'narration', escapeHtml(action.reasoning)));

  const chip = el('div', 'chip pending');
  chip.appendChild(el('div', 'chip-icon', svg(ICONS[action.tool] || ICONS.click)));

  const body = el('div', 'chip-body');
  body.appendChild(el('div', 'chip-desc', escapeHtml(description)));
  if (offAllowlist) {
    body.appendChild(
      el('div', 'warn-line', 'This site is not on your allowlist. Approve only if you meant to go there.'),
    );
  }

  const field = EDITABLE_FIELD[action.tool];
  let editInput = null;
  if (field) {
    const row = el('label', 'edit-row');
    row.appendChild(el('span', null, field === 'url' ? 'URL' : field));
    editInput = document.createElement('input');
    editInput.type = 'text';
    editInput.value = action[field] ?? '';
    row.appendChild(editInput);
    body.appendChild(row);
  }

  const actions = el('div', 'chip-actions');
  const approveBtn = el('button', 'btn btn-primary', 'Approve');
  approveBtn.type = 'button';
  approveBtn.addEventListener('click', () => {
    const edits = field ? { [field]: editInput.value } : undefined;
    send(PANEL_MSG.APPROVE, { edits });
  });
  const rejectBtn = el('button', 'btn', 'Reject');
  rejectBtn.type = 'button';
  rejectBtn.addEventListener('click', () => send(PANEL_MSG.SKIP));
  actions.append(approveBtn, rejectBtn);
  body.appendChild(actions);

  chip.appendChild(body);
  wrap.appendChild(chip);
  queueMicrotask(() => approveBtn.focus());
  return wrap;
}

function buildQuestion(pending) {
  const wrap = el('div', 'msg msg-agent');
  wrap.appendChild(el('p', 'narration', escapeHtml(pending.action.question)));

  const form = document.createElement('form');
  form.className = 'reply-form';
  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'Your answer';
  const submit = el('button', 'btn btn-primary', 'Send');
  submit.type = 'submit';
  form.append(input, submit);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    send(PANEL_MSG.ANSWER, { text: input.value });
  });
  wrap.appendChild(form);
  queueMicrotask(() => input.focus());
  return wrap;
}

function buildFinal(kind, text) {
  const wrap = el('div', 'msg msg-agent final');
  wrap.appendChild(el('div', `final-icon ${kind}`, svg(kind === 'ok' ? CHECK_ICON : CROSS_ICON)));
  wrap.appendChild(el('p', 'narration', escapeHtml(text)));
  return wrap;
}

// ── composer ───────────────────────────────────────────────────────────────

function renderComposer(runState) {
  const busy = ACTIVE.includes(runState.status);
  composerInput.disabled = busy;
  sendBtn.disabled = busy;
  stopBtn.hidden = !busy;
  composerInput.placeholder = busy
    ? 'Working…'
    : runState.status === STATUS.DONE || runState.status === STATUS.ERROR || runState.status === STATUS.ABORTED
      ? 'Ask the agent to do something else'
      : 'What should the agent do on this page?';
}

function autoGrow() {
  composerInput.style.height = 'auto';
  composerInput.style.height = `${Math.min(140, composerInput.scrollHeight)}px`;
}

composerInput.addEventListener('input', autoGrow);

composerForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const goal = composerInput.value.trim();
  if (!goal) return;
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  composerInput.value = '';
  autoGrow();
  send(PANEL_MSG.START, { goal, tabId: tab?.id });
});

stopBtn.addEventListener('click', () => send(PANEL_MSG.ABORT));

$('open-options').addEventListener('click', () => chrome.runtime.openOptionsPage());
