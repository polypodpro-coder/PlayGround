// Runs in every page. Two jobs: describe the page compactly for the model,
// and perform the action the model picked. Element ids are per-snapshot.
(() => {
  if (window.__localBrowserAgentInstalled) return;
  window.__localBrowserAgentInstalled = true;

  const MAX_ELEMENTS = 120;
  const MAX_TEXT = 3000;
  const INTERACTIVE_SELECTOR = [
    'a[href]',
    'button',
    'input:not([type="hidden"])',
    'select',
    'textarea',
    'summary',
    '[contenteditable="true"]',
    '[role="button"]',
    '[role="link"]',
    '[role="checkbox"]',
    '[role="radio"]',
    '[role="tab"]',
    '[role="menuitem"]',
    '[role="option"]',
    '[role="switch"]',
    '[role="textbox"]',
    '[role="combobox"]',
    '[onclick]',
    '[tabindex]:not([tabindex="-1"])'
  ].join(',');

  let registry = [];

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg || msg.target !== 'content') return;
    (async () => {
      try {
        switch (msg.type) {
          case 'ping':
            sendResponse({ ok: true });
            break;
          case 'snapshot':
            sendResponse({ ok: true, snapshot: snapshot() });
            break;
          case 'act':
            sendResponse({ ok: true, result: await act(msg.action) });
            break;
          default:
            sendResponse({ ok: false, error: `unknown message ${msg.type}` });
        }
      } catch (err) {
        sendResponse({ ok: false, error: String(err && err.message ? err.message : err) });
      }
    })();
    return true; // async response
  });

  /* ---------- observation ---------- */

  function snapshot() {
    registry = [];
    const candidates = Array.from(document.querySelectorAll(INTERACTIVE_SELECTOR));
    const scored = [];

    for (const el of candidates) {
      if (!isVisible(el)) continue;
      const rect = el.getBoundingClientRect();
      const inViewport = rect.top < innerHeight && rect.bottom > 0 && rect.left < innerWidth && rect.right > 0;
      scored.push({ el, rect, inViewport });
    }

    // In-viewport elements first, then document order, so the budget goes where the user is looking.
    scored.sort((a, b) => (b.inViewport - a.inViewport) || (a.rect.top - b.rect.top));

    const elements = [];
    for (const item of scored.slice(0, MAX_ELEMENTS)) {
      const el = item.el;
      const id = registry.push(el) - 1;
      elements.push({
        id,
        tag: el.tagName.toLowerCase(),
        type: el.getAttribute('type') || el.getAttribute('role') || '',
        name: truncate(labelFor(el), 120),
        value: truncate(valueOf(el), 80),
        placeholder: truncate(el.getAttribute('placeholder') || '', 60),
        href: shortHref(el),
        state: stateOf(el),
        inViewport: item.inViewport
      });
    }

    return {
      url: location.href,
      title: document.title,
      scroll: scrollInfo(),
      elements,
      text: truncate(visibleText(document.body), MAX_TEXT)
    };
  }

  function isVisible(el) {
    const style = getComputedStyle(el);
    if (style.visibility === 'hidden' || style.display === 'none' || style.opacity === '0') return false;
    if (el.hasAttribute('disabled') || el.getAttribute('aria-hidden') === 'true') return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 1 && rect.height > 1;
  }

  function labelFor(el) {
    const aria = el.getAttribute('aria-label');
    if (aria) return aria.trim();

    const labelledBy = el.getAttribute('aria-labelledby');
    if (labelledBy) {
      const text = labelledBy
        .split(/\s+/)
        .map((id) => document.getElementById(id)?.innerText || '')
        .join(' ')
        .trim();
      if (text) return text;
    }

    if (el.id) {
      const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (label?.innerText.trim()) return label.innerText.trim();
    }

    const own = (el.innerText || '').trim();
    if (own) return own.replace(/\s+/g, ' ');

    return (
      el.getAttribute('title') ||
      el.getAttribute('alt') ||
      el.getAttribute('name') ||
      el.querySelector('img[alt]')?.getAttribute('alt') ||
      ''
    ).trim();
  }

  function valueOf(el) {
    if (el.tagName === 'SELECT') return el.selectedOptions?.[0]?.text || '';
    if ('value' in el && typeof el.value === 'string') {
      return el.type === 'password' ? '' : el.value;
    }
    return '';
  }

  function stateOf(el) {
    const parts = [];
    if (el.checked === true) parts.push('checked');
    if (el.getAttribute('aria-expanded')) parts.push(`expanded=${el.getAttribute('aria-expanded')}`);
    if (el.getAttribute('aria-selected') === 'true') parts.push('selected');
    if (el === document.activeElement) parts.push('focused');
    return parts.join(', ');
  }

  function shortHref(el) {
    const href = el.getAttribute('href');
    if (!href || href.startsWith('javascript:')) return '';
    try {
      return truncate(new URL(href, location.href).href, 120);
    } catch {
      return '';
    }
  }

  function scrollInfo() {
    const y = Math.round(scrollY);
    const max = Math.max(0, document.documentElement.scrollHeight - innerHeight);
    if (max === 0) return 'whole page visible';
    return `${y}px of ${Math.round(max)}px (${Math.round((y / max) * 100)}%)`;
  }

  function visibleText(root) {
    if (!root) return '';
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        const tag = parent.tagName;
        if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT') return NodeFilter.FILTER_REJECT;
        if (!isVisible(parent)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    const out = [];
    let total = 0;
    while (walker.nextNode() && total < MAX_TEXT * 2) {
      const t = walker.currentNode.nodeValue.trim().replace(/\s+/g, ' ');
      out.push(t);
      total += t.length;
    }
    return out.join(' ');
  }

  /* ---------- actions ---------- */

  async function act(action) {
    switch (action.name) {
      case 'click': {
        const el = resolve(action.id);
        el.scrollIntoView({ block: 'center', inline: 'center' });
        await sleep(120);
        el.focus?.();
        el.click();
        return `clicked [${action.id}] ${describe(el)}`;
      }
      case 'type': {
        const el = resolve(action.id);
        el.scrollIntoView({ block: 'center' });
        el.focus?.();
        setValue(el, String(action.text ?? ''));
        if (action.submit) {
          await sleep(80);
          pressEnter(el);
          el.form?.requestSubmit?.();
          return `typed into [${action.id}] and pressed Enter`;
        }
        return `typed into [${action.id}] ${describe(el)}`;
      }
      case 'select': {
        const el = resolve(action.id);
        if (el.tagName !== 'SELECT') throw new Error(`element [${action.id}] is not a <select>`);
        const wanted = String(action.value ?? '').toLowerCase();
        const option = Array.from(el.options).find(
          (o) => o.value.toLowerCase() === wanted || o.text.trim().toLowerCase() === wanted
        );
        if (!option) throw new Error(`no option matching "${action.value}"`);
        el.value = option.value;
        fire(el, 'input');
        fire(el, 'change');
        return `selected "${option.text.trim()}"`;
      }
      case 'scroll': {
        const dir = action.direction || 'down';
        if (dir === 'top') scrollTo({ top: 0 });
        else if (dir === 'bottom') scrollTo({ top: document.documentElement.scrollHeight });
        else scrollBy({ top: (dir === 'up' ? -1 : 1) * innerHeight * 0.8 });
        await sleep(300);
        return `scrolled ${dir}; now at ${scrollInfo()}`;
      }
      case 'read': {
        const root = action.selector ? document.querySelector(action.selector) : document.body;
        if (!root) throw new Error(`no element matches selector ${action.selector}`);
        return truncate(visibleText(root), 6000) || '(no visible text)';
      }
      default:
        throw new Error(`content script cannot handle action "${action.name}"`);
    }
  }

  function resolve(id) {
    const el = registry[Number(id)];
    if (!el) throw new Error(`unknown element id ${id} — take a fresh look at the page`);
    if (!el.isConnected) throw new Error(`element [${id}] is gone from the page — observe again`);
    return el;
  }

  function describe(el) {
    return `<${el.tagName.toLowerCase()}> ${truncate(labelFor(el), 60)}`.trim();
  }

  // React and friends track value on the native setter, so bypass the property override.
  function setValue(el, text) {
    if (el.isContentEditable) {
      el.textContent = text;
      fire(el, 'input');
      return;
    }
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (setter) setter.call(el, text);
    else el.value = text;
    fire(el, 'input');
    fire(el, 'change');
  }

  function pressEnter(el) {
    for (const type of ['keydown', 'keypress', 'keyup']) {
      el.dispatchEvent(
        new KeyboardEvent(type, { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true })
      );
    }
  }

  function fire(el, type) {
    el.dispatchEvent(new Event(type, { bubbles: true }));
  }

  function truncate(s, n) {
    const str = String(s || '').trim();
    return str.length > n ? str.slice(0, n) + '…' : str;
  }

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }
})();
