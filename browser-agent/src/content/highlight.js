/**
 * A ring drawn over the element an action is about to touch, so the user can
 * see what they are approving before they approve it.
 *
 * Classic content script (see the note in src/shared/protocol.js). Everything
 * hangs off the shared `window.__localAgent` namespace.
 */
(() => {
  const agent = (window.__localAgent = window.__localAgent || {});

  const OVERLAY_ID = '__local-agent-highlight';
  const LABEL_ID = '__local-agent-highlight-label';

  let overlay = null;
  let label = null;
  let trackedElement = null;
  let rafId = null;

  function build() {
    if (overlay && overlay.isConnected) return;

    overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    Object.assign(overlay.style, {
      position: 'fixed',
      zIndex: '2147483647',
      pointerEvents: 'none',
      border: '2px solid #f59e0b',
      borderRadius: '4px',
      boxShadow: '0 0 0 3px rgba(245, 158, 11, 0.25)',
      transition: 'top 60ms linear, left 60ms linear',
      display: 'none',
    });

    label = document.createElement('div');
    label.id = LABEL_ID;
    Object.assign(label.style, {
      position: 'absolute',
      top: '-22px',
      left: '-2px',
      padding: '1px 6px',
      background: '#f59e0b',
      color: '#1c1917',
      font: '600 11px/16px ui-sans-serif, system-ui, sans-serif',
      borderRadius: '3px',
      whiteSpace: 'nowrap',
    });
    overlay.appendChild(label);

    (document.body || document.documentElement).appendChild(overlay);
  }

  function reposition() {
    if (!trackedElement || !trackedElement.isConnected) {
      agent.clearHighlight();
      return;
    }
    const rect = trackedElement.getBoundingClientRect();
    Object.assign(overlay.style, {
      display: 'block',
      top: `${rect.top - 2}px`,
      left: `${rect.left - 2}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
    });
    rafId = requestAnimationFrame(reposition);
  }

  /**
   * @param {Element} element
   * @param {string} text  Short caption, e.g. "click [12]".
   */
  agent.highlight = function highlight(element, text) {
    agent.clearHighlight();
    if (!element || !element.isConnected) return false;
    build();
    trackedElement = element;
    label.textContent = text || '';
    element.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
    reposition();
    return true;
  };

  agent.clearHighlight = function clearHighlight() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    trackedElement = null;
    if (overlay) overlay.style.display = 'none';
  };
})();
