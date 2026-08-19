/**
 * The agent's entire action vocabulary, in two layers:
 *
 *  1. `ACTION_JSON_SCHEMA` is handed to LM Studio as a `response_format` of type
 *     `json_schema`. llama.cpp compiles it to a sampling grammar, so the model
 *     *cannot* emit anything but a structurally valid object. That guarantees
 *     shape, not sense.
 *  2. `validateAction()` then checks sense: that the tool's required arguments
 *     are present, that a ref points at an element in the *current* snapshot,
 *     that a URL is http(s), that we're not typing into a password field.
 *
 * Both layers are load-bearing. Layer 1 stops parse failures; layer 2 stops a
 * 4B model from confidently clicking element [47] on a page with 12 elements.
 *
 * The schema is deliberately FLAT rather than a `oneOf` union of per-tool
 * shapes. Small models handle "one object, fill in the fields this tool needs"
 * far more reliably than a discriminated union, and grammar support for `oneOf`
 * is uneven across backends.
 */

export const TOOLS = [
  'navigate',
  'click',
  'type',
  'select',
  'scroll',
  'wait',
  'ask_user',
  'done',
];

export const SCROLL_DIRECTIONS = ['up', 'down', 'top', 'bottom'];

export const WAIT_MIN_MS = 100;
export const WAIT_MAX_MS = 10000;

export const ACTION_JSON_SCHEMA = {
  type: 'object',
  properties: {
    reasoning: {
      type: 'string',
      description: 'One short sentence: why this action moves the goal forward.',
    },
    tool: { type: 'string', enum: TOOLS },
    ref: {
      type: 'integer',
      description: 'Element number from the snapshot. For click, type, select.',
    },
    text: { type: 'string', description: 'Text to type. For type.' },
    url: { type: 'string', description: 'Absolute http(s) URL. For navigate.' },
    value: { type: 'string', description: 'Option to choose. For select.' },
    direction: { type: 'string', enum: SCROLL_DIRECTIONS },
    submit: {
      type: 'boolean',
      description: 'Press Enter after typing. For type.',
    },
    ms: { type: 'integer', description: 'Milliseconds to wait. For wait.' },
    question: { type: 'string', description: 'What to ask the user. For ask_user.' },
    summary: {
      type: 'string',
      description: 'The answer or result. For done.',
    },
  },
  required: ['reasoning', 'tool'],
  additionalProperties: false,
};

/** Tools whose `ref` must resolve against the current snapshot. */
const REF_TOOLS = new Set(['click', 'type', 'select']);

function fail(error) {
  return { ok: false, error };
}

function str(v) {
  return typeof v === 'string' ? v.trim() : '';
}

/**
 * @param {object} raw       Parsed model output.
 * @param {object} snapshot  The snapshot the model was shown; may be null for
 *                           tools that don't touch the page.
 * @returns {{ok: true, action: object} | {ok: false, error: string}}
 */
export function validateAction(raw, snapshot) {
  if (!raw || typeof raw !== 'object') return fail('Model output was not an object.');

  const tool = str(raw.tool);
  if (!TOOLS.includes(tool)) {
    return fail(`Unknown tool "${raw.tool}". Valid tools: ${TOOLS.join(', ')}.`);
  }

  const action = { tool, reasoning: str(raw.reasoning) };

  if (REF_TOOLS.has(tool)) {
    const ref = Number(raw.ref);
    if (!Number.isInteger(ref)) {
      return fail(`Tool "${tool}" needs a "ref" (an element number from the snapshot).`);
    }
    const element = snapshot?.elements?.find((e) => e.ref === ref);
    if (!element) {
      const available = snapshot?.elements?.length ?? 0;
      return fail(
        `No element [${ref}] on this page (the snapshot has ${available} elements).`,
      );
    }
    if (tool === 'type' && element.secret) {
      return fail(
        `Element [${ref}] is a password field. The agent is not allowed to type ` +
          `into password fields — ask the user to fill it in instead.`,
      );
    }
    action.ref = ref;
    action.target = describeElement(element);
  }

  switch (tool) {
    case 'navigate': {
      const url = str(raw.url);
      if (!url) return fail('Tool "navigate" needs a "url".');
      let parsed;
      try {
        parsed = new URL(url);
      } catch {
        return fail(`"${url}" is not a valid absolute URL.`);
      }
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return fail(`Refusing to navigate to a ${parsed.protocol} URL.`);
      }
      action.url = parsed.href;
      break;
    }
    case 'type': {
      const text = typeof raw.text === 'string' ? raw.text : '';
      if (!text) return fail('Tool "type" needs "text".');
      action.text = text;
      action.submit = raw.submit === true;
      break;
    }
    case 'select': {
      const value = str(raw.value);
      if (!value) return fail('Tool "select" needs a "value".');
      action.value = value;
      break;
    }
    case 'scroll': {
      const direction = str(raw.direction) || 'down';
      if (!SCROLL_DIRECTIONS.includes(direction)) {
        return fail(`"${direction}" is not a scroll direction.`);
      }
      action.direction = direction;
      break;
    }
    case 'wait': {
      const ms = Number.isFinite(Number(raw.ms)) ? Number(raw.ms) : 1000;
      action.ms = Math.min(WAIT_MAX_MS, Math.max(WAIT_MIN_MS, Math.round(ms)));
      break;
    }
    case 'ask_user': {
      const question = str(raw.question);
      if (!question) return fail('Tool "ask_user" needs a "question".');
      action.question = question;
      break;
    }
    case 'done': {
      action.summary = str(raw.summary) || str(raw.text) || 'Goal complete.';
      break;
    }
    default:
      break;
  }

  return { ok: true, action };
}

/** Short human label for a snapshot element, used in the approval card. */
export function describeElement(element) {
  const label = element.label ? `"${element.label}"` : '';
  return [element.tag, label].filter(Boolean).join(' ');
}

/** One-line description of an action, shown to the user before they approve it. */
export function describeAction(action) {
  switch (action.tool) {
    case 'navigate':
      return `Go to ${action.url}`;
    case 'click':
      return `Click [${action.ref}] ${action.target ?? ''}`.trim();
    case 'type':
      return (
        `Type "${action.text}" into [${action.ref}] ${action.target ?? ''}`.trim() +
        (action.submit ? ' and press Enter' : '')
      );
    case 'select':
      return `Choose "${action.value}" in [${action.ref}] ${action.target ?? ''}`.trim();
    case 'scroll':
      return `Scroll ${action.direction}`;
    case 'wait':
      return `Wait ${action.ms}ms`;
    case 'ask_user':
      return action.question;
    case 'done':
      return action.summary;
    default:
      return action.tool;
  }
}

/** True when `url`'s host is permitted by the settings allowlist. */
export function isHostAllowed(url, allowlist) {
  if (!Array.isArray(allowlist) || allowlist.length === 0) return true;
  let host;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }
  return allowlist.some((raw) => {
    const entry = String(raw).trim().toLowerCase().replace(/^\*\./, '');
    if (!entry) return false;
    return host === entry || host.endsWith(`.${entry}`);
  });
}
