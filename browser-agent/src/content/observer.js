/**
 * Turns the live page into something a 4B model can actually read: a numbered
 * list of interactive elements plus a short text digest.
 *
 * Raw HTML is hopeless here — a single modern page is tens of thousands of
 * tokens of mostly-noise. What the model gets instead looks like:
 *
 *   [1] input type=email placeholder="Email" value=""
 *   [2] button "Sign in"
 *
 * Refs are handed out per snapshot and held in a Map on this side. Every
 * snapshot carries a fresh `snapshotId`; the actuator refuses to act on a ref
 * from a stale snapshot, which is what stops the model from clicking [7] on a
 * page that has since navigated away.
 *
 * Classic content script — see the note in src/shared/protocol.js.
 */
(() => {
  const agent = (window.__localAgent = window.__localAgent || {});

  const MAX_ELEMENTS = 80;
  const MAX_TEXT_CHARS = 1500;
  const MAX_LABEL_CHARS = 80;
  const MAX_VALUE_CHARS = 60;

  const INTERACTIVE_SELECTOR = [
    'a[href]',
    'button',
    'input',
    'select',
    'textarea',
    'summary',
    '[contenteditable=""]',
    '[contenteditable="true"]',
    '[role="button"]',
    '[role="link"]',
    '[role="checkbox"]',
    '[role="radio"]',
    '[role="tab"]',
    '[role="menuitem"]',
    '[role="option"]',
    '[role="switch"]',
    '[role="searchbox"]',
    '[role="textbox"]',
    '[onclick]',
  ].join(',');

  /** ref -> Element for the most recent snapshot only. */
  let refMap = new Map();
  let currentSnapshotId = null;

  function squash(value, max) {
    if (!value) return '';
    const flat = String(value).replace(/\s+/g, ' ').trim();
    return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
  }

  function isVisible(element) {
    if (element.checkVisibility) {
      // Chrome 105+. Catches display:none, visibility:hidden, content-visibility
      // and zero opacity in one call.
      if (!element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) {
        return false;
      }
    } else {
      const style = getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      if (Number(style.opacity) <= 0.05) return false;
    }
    const rect = element.getBoundingClientRect();
    return rect.width > 1 && rect.height > 1;
  }

  function isNearViewport(element) {
    const rect = element.getBoundingClientRect();
    const h = window.innerHeight || 800;
    return rect.bottom > -h && rect.top < h * 2;
  }

  function isInViewport(element) {
    const rect = element.getBoundingClientRect();
    return rect.bottom > 0 && rect.top < (window.innerHeight || 800);
  }

  /** Best available human label, in descending order of trustworthiness. */
  function labelFor(element) {
    const aria = element.getAttribute('aria-label');
    if (aria) return squash(aria, MAX_LABEL_CHARS);

    const labelledBy = element.getAttribute('aria-labelledby');
    if (labelledBy) {
      const text = labelledBy
        .split(/\s+/)
        .map((id) => document.getElementById(id)?.innerText || '')
        .join(' ');
      if (text.trim()) return squash(text, MAX_LABEL_CHARS);
    }

    if (element.labels && element.labels.length) {
      const text = Array.from(element.labels)
        .map((l) => l.innerText)
        .join(' ');
      if (text.trim()) return squash(text, MAX_LABEL_CHARS);
    }

    const own = squash(element.innerText || element.textContent, MAX_LABEL_CHARS);
    if (own) return own;

    return squash(
      element.getAttribute('placeholder') ||
        element.getAttribute('title') ||
        element.getAttribute('name') ||
        element.getAttribute('alt') ||
        (element.tagName === 'INPUT' ? element.value : '') ||
        '',
      MAX_LABEL_CHARS,
    );
  }

  /** Coarse kind, chosen so the model can tell what it may do with the element. */
  function kindFor(element) {
    const tag = element.tagName.toLowerCase();
    const role = (element.getAttribute('role') || '').toLowerCase();

    if (tag === 'select') return 'select';
    if (tag === 'textarea') return 'textarea';
    if (tag === 'a') return 'link';
    if (tag === 'button' || role === 'button') return 'button';
    if (tag === 'input') {
      const type = (element.type || 'text').toLowerCase();
      if (type === 'checkbox' || type === 'radio') return type;
      if (type === 'submit' || type === 'button' || type === 'reset') return 'button';
      return 'input';
    }
    if (element.isContentEditable) return 'editable';
    if (role) return role;
    return tag;
  }

  function serialize(element, ref) {
    const kind = kindFor(element);
    const type = element.tagName === 'INPUT' ? (element.type || 'text').toLowerCase() : '';
    const secret = type === 'password';

    const item = {
      ref,
      tag: kind,
      label: labelFor(element),
      inViewport: isInViewport(element),
    };

    if (type && type !== 'text') item.type = type;
    if (element.disabled) item.disabled = true;

    if (kind === 'checkbox' || kind === 'radio') {
      item.checked = !!element.checked;
    } else if (secret) {
      // The value of a password field is never read into the observation, so it
      // never reaches the model, the prompt, or the log.
      item.secret = true;
      item.value = element.value ? '(set)' : '';
    } else if (kind === 'input' || kind === 'textarea' || kind === 'editable') {
      item.value = squash(element.value ?? element.innerText, MAX_VALUE_CHARS);
    } else if (kind === 'select') {
      item.value = squash(element.value, MAX_VALUE_CHARS);
      item.options = Array.from(element.options || [])
        .slice(0, 12)
        .map((o) => squash(o.value || o.text, 40));
    }

    if (kind === 'link') {
      const href = element.getAttribute('href') || '';
      if (href && !href.startsWith('javascript:')) {
        item.href = squash(element.href, 100);
      }
    }

    if (isFormSubmit(element)) item.formSubmit = true;

    return item;
  }

  /** True for a button/input that submits its enclosing form when clicked. */
  function isFormSubmit(element) {
    if (!element.form) return false;
    const tag = element.tagName.toLowerCase();
    if (tag === 'button') {
      const type = (element.getAttribute('type') || 'submit').toLowerCase();
      return type === 'submit';
    }
    if (tag === 'input') {
      return (element.type || '').toLowerCase() === 'submit';
    }
    return false;
  }

  function textDigest() {
    const main =
      document.querySelector('main') ||
      document.querySelector('[role="main"]') ||
      document.body;
    if (!main) return '';
    return squash(main.innerText, MAX_TEXT_CHARS);
  }

  /**
   * Build a fresh snapshot. Invalidates all previously issued refs.
   * @returns {object} plain, structured-cloneable snapshot
   */
  agent.observe = function observe() {
    const candidates = Array.from(document.querySelectorAll(INTERACTIVE_SELECTOR))
      .filter(isVisible);

    // Only trim to the viewport when there is genuinely too much to send — on a
    // small page the model benefits from seeing everything, including what it
    // would have to scroll to reach.
    let chosen = candidates;
    if (chosen.length > MAX_ELEMENTS) chosen = chosen.filter(isNearViewport);
    const truncated = chosen.length > MAX_ELEMENTS;
    if (truncated) chosen = chosen.slice(0, MAX_ELEMENTS);

    refMap = new Map();
    const elements = chosen.map((element, index) => {
      const ref = index + 1;
      refMap.set(ref, element);
      return serialize(element, ref);
    });

    currentSnapshotId = `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

    return {
      snapshotId: currentSnapshotId,
      url: location.href,
      title: document.title,
      scrollY: Math.round(window.scrollY),
      scrollHeight: Math.round(document.documentElement.scrollHeight),
      elements,
      truncated,
      hiddenCount: candidates.length - chosen.length,
      text: textDigest(),
    };
  };

  agent.resolveRef = function resolveRef(ref) {
    return refMap.get(Number(ref)) || null;
  };

  agent.currentSnapshotId = function currentSnapshotIdFn() {
    return currentSnapshotId;
  };
})();
