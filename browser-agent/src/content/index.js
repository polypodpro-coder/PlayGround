/**
 * The content script's only job: sit inert until the background asks for
 * something. It never contacts the model, never phones anywhere, and does
 * nothing at all unless a message arrives from this extension.
 *
 * The message-type literals below MUST match CONTENT_MSG in
 * src/shared/protocol.js. Content scripts are loaded as classic scripts and
 * cannot import the ES module, so test/unit.test.mjs asserts they stay in sync.
 */
(() => {
  const agent = (window.__localAgent = window.__localAgent || {});
  if (agent.installed) return;
  agent.installed = true;

  const MSG = {
    PING: 'agent:ping',
    OBSERVE: 'agent:observe',
    EXECUTE: 'agent:execute',
    HIGHLIGHT: 'agent:highlight',
    CLEAR_HIGHLIGHT: 'agent:clear-highlight',
  };

  async function handle(message) {
    switch (message?.type) {
      case MSG.PING:
        return { ok: true, ready: true };

      case MSG.OBSERVE:
        return { ok: true, snapshot: agent.observe() };

      case MSG.EXECUTE:
        return agent.execute(message.action, message.snapshotId);

      case MSG.HIGHLIGHT: {
        const element = agent.resolveRef(message.ref);
        const shown = agent.highlight(element, message.label);
        return { ok: shown };
      }

      case MSG.CLEAR_HIGHLIGHT:
        agent.clearHighlight();
        return { ok: true };

      default:
        return { ok: false, message: `unknown message "${message?.type}"` };
    }
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || typeof message.type !== 'string') return false;
    if (!message.type.startsWith('agent:')) return false;

    handle(message)
      .then(sendResponse)
      .catch((error) => sendResponse({ ok: false, message: String(error?.message || error) }));

    return true; // response is async
  });

  // Any navigation or large re-render invalidates outstanding refs; drop the
  // highlight so a stale ring never sits over an unrelated element.
  window.addEventListener('pagehide', () => agent.clearHighlight());
})();
