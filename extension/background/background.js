import { runTask, stopTask, resolveApproval, isRunning } from './agent.js';
import { getConfig, setConfig } from './config.js';
import { listModels } from './ollama.js';

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
});

/** Side panel connects here; every agent event is pushed down this port. */
let panel = null;

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'agent') return;
  panel = port;
  port.onDisconnect.addListener(() => {
    if (panel === port) panel = null;
    stopTask('side panel closed');
  });

  port.onMessage.addListener(async (msg) => {
    try {
      if (msg.type === 'run') {
        if (isRunning()) return emit({ type: 'error', error: 'a task is already running' });
        const tabId = msg.tabId ?? (await activeTabId());
        await runTask({ goal: msg.goal, tabId, emit });
      } else if (msg.type === 'stop') {
        stopTask();
      } else if (msg.type === 'approval') {
        resolveApproval(msg.approved, msg.note);
      }
    } catch (err) {
      emit({ type: 'error', error: err.message });
    }
  });
});

function emit(event) {
  try {
    panel?.postMessage(event);
  } catch {
    // panel went away mid-task; the disconnect handler stops the run
  }
}

async function activeTabId() {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tab) throw new Error('no active tab');
  if (/^(chrome|edge|about|chrome-extension):/i.test(tab.url || '')) {
    throw new Error('open a normal web page first — the agent cannot act on browser pages');
  }
  return tab.id;
}

/** One-shot requests from the side panel and options page. */
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    try {
      if (msg.type === 'getConfig') return sendResponse({ ok: true, data: await getConfig() });
      if (msg.type === 'setConfig') return sendResponse({ ok: true, data: await setConfig(msg.patch) });
      if (msg.type === 'listModels') {
        const { endpoint } = await getConfig();
        return sendResponse({ ok: true, data: await listModels(msg.endpoint || endpoint) });
      }
      if (msg.type === 'activeTab') {
        const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
        return sendResponse({ ok: true, data: { id: tab?.id, url: tab?.url, title: tab?.title } });
      }
      throw new Error(`unknown message ${msg.type}`);
    } catch (err) {
      sendResponse({ ok: false, error: err.message });
    }
  })();
  return true;
});
