import { AgentRun } from './src/agent.js';
import { getSettings, saveSettings } from './src/settings.js';
import { listModels } from './src/llm.js';

let current = null;

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel?.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || msg.target !== 'background') return;
  (async () => {
    try {
      switch (msg.type) {
        case 'start':
          sendResponse(await start(msg.goal));
          break;
        case 'stop':
          current?.stop();
          sendResponse({ ok: true });
          break;
        case 'answer':
          current?.provideAnswer(msg.text);
          sendResponse({ ok: true });
          break;
        case 'status':
          sendResponse({ ok: true, running: Boolean(current), goal: current?.goal || null });
          break;
        case 'get-settings':
          sendResponse({ ok: true, settings: await getSettings() });
          break;
        case 'save-settings':
          sendResponse({ ok: true, settings: await saveSettings(msg.patch) });
          break;
        case 'list-models':
          sendResponse({ ok: true, models: await listModels(await getSettings()) });
          break;
        default:
          sendResponse({ ok: false, error: `unknown message ${msg.type}` });
      }
    } catch (err) {
      sendResponse({ ok: false, error: String(err?.message || err) });
    }
  })();
  return true;
});

async function start(goal) {
  if (current) return { ok: false, error: 'a task is already running' };
  const trimmed = String(goal || '').trim();
  if (!trimmed) return { ok: false, error: 'give the agent a goal first' };

  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tab?.id) return { ok: false, error: 'no active tab' };
  if (/^(chrome|edge|about|chrome-extension):/i.test(tab.url || '')) {
    return { ok: false, error: 'browser-internal pages cannot be automated — open a normal web page first' };
  }

  const settings = await getSettings();
  const run = new AgentRun({ goal: trimmed, tabId: tab.id, settings, emit });
  current = run;
  emit({ type: 'started', goal: trimmed, url: tab.url });

  run
    .run()
    .catch((err) => emit({ type: 'finished', status: 'error', message: String(err?.message || err) }))
    .finally(() => {
      if (current === run) current = null;
    });

  return { ok: true };
}

// The side panel may be closed; a failed sendMessage is not an error worth surfacing.
function emit(event) {
  chrome.runtime.sendMessage({ target: 'panel', event }).catch(() => {});
}
