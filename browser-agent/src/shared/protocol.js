/**
 * Message types shared across the three extension contexts.
 *
 * NOTE: the content scripts are loaded as *classic* scripts (Chrome does not
 * support `"type": "module"` for declarative content scripts), so they cannot
 * import from this ES module. They use the same string literals inline, and
 * `test/unit.test.mjs` asserts the literals in `src/content/index.js` stay in
 * sync with the CONTENT_MSG values below.
 */

/** Content script <- background. Handled in src/content/index.js. */
export const CONTENT_MSG = {
  PING: 'agent:ping',
  OBSERVE: 'agent:observe',
  EXECUTE: 'agent:execute',
  HIGHLIGHT: 'agent:highlight',
  CLEAR_HIGHLIGHT: 'agent:clear-highlight',
};

/** Side panel -> background, over the long-lived port. */
export const PANEL_MSG = {
  HELLO: 'panel:hello',
  START: 'panel:start',
  APPROVE: 'panel:approve',
  SKIP: 'panel:skip',
  ANSWER: 'panel:answer',
  ABORT: 'panel:abort',
  RESET: 'panel:reset',
};

/** Background -> side panel, over the long-lived port. */
export const BG_MSG = {
  STATE: 'bg:state',
};

export const PORT_NAME = 'agent-panel';

/** Run lifecycle states. The panel renders purely off these. */
export const STATUS = {
  IDLE: 'idle',
  OBSERVING: 'observing',
  THINKING: 'thinking',
  AWAITING_APPROVAL: 'awaiting_approval',
  AWAITING_ANSWER: 'awaiting_answer',
  EXECUTING: 'executing',
  DONE: 'done',
  ABORTED: 'aborted',
  ERROR: 'error',
};

/** A run in one of these states will never advance on its own again. */
export const TERMINAL_STATUSES = [STATUS.DONE, STATUS.ABORTED, STATUS.ERROR];

/** Which backend answers requestAction(). */
export const PROVIDERS = { LOCAL: 'local', GEMINI: 'gemini' };

/**
 * How much runs pause for approval.
 *   every-step  — every page-touching action waits for the user (local's default;
 *                 a 4B model misclicks often enough that this is not optional there).
 *   checkpoints — only sensitive actions (form submits, off-allowlist navigation,
 *                 anything the model flags) wait; everything else runs immediately
 *                 (Gemini's default — its tool-calling is reliable enough to trust).
 *   manual      — every-step, regardless of backend. For Gemini + extra caution.
 */
export const APPROVAL_MODES = {
  EVERY_STEP: 'every-step',
  CHECKPOINTS: 'checkpoints',
  MANUAL: 'manual',
};

/** Default approval mode per backend, used when the user hasn't overridden it. */
export const DEFAULT_APPROVAL_MODE_BY_PROVIDER = {
  [PROVIDERS.LOCAL]: APPROVAL_MODES.EVERY_STEP,
  [PROVIDERS.GEMINI]: APPROVAL_MODES.CHECKPOINTS,
};

export const DEFAULT_SETTINGS = {
  provider: PROVIDERS.LOCAL,

  // Local (LM Studio)
  endpoint: 'http://localhost:1234/v1',
  model: 'qwen3-4b-instruct-2507',

  // Gemini
  geminiApiKey: '',
  geminiModel: 'gemini-2.5-flash',

  // Shared
  temperature: 0.2,
  maxSteps: 25,
  requestTimeoutMs: 120000,
  /** Empty list = every domain allowed. Entries are bare hosts, e.g. "github.com". */
  allowlist: [],
  /** 'every-step' | 'checkpoints' | 'manual' | '' — '' means "use the provider's default". */
  approvalMode: '',
};

/** Resolve the effective approval mode for a run, honoring an explicit override. */
export function resolveApprovalMode(settings) {
  return settings.approvalMode || DEFAULT_APPROVAL_MODE_BY_PROVIDER[settings.provider] || APPROVAL_MODES.EVERY_STEP;
}

export const STORAGE_KEYS = {
  SETTINGS: 'settings',
  RUN: 'run',
};
