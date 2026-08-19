/**
 * Content script: turns the live page into a compact, numbered list of
 * interactive elements the model can reason about, and executes the actions
 * the model picks.
 *
 * Everything here runs in the page's tab; nothing leaves the machine.
 */

const INTERACTIVE_SELECTOR = [
  'a[href]',
  'button',
  'input:not([type="hidden"])',
  'select',
  'textarea',
  'summary',
  '[contenteditable=""]',
  '[contenteditable="true"]',
  '[onclick]',
  '[role="button"]',
  '[role="link"]',
  '[role="checkbox"]',
  '[role="radio"]',
  '[role="switch"]',
  '[role="tab"]',
  '[role="menuitem"]',
  '[role="menuitemcheckbox"]',
  '[role="option"]',
  '[role="combobox"]',
  '[role="searchbox"]',
  '[role="textbox"]',
  '[tabindex]:not([tabindex="-1"])'
].join(',');

const MAX_ELEMENTS = 120;
const MAX_PAGE_TEXT = 4000;

/** ref number -> Element, rebuilt on every snapshot. */
let refs = new Map();

function isVisible(el) {
  const style = window.getComputedStyle(el);
  if (style.visibility === 'hidden' || style.display === 'none') return false;
  if (Number(style.opacity) === 0) return false;
  const rect = el.getBoundingClientRect();
  if (rect.width < 2 || rect.height < 2) return false;
  if (rect.bottom < 0 || rect.right < 0) return false;
  if (rect.top > document.documentElement.scrollHeight) return false;
  if (el.closest('[aria-hidden="true"]')) return false;
  return true;
}

function labelFor(el) {
  const parts = [];
  const push = (v) => {
    if (!v) return;
    const t = String(v).replace(/\s+/g, ' ').trim();
    if (t && !parts.includes(t)) parts.push(t);
  };

  push(el.getAttribute('aria-label'));
  const labelledBy = el.getAttribute('aria-labelledby');
  if (labelledBy) {
    for (const id of labelledBy.split(/\s+/)) {
      push(document.getElementById(id)?.innerText);
    }
  }
  if (el.id) push(document.querySelector(`label[for="${CSS.escape(el.id)}"]`)?.innerText);
  push(el.closest('label')?.innerText);
  push(el.getAttribute('placeholder'));
  push(el.getAttribute('title'));
  push(el.getAttribute('alt'));
  push(el.getAttribute('name'));
  if (el.tagName === 'INPUT' && el.type !== 'password') push(el.value);
  if (el.tagName === 'SELECT') push(el.options[el.selectedIndex]?.text);
  push(el.innerText);

  const label = parts.join(' | ').slice(0, 140);
  return label || '(no label)';
}

function describe(el) {
  const tag = el.tagName.toLowerCase();
  const role = el.getAttribute('role');
  const type = el.getAttribute('type');
  let kind = tag;
  if (tag === 'input') kind = `input:${type || 'text'}`;
  else if (role) kind = `${tag}[${role}]`;

  const flags = [];
  const rect = el.getBoundingClientRect();
  const inViewport = rect.top < window.innerHeight && rect.bottom > 0;
  if (!inViewport) flags.push('offscreen');
  if (el.disabled || el.getAttribute('aria-disabled') === 'true') flags.push('disabled');
  if (el.checked) flags.push('checked');
  if (el === document.activeElement) flags.push('focused');
  if (tag === 'a' && el.href) flags.push(`-> ${el.href.slice(0, 80)}`);

  return { kind, label: labelFor(el), flags };
}

function snapshot() {
  refs = new Map();
  const lines = [];
  let n = 0;

  for (const el of document.querySelectorAll(INTERACTIVE_SELECTOR)) {
    if (n >= MAX_ELEMENTS) break;
    if (!isVisible(el)) continue;
    refs.set(n, el);
    const { kind, label, flags } = describe(el);
    lines.push(`[${n}] <${kind}> ${label}${flags.length ? ` (${flags.join(', ')})` : ''}`);
    n += 1;
  }

  const text = (document.body?.innerText || '').replace(/\n{3,}/g, '\n\n').trim();
  const scrollY = Math.round(window.scrollY);
  const scrollMax = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);

  return {
    url: location.href,
    title: document.title,
    elements: lines.join('\n') || '(no interactive elements found)',
    truncatedElements: n >= MAX_ELEMENTS,
    pageText: text.slice(0, MAX_PAGE_TEXT),
    pageTextTruncated: text.length > MAX_PAGE_TEXT,
    scroll: scrollMax === 0 ? 'page fits on screen' : `${scrollY}px of ${scrollMax}px scrolled`
  };
}

function resolve(ref) {
  const el = refs.get(Number(ref));
  if (!el || !el.isConnected) {
    throw new Error(`no element with ref ${ref} on the current page — take a fresh look first`);
  }
  return el;
}

function flash(el) {
  const prev = el.style.outline;
  el.style.outline = '3px solid #7c5cff';
  setTimeout(() => { el.style.outline = prev; }, 600);
}

/** Set a value in a way React/Vue controlled inputs actually notice. */
function setNativeValue(el, value) {
  const proto = el instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  if (setter) setter.call(el, value);
  else el.value = value;
}

async function typeInto(el, text, submit) {
  el.scrollIntoView({ block: 'center', behavior: 'instant' });
  el.focus();
  if (el.isContentEditable) {
    el.textContent = '';
    document.execCommand('insertText', false, text);
  } else {
    setNativeValue(el, '');
    el.dispatchEvent(new Event('input', { bubbles: true }));
    setNativeValue(el, text);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }
  if (submit) {
    for (const type of ['keydown', 'keypress', 'keyup']) {
      el.dispatchEvent(new KeyboardEvent(type, {
        key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true
      }));
    }
    el.form?.requestSubmit?.();
  }
}

const actions = {
  click({ ref }) {
    const el = resolve(ref);
    el.scrollIntoView({ block: 'center', behavior: 'instant' });
    flash(el);
    el.focus?.();
    el.click();
    return `clicked [${ref}] ${labelFor(el)}`;
  },

  async type({ ref, text, submit }) {
    const el = resolve(ref);
    flash(el);
    await typeInto(el, text ?? '', Boolean(submit));
    return `typed ${JSON.stringify(text ?? '')} into [${ref}]${submit ? ' and pressed Enter' : ''}`;
  },

  select({ ref, text }) {
    const el = resolve(ref);
    if (el.tagName !== 'SELECT') throw new Error(`[${ref}] is not a <select>`);
    const option = [...el.options].find(
      (o) => o.text.trim().toLowerCase() === String(text).trim().toLowerCase()
    ) || [...el.options].find(
      (o) => o.text.toLowerCase().includes(String(text).toLowerCase())
    );
    if (!option) throw new Error(`no option matching ${JSON.stringify(text)}; options: ${[...el.options].map((o) => o.text).join(' / ')}`);
    el.value = option.value;
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return `selected ${JSON.stringify(option.text)} in [${ref}]`;
  },

  scroll({ direction = 'down', ref }) {
    if (ref !== undefined && ref !== null) {
      resolve(ref).scrollIntoView({ block: 'center', behavior: 'instant' });
      return `scrolled [${ref}] into view`;
    }
    const amount = Math.round(window.innerHeight * 0.8);
    const map = {
      down: [0, amount], up: [0, -amount],
      top: [0, -document.documentElement.scrollHeight],
      bottom: [0, document.documentElement.scrollHeight]
    };
    const [x, y] = map[direction] || map.down;
    window.scrollBy(x, y);
    return `scrolled ${direction}`;
  },

  press({ text = 'Enter' }) {
    const el = document.activeElement || document.body;
    for (const type of ['keydown', 'keypress', 'keyup']) {
      el.dispatchEvent(new KeyboardEvent(type, { key: text, bubbles: true, cancelable: true }));
    }
    return `pressed ${text}`;
  },

  extract({ text }) {
    const body = (document.body?.innerText || '').replace(/\n{3,}/g, '\n\n');
    if (!text) return body.slice(0, 6000);
    const needle = String(text).toLowerCase();
    const hits = body.split('\n').filter((line) => line.toLowerCase().includes(needle));
    return hits.length ? hits.slice(0, 40).join('\n') : `no lines containing ${JSON.stringify(text)}`;
  }
};

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    try {
      if (msg.type === 'ping') return sendResponse({ ok: true });
      if (msg.type === 'snapshot') return sendResponse({ ok: true, data: snapshot() });
      if (msg.type === 'act') {
        const fn = actions[msg.action];
        if (!fn) throw new Error(`unknown action ${msg.action}`);
        const result = await fn(msg);
        return sendResponse({ ok: true, data: result });
      }
      throw new Error(`unknown message ${msg.type}`);
    } catch (err) {
      sendResponse({ ok: false, error: err.message });
    }
  })();
  return true; // keep the channel open for the async reply
});
