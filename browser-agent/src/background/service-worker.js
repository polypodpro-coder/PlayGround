/**
 * Message router and lifecycle owner.
 *
 * The side panel holds a long-lived port to this worker. That connection is
 * doing double duty: it carries state updates, and it keeps the service worker
 * alive while the panel is open — which matters because a step-by-step approval
 * loop spends most of its life idle, waiting for a human, and Chrome kills idle
 * MV3 workers after ~30 seconds.
 */

import { BG_MSG, PANEL_MSG, PORT_NAME } from '../shared/protocol.js';
import {
  abort,
  answer,
  approve,
  hydrate,
  publicRun,
  reset,
  skip,
  startRun,
  subscribe,
} from './agent-loop.js';

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch(() => {});
});

async function resolveTargetTab(preferredTabId) {
  if (preferredTabId) {
    try {
      return await chrome.tabs.get(preferredTabId);
    } catch {
      // Tab is gone; fall through to the active one.
    }
  }
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return tab;
}

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== PORT_NAME) return;

  const unsubscribe = subscribe((state) => {
    try {
      port.postMessage({ type: BG_MSG.STATE, state });
    } catch {
      // Panel closed between the state change and this post.
    }
  });

  port.onDisconnect.addListener(unsubscribe);

  port.onMessage.addListener(async (message) => {
    try {
      switch (message?.type) {
        case PANEL_MSG.HELLO:
          await hydrate();
          port.postMessage({ type: BG_MSG.STATE, state: publicRun() });
          break;

        case PANEL_MSG.START: {
          const tab = await resolveTargetTab(message.tabId);
          if (!tab) throw new Error('No active tab to work in.');
          await startRun(message.goal, tab.id);
          break;
        }

        case PANEL_MSG.APPROVE:
          await approve(message.edits);
          break;

        case PANEL_MSG.SKIP:
          await skip();
          break;

        case PANEL_MSG.ANSWER:
          await answer(message.text);
          break;

        case PANEL_MSG.ABORT:
          await abort();
          break;

        case PANEL_MSG.RESET:
          await reset();
          break;

        default:
          break;
      }
    } catch (error) {
      port.postMessage({
        type: BG_MSG.STATE,
        state: { ...publicRun(), status: 'error', error: String(error?.message || error) },
      });
    }
  });
});
