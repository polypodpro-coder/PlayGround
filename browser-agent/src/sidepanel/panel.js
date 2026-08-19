/**
 * The side panel. Deliberately dumb: it renders whatever state the background
 * sends and posts user decisions back. No agent logic lives here.
 *
 * A side panel rather than a popup because a popup closes the instant you click
 * the page — which, in a loop that asks for approval on every step, is
 * constantly.
 */

import { BG_MSG, PANEL_MSG, PORT_NAME, STATUS } from '../shared/protocol.js';

const $ = (id) => document.getElementById(id);

const el = {
  form: $('goal-form'),
  goal: $('goal-input'),
  start: $('start'),
  abort: $('abort'),
  status: $('status'),

  pending: $('pending'),
  pendingTool: $('pending-tool'),
  pendingStep: $('pending-step'),
  pendingDescription: $('pending-description'),
  pendingReasoning: $('pending-reasoning'),
  pendingWarning: $('pending-warning'),
  editWrap: $('edit-wrap'),
  editLabel: $('edit-label'),
  editInput: $('edit-input'),
  approve: $('approve'),
  skip: $('skip'),

  question: $('question'),
  questionText: $('question-text'),
  answerForm: $('answer-form'),
  answerInput: $('answer-input'),

  result: $('result'),
  resultText: $('result-text'),
  reset: $('reset'),

  failure: $('failure'),
  failureText: $('failure-text'),
  resetError: $('reset-error'),

  historyTitle: $('history-title'),
  history: $('history'),
};

const STATUS_TEXT = {
  [STATUS.IDLE]: '',
  [STATUS.OBSERVING]: 'Reading the page…',
  [STATUS.THINKING]: 'Thinking (local model)…',
  [STATUS.AWAITING_APPROVAL]: 'Waiting for your approval.',
  [STATUS.AWAITING_ANSWER]: 'The agent has a question for you.',
  [STATUS.EXECUTING]: 'Running the action…',
  [STATUS.DONE]: 'Finished.',
  [STATUS.ABORTED]: 'Stopped.',
  [STATUS.ERROR]: '',
};

const BUSY = [STATUS.OBSERVING, STATUS.THINKING, STATUS.EXECUTING];
const ACTIVE = [...BUSY, STATUS.AWAITING_APPROVAL, STATUS.AWAITING_ANSWER];

/** Which field of an action the user is allowed to correct before approving. */
const EDITABLE_FIELD = { type: 'text', navigate: 'url', select: 'value' };

const port = chrome.runtime.connect({ name: PORT_NAME });
let state = null;

port.onMessage.addListener((message) => {
  if (message?.type === BG_MSG.STATE) render(message.state);
});

port.postMessage({ type: PANEL_MSG.HELLO });

function send(type, extra = {}) {
  port.postMessage({ type, ...extra });
}

function render(next) {
  state = next;
  const { status } = state;

  el.status.textContent = STATUS_TEXT[status] ?? '';
  el.goal.value = state.goal || el.goal.value;
  el.goal.disabled = ACTIVE.includes(status);
  el.start.disabled = ACTIVE.includes(status);
  el.abort.hidden = !ACTIVE.includes(status);

  renderPending();
  renderQuestion();
  renderTerminal();
  renderHistory();
}

function renderPending() {
  const showing = state.status === STATUS.AWAITING_APPROVAL && state.pending;
  el.pending.hidden = !showing;
  if (!showing) return;

  const { action, description, offAllowlist } = state.pending;

  el.pendingTool.textContent = action.tool;
  el.pendingStep.textContent = `step ${state.step + 1} of ${state.maxSteps}`;
  el.pendingDescription.textContent = description;
  el.pendingReasoning.textContent = action.reasoning || '';

  el.pendingWarning.hidden = !offAllowlist;
  if (offAllowlist) {
    el.pendingWarning.textContent =
      'This site is not on your allowlist. Approve only if you meant to go there.';
  }

  const field = EDITABLE_FIELD[action.tool];
  el.editWrap.hidden = !field;
  if (field) {
    el.editLabel.textContent = field === 'url' ? 'URL' : field;
    el.editInput.value = action[field] ?? '';
    el.editInput.dataset.field = field;
  }

  el.approve.focus();
}

function renderQuestion() {
  const showing = state.status === STATUS.AWAITING_ANSWER && state.pending;
  el.question.hidden = !showing;
  if (!showing) return;
  el.questionText.textContent = state.pending.action.question;
  el.answerInput.value = '';
  el.answerInput.focus();
}

function renderTerminal() {
  el.result.hidden = state.status !== STATUS.DONE;
  if (state.status === STATUS.DONE) {
    el.resultText.textContent = state.answer || 'Done.';
  }

  const failed = state.status === STATUS.ERROR || state.status === STATUS.ABORTED;
  el.failure.hidden = !failed;
  if (failed) {
    el.failureText.textContent =
      state.error || 'Stopped at your request.';
  }
}

function renderHistory() {
  el.history.replaceChildren();
  el.historyTitle.hidden = !state.history?.length;

  for (const entry of state.history || []) {
    const li = document.createElement('li');
    if (!entry.result?.ok) li.className = 'failed';

    const n = document.createElement('span');
    n.className = 'n';
    n.textContent = entry.n;

    const body = document.createElement('span');
    const what = document.createElement('span');
    what.textContent = entry.summary;
    const outcome = document.createElement('span');
    outcome.className = 'outcome';
    outcome.textContent = entry.result?.message || (entry.result?.ok ? 'ok' : 'failed');
    body.append(what, outcome);

    li.append(n, body);
    el.history.append(li);
  }
}

// ── user actions ───────────────────────────────────────────────────────────

el.form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const goal = el.goal.value.trim();
  if (!goal) return;
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  send(PANEL_MSG.START, { goal, tabId: tab?.id });
});

el.approve.addEventListener('click', () => {
  const field = el.editWrap.hidden ? null : el.editInput.dataset.field;
  const edits = field ? { [field]: el.editInput.value } : undefined;
  send(PANEL_MSG.APPROVE, { edits });
});

el.skip.addEventListener('click', () => send(PANEL_MSG.SKIP));
el.abort.addEventListener('click', () => send(PANEL_MSG.ABORT));
el.reset.addEventListener('click', () => send(PANEL_MSG.RESET));
el.resetError.addEventListener('click', () => send(PANEL_MSG.RESET));

el.answerForm.addEventListener('submit', (event) => {
  event.preventDefault();
  send(PANEL_MSG.ANSWER, { text: el.answerInput.value });
});

$('open-options').addEventListener('click', () => chrome.runtime.openOptionsPage());
