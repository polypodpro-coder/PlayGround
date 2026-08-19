/**
 * Executes an approved action against the page.
 *
 * Two things here are less obvious than they look:
 *
 *  - Typing. Assigning `element.value = text` is invisible to React and most
 *    other frameworks, because they track the value through a property
 *    descriptor on the prototype. We call the *native* setter and then dispatch
 *    the input/change events by hand, which is what a real keystroke does.
 *  - Staleness. Every action carries the id of the snapshot the model was
 *    looking at. If the page changed since, the refs mean nothing and we refuse
 *    rather than clicking whatever now happens to be element [7].
 *
 * Classic content script — see the note in src/shared/protocol.js.
 */
(() => {
  const agent = (window.__localAgent = window.__localAgent || {});

  const SETTLE_MS = 400;

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function ok(message, extra = {}) {
    return { ok: true, message, ...extra };
  }

  function err(message) {
    return { ok: false, message };
  }

  /** Set a form value the way a real keystroke would, so frameworks notice. */
  function setNativeValue(element, value) {
    const proto =
      element instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (setter) {
      setter.call(element, value);
    } else {
      element.value = value;
    }
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function pressEnter(element) {
    for (const type of ['keydown', 'keypress', 'keyup']) {
      element.dispatchEvent(
        new KeyboardEvent(type, {
          key: 'Enter',
          code: 'Enter',
          keyCode: 13,
          which: 13,
          bubbles: true,
          cancelable: true,
        }),
      );
    }
    const form = element.form;
    if (form && typeof form.requestSubmit === 'function') {
      form.requestSubmit();
    }
  }

  async function doClick(element) {
    element.scrollIntoView({ block: 'center', inline: 'center' });
    await sleep(60);
    if (typeof element.focus === 'function') {
      element.focus({ preventScroll: true });
    }
    element.click();
    return ok('clicked');
  }

  async function doType(element, text, submit) {
    element.scrollIntoView({ block: 'center', inline: 'center' });
    await sleep(60);
    element.focus({ preventScroll: true });

    if (element.isContentEditable) {
      element.textContent = text;
      element.dispatchEvent(new Event('input', { bubbles: true }));
    } else if ('value' in element) {
      setNativeValue(element, text);
    } else {
      return err('that element cannot accept text');
    }

    if (submit) {
      await sleep(60);
      pressEnter(element);
      return ok('typed and submitted');
    }
    return ok('typed');
  }

  function doSelect(element, value) {
    if (!(element instanceof HTMLSelectElement)) {
      return err('that element is not a dropdown');
    }
    const target = String(value).toLowerCase();
    const match = Array.from(element.options).find(
      (o) =>
        o.value.toLowerCase() === target ||
        o.text.trim().toLowerCase() === target ||
        o.text.trim().toLowerCase().includes(target),
    );
    if (!match) {
      const available = Array.from(element.options)
        .slice(0, 8)
        .map((o) => o.text.trim())
        .join(', ');
      return err(`no option matching "${value}". Available: ${available}`);
    }
    element.value = match.value;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    return ok(`selected "${match.text.trim()}"`);
  }

  function doScroll(direction) {
    const page = Math.round((window.innerHeight || 800) * 0.85);
    switch (direction) {
      case 'up':
        window.scrollBy({ top: -page, behavior: 'instant' });
        break;
      case 'top':
        window.scrollTo({ top: 0, behavior: 'instant' });
        break;
      case 'bottom':
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' });
        break;
      default:
        window.scrollBy({ top: page, behavior: 'instant' });
    }
    return ok(`scrolled ${direction}, now at y=${Math.round(window.scrollY)}`);
  }

  /**
   * @param {object} action    Validated action from the background.
   * @param {string} snapshotId  The snapshot the model was shown.
   */
  agent.execute = async function execute(action, snapshotId) {
    if (snapshotId && snapshotId !== agent.currentSnapshotId()) {
      return err('the page changed since this action was planned; re-reading the page');
    }

    const before = { url: location.href, title: document.title };

    let element = null;
    if (action.ref !== undefined) {
      element = agent.resolveRef(action.ref);
      if (!element) return err(`element [${action.ref}] is no longer on the page`);
      if (!element.isConnected) return err(`element [${action.ref}] was removed`);
      if (element.disabled) return err(`element [${action.ref}] is disabled`);
    }

    let result;
    switch (action.tool) {
      case 'click':
        result = await doClick(element);
        break;
      case 'type':
        result = await doType(element, action.text, action.submit);
        break;
      case 'select':
        result = doSelect(element, action.value);
        break;
      case 'scroll':
        result = doScroll(action.direction);
        break;
      case 'wait':
        await sleep(action.ms);
        result = ok(`waited ${action.ms}ms`);
        break;
      default:
        return err(`content script cannot run "${action.tool}"`);
    }

    if (!result.ok) return result;

    await sleep(SETTLE_MS);
    if (location.href !== before.url) {
      result.message += `; page is now ${location.href}`;
      result.navigated = true;
    } else if (document.title !== before.title) {
      result.message += `; page title is now "${document.title}"`;
    }
    return result;
  };
})();
