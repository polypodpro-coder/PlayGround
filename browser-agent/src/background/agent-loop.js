/**
 * The run state machine.
 *
 *   observe → think → propose → (BLOCK for approval) → execute → observe → …
 *
 * The block is the whole point. Nothing touches the page until the user has
 * seen the proposed action, seen the element highlighted on the page, and said
 * yes. That is what makes a 4B model safe to point at a real website.
 */

import {
  APPROVAL_MODES,
  CONTENT_MSG,
  STATUS,
  TERMINAL_STATUSES,
  resolveApprovalMode,
} from '../shared/protocol.js';
import {
  describeAction,
  isCheckpointAction,
  isHostAllowed,
  validateAction,
} from '../shared/action-schema.js';
import { buildMessages } from './prompt.js';
import { requestAction, LlmError } from './llm-client.js';
import { clearRun, emptyRun, getSettings, loadRun, saveRun } from './state.js';

/** How many malformed model replies in a row before we give up on the run. */
const MAX_INVALID_RETRIES = 2;
const TAB_LOAD_TIMEOUT_MS = 15000;

let run = emptyRun();
let listeners = new Set();
let hydrated = false;
let invalidStreak = 0;
let lastValidationError = null;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ── plumbing ───────────────────────────────────────────────────────────────

export function subscribe(listener) {
  listeners.add(listener);
  listener(publicRun());
  return () => listeners.delete(listener);
}

/**
 * What the side panel sees. The full snapshot stays in the worker — the panel
 * only needs to know where we are, not every element on the page.
 */
export function publicRun() {
  return {
    id: run.id,
    goal: run.goal,
    tabId: run.tabId,
    status: run.status,
    step: run.step,
    maxSteps: run.maxSteps,
    provider: run.provider,
    approvalMode: run.approvalMode,
    history: run.history,
    pending: run.pending,
    answer: run.answer,
    error: run.error,
    page: run.snapshot
      ? {
          url: run.snapshot.url,
          title: run.snapshot.title,
          elementCount: run.snapshot.elements.length,
        }
      : null,
  };
}

async function commit() {
  await saveRun(run);
  const view = publicRun();
  for (const listener of listeners) {
    try {
      listener(view);
    } catch {
      // A dead port is not the run's problem.
    }
  }
}

export async function hydrate() {
  if (hydrated) return;
  run = await loadRun();
  hydrated = true;
  // A run interrupted mid-flight by a worker restart cannot be resumed
  // mid-action; park it in a state the user can act on.
  if ([STATUS.OBSERVING, STATUS.THINKING, STATUS.EXECUTING].includes(run.status)) {
    run.status = STATUS.ERROR;
    run.error = 'The extension restarted mid-step. Start the goal again.';
    await commit();
  }
}

// ── tab helpers ────────────────────────────────────────────────────────────

function isInjectable(url) {
  return /^https?:|^file:/.test(url || '');
}

async function ensureContentScript(tabId) {
  try {
    const pong = await chrome.tabs.sendMessage(tabId, { type: CONTENT_MSG.PING });
    if (pong?.ready) return;
  } catch {
    // Not there yet — inject below.
  }

  const tab = await chrome.tabs.get(tabId);
  if (!isInjectable(tab.url)) {
    throw new Error(
      `This agent cannot run on ${tab.url || 'this page'}. Chrome blocks ` +
        `extensions on browser-internal pages — open a normal website first.`,
    );
  }

  await chrome.scripting.executeScript({
    target: { tabId },
    files: [
      'src/content/highlight.js',
      'src/content/observer.js',
      'src/content/actuator.js',
      'src/content/index.js',
    ],
  });
}

function waitForTabComplete(tabId) {
  return new Promise((resolve) => {
    const done = () => {
      chrome.tabs.onUpdated.removeListener(onUpdated);
      clearTimeout(timer);
      resolve();
    };
    const onUpdated = (changedId, info) => {
      if (changedId === tabId && info.status === 'complete') done();
    };
    const timer = setTimeout(done, TAB_LOAD_TIMEOUT_MS);
    chrome.tabs.onUpdated.addListener(onUpdated);

    chrome.tabs.get(tabId).then((tab) => {
      if (tab.status === 'complete') done();
    }).catch(done);
  });
}

async function observePage() {
  await ensureContentScript(run.tabId);
  const response = await chrome.tabs.sendMessage(run.tabId, {
    type: CONTENT_MSG.OBSERVE,
  });
  if (!response?.ok) throw new Error(response?.message || 'Could not read the page.');
  return response.snapshot;
}

async function highlightPending() {
  const action = run.pending?.action;
  if (!action || action.ref === undefined) return;
  try {
    await chrome.tabs.sendMessage(run.tabId, {
      type: CONTENT_MSG.HIGHLIGHT,
      ref: action.ref,
      label: `${action.tool} [${action.ref}]`,
    });
  } catch {
    // Highlighting is a courtesy, never a blocker.
  }
}

async function clearHighlight() {
  try {
    await chrome.tabs.sendMessage(run.tabId, { type: CONTENT_MSG.CLEAR_HIGHLIGHT });
  } catch {
    // ditto
  }
}

// ── run lifecycle ──────────────────────────────────────────────────────────

export async function startRun(goal, tabId) {
  await hydrate();
  const settings = await getSettings();

  run = {
    ...emptyRun(),
    id: `r${Date.now().toString(36)}`,
    goal: String(goal || '').trim(),
    tabId,
    maxSteps: settings.maxSteps,
    provider: settings.provider,
    approvalMode: resolveApprovalMode(settings),
    startedAt: Date.now(),
  };
  invalidStreak = 0;
  lastValidationError = null;

  if (!run.goal) {
    return finish(STATUS.ERROR, { error: 'Give the agent a goal first.' });
  }

  await commit();
  return tick();
}

export async function abort() {
  await hydrate();
  if (TERMINAL_STATUSES.includes(run.status)) return;
  await clearHighlight();
  run.pending = null;
  return finish(STATUS.ABORTED, {});
}

export async function reset() {
  await clearHighlight().catch(() => {});
  run = emptyRun();
  await clearRun();
  await commit();
}

async function finish(status, { error = null, answer = null } = {}) {
  run.status = status;
  run.error = error;
  run.answer = answer;
  run.pending = null;
  await commit();
}

/** Push a completed step onto the history and continue. */
async function recordAndContinue(action, result) {
  run.history.push({
    n: run.step + 1,
    summary: describeAction(action),
    reasoning: action.reasoning || '',
    tool: action.tool,
    result: { ok: !!result.ok, message: result.message || '' },
  });
  run.step += 1;
  run.pending = null;
  await commit();
  return tick();
}

// ── the loop ───────────────────────────────────────────────────────────────

async function tick() {
  if (TERMINAL_STATUSES.includes(run.status)) return;

  if (run.step >= run.maxSteps) {
    return finish(STATUS.ERROR, {
      error: `Stopped after ${run.maxSteps} steps without finishing. ` +
        `Raise the step limit in Options, or give a narrower goal.`,
    });
  }

  // 1. Read the page.
  try {
    run.status = STATUS.OBSERVING;
    await commit();
    run.snapshot = await observePage();
  } catch (error) {
    return finish(STATUS.ERROR, { error: String(error?.message || error) });
  }

  // 2. Ask the model for one action.
  let raw;
  try {
    run.status = STATUS.THINKING;
    await commit();
    const settings = await getSettings();
    const messages = buildMessages({
      goal: run.goal,
      history: run.history,
      snapshot: run.snapshot,
      lastError: lastValidationError,
      approvalMode: run.approvalMode,
    });
    ({ raw } = await requestAction(messages, settings));
  } catch (error) {
    const hint =
      error instanceof LlmError
        ? error.message
        : `Unexpected error talking to the model: ${error?.message || error}`;
    return finish(STATUS.ERROR, { error: hint });
  }

  // 3. Check it makes sense against the page we actually showed it.
  const validated = validateAction(raw, run.snapshot);
  if (!validated.ok) {
    invalidStreak += 1;
    lastValidationError = validated.error;
    if (invalidStreak > MAX_INVALID_RETRIES) {
      return finish(STATUS.ERROR, {
        error:
          `The model produced ${invalidStreak} unusable actions in a row. ` +
          `Last problem: ${validated.error} — try a larger model.`,
      });
    }
    return tick();
  }
  invalidStreak = 0;
  lastValidationError = null;

  const action = validated.action;

  // 4. Terminal tools need no approval — nothing happens to the page.
  if (action.tool === 'done') {
    return finish(STATUS.DONE, { answer: action.summary });
  }

  const settings = await getSettings();
  const offAllowlist =
    action.tool === 'navigate' && !isHostAllowed(action.url, settings.allowlist);

  // 5. A question always blocks — that one isn't about trust, it's about
  // missing information the run cannot proceed without.
  if (action.tool === 'ask_user') {
    run.pending = { action, snapshotId: run.snapshot.snapshotId, description: describeAction(action) };
    run.status = STATUS.AWAITING_ANSWER;
    await commit();
    return;
  }

  // 6. Everything else is gated by the run's approval mode. In checkpoint
  // mode (Gemini's default — reliable enough to trust) only a form submit, an
  // off-allowlist navigation, or something the model itself flagged sensitive
  // pauses; the rest runs immediately. every-step and manual gate everything,
  // which is what keeps a small local model safe.
  const needsApproval =
    run.approvalMode !== APPROVAL_MODES.CHECKPOINTS || isCheckpointAction(action, settings.allowlist);

  if (!needsApproval) {
    return runAction(action, run.snapshot.snapshotId);
  }

  run.pending = {
    action,
    snapshotId: run.snapshot.snapshotId,
    description: describeAction(action),
    offAllowlist,
  };
  run.status = STATUS.AWAITING_APPROVAL;
  await commit();
  await highlightPending();
}

// ── user decisions ─────────────────────────────────────────────────────────

/** Run an action against the page and record what happened. Shared by the
 * checkpoint auto-run path (tick) and the user-approved path (approve). */
async function runAction(action, snapshotId) {
  run.status = STATUS.EXECUTING;
  await commit();
  await clearHighlight();

  let result;
  try {
    result = action.tool === 'navigate'
      ? await executeNavigate(action)
      : await executeInPage(action, snapshotId);
  } catch (error) {
    result = { ok: false, message: String(error?.message || error) };
  }

  return recordAndContinue(action, result);
}

/**
 * @param {object} [edits]  Optional field overrides from the panel, e.g. a
 *                          corrected `text` or `url` before running the action.
 */
export async function approve(edits) {
  await hydrate();
  if (run.status !== STATUS.AWAITING_APPROVAL || !run.pending) return;

  const action = { ...run.pending.action, ...(edits || {}) };
  const { snapshotId } = run.pending;
  return runAction(action, snapshotId);
}

/** User rejected this action; tell the model so it tries something else. */
export async function skip() {
  await hydrate();
  if (!run.pending) return;
  await clearHighlight();
  const action = run.pending.action;
  return recordAndContinue(action, {
    ok: false,
    message: 'the user rejected this action — try a different approach',
  });
}

/** User answered an ask_user question. */
export async function answer(text) {
  await hydrate();
  if (run.status !== STATUS.AWAITING_ANSWER || !run.pending) return;
  const action = run.pending.action;
  return recordAndContinue(action, {
    ok: true,
    message: `the user answered: ${String(text || '').trim() || '(no answer)'}`,
  });
}

// ── action execution ───────────────────────────────────────────────────────

async function executeNavigate(action) {
  await chrome.tabs.update(run.tabId, { url: action.url });
  await waitForTabComplete(run.tabId);
  await sleep(300);
  const tab = await chrome.tabs.get(run.tabId);
  return { ok: true, message: `loaded ${tab.url}` };
}

async function executeInPage(action, snapshotId) {
  try {
    const result = await chrome.tabs.sendMessage(run.tabId, {
      type: CONTENT_MSG.EXECUTE,
      action,
      snapshotId,
    });
    if (result?.navigated) await waitForTabComplete(run.tabId);
    return result || { ok: false, message: 'no response from the page' };
  } catch (error) {
    // A click that triggers a navigation tears down the content script before
    // it can reply. That is a success, not a failure — wait for the new page.
    if (['click', 'type'].includes(action.tool)) {
      await waitForTabComplete(run.tabId);
      const tab = await chrome.tabs.get(run.tabId);
      return { ok: true, message: `page navigated to ${tab.url}` };
    }
    throw error;
  }
}
