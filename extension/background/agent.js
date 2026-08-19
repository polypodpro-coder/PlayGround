import { getConfig } from './config.js';
import { chat, ACTION_SCHEMA } from './ollama.js';
import { systemPrompt, renderState, summarize } from './prompt.js';

/** Currently running task, if any. */
let current = null;

export function isRunning() {
  return Boolean(current);
}

export function stopTask(reason = 'stopped by user') {
  if (!current) return;
  current.cancelled = reason;
  current.controller.abort();
  current.pendingApproval?.reject(new Error(reason));
}

export function resolveApproval(approved, note) {
  current?.pendingApproval?.resolve({ approved, note });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function ensureContentScript(tabId) {
  try {
    const pong = await chrome.tabs.sendMessage(tabId, { type: 'ping' });
    if (pong?.ok) return;
  } catch {
    // not injected yet (fresh navigation, or the tab predates the extension)
  }
  await chrome.scripting.executeScript({ target: { tabId }, files: ['content/content.js'] });
  await sleep(150);
}

async function send(tabId, message) {
  await ensureContentScript(tabId);
  const res = await chrome.tabs.sendMessage(tabId, message);
  if (!res?.ok) throw new Error(res?.error || 'no response from page');
  return res.data;
}

async function waitForLoad(tabId, timeoutMs = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const tab = await chrome.tabs.get(tabId).catch(() => null);
    if (!tab) throw new Error('the tab was closed');
    if (tab.status === 'complete') {
      await sleep(400); // let client-side rendering catch up
      return;
    }
    await sleep(250);
  }
}

async function screenshot(tabId) {
  const tab = await chrome.tabs.get(tabId);
  const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'jpeg', quality: 55 });
  return dataUrl.split(',')[1];
}

function guardUrl(url) {
  if (!/^https?:\/\//i.test(url)) throw new Error('only http(s) URLs are allowed');
  return url;
}

/**
 * Run a goal to completion on one tab.
 * `emit(event)` streams progress to the side panel.
 */
export async function runTask({ goal, tabId, emit }) {
  if (current) throw new Error('a task is already running');

  const config = await getConfig();
  const controller = new AbortController();
  current = { goal, tabId, controller, cancelled: null, pendingApproval: null };

  const history = [];
  let lastResult = null;

  emit({ type: 'start', goal, model: config.model, maxSteps: config.maxSteps });

  try {
    for (let step = 1; step <= config.maxSteps; step += 1) {
      if (current.cancelled) throw new Error(current.cancelled);

      await waitForLoad(tabId).catch(() => {});
      const state = await send(tabId, { type: 'snapshot' });
      emit({ type: 'page', step, url: state.url, title: state.title });

      const userMessage = {
        role: 'user',
        content: renderState(state, step, config.maxSteps, history, lastResult)
      };
      if (config.useVision) {
        userMessage.images = [await screenshot(tabId).catch(() => null)].filter(Boolean);
      }

      emit({ type: 'thinking', step });
      const decision = await chat({
        endpoint: config.endpoint,
        model: config.model,
        messages: [{ role: 'system', content: systemPrompt(goal, config) }, userMessage],
        schema: ACTION_SCHEMA,
        temperature: config.temperature,
        contextWindow: config.contextWindow,
        signal: controller.signal
      });

      emit({ type: 'decision', step, decision });

      if (decision.action === 'answer') {
        emit({ type: 'done', step, answer: decision.text || '(no answer text)' });
        return;
      }
      if (decision.action === 'ask') {
        emit({ type: 'ask', step, question: decision.text || 'What should I do next?' });
        const { approved, note } = await awaitApproval();
        if (!approved) throw new Error('cancelled at question');
        lastResult = `The user replied: ${note || '(continue)'}`;
        history.push(summarize(decision, lastResult));
        continue;
      }

      if (config.stepMode) {
        emit({ type: 'approval', step, decision });
        const { approved, note } = await awaitApproval();
        if (!approved) throw new Error(note ? `rejected: ${note}` : 'action rejected');
      }

      try {
        lastResult = await performAction(decision, tabId, config);
        emit({ type: 'result', step, result: lastResult });
      } catch (err) {
        // A failed action is information for the model, not the end of the task.
        if (err.name === 'AbortError' || current?.cancelled) throw err;
        lastResult = `ERROR: ${err.message}`;
        emit({ type: 'result', step, result: lastResult, failed: true });
      }
      history.push(summarize(decision, lastResult));
    }

    emit({ type: 'done', answer: `Ran out of steps (${config.maxSteps}) before finishing. Raise the limit in Options or narrow the goal.`, exhausted: true });
  } catch (err) {
    emit({ type: 'error', error: err.name === 'AbortError' ? (current?.cancelled || 'stopped') : err.message });
  } finally {
    current = null;
  }
}

function awaitApproval() {
  return new Promise((resolve, reject) => {
    current.pendingApproval = { resolve, reject };
  }).finally(() => {
    if (current) current.pendingApproval = null;
  });
}

async function performAction(decision, tabId, config) {
  switch (decision.action) {
    case 'navigate': {
      if (!config.allowNavigate) return 'navigation is disabled in settings — use links on the page instead';
      const url = guardUrl(decision.url || decision.text || '');
      await chrome.tabs.update(tabId, { url });
      await waitForLoad(tabId);
      return `opened ${url}`;
    }
    case 'wait':
      await sleep(1500);
      await waitForLoad(tabId).catch(() => {});
      return 'waited for the page to settle';
    default: {
      const result = await send(tabId, { type: 'act', ...decision });
      await waitForLoad(tabId).catch(() => {});
      return result;
    }
  }
}
