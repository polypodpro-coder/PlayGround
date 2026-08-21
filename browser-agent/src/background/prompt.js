/**
 * Prompt construction. Pure functions, no chrome APIs — so `node --test` can
 * exercise all of it (see test/unit.test.mjs).
 *
 * The governing constraint is context. A 4B model with a 16k window loses the
 * plot fast if you hand it a full page snapshot per turn for ten turns. So:
 * exactly one snapshot in the prompt, the current one, and every earlier step
 * compressed to a single line of "what I did → what happened".
 */

import { APPROVAL_MODES } from '../shared/protocol.js';
import { TOOLS } from '../shared/action-schema.js';

export const HISTORY_LIMIT = 15;

const TOOL_REFERENCE = `Your tools (${TOOLS.join(', ')}):
- navigate  {"url": "https://...", "sensitive": false}     Load a different page.
- click     {"ref": 3, "sensitive": false}                 Click element [3].
- type      {"ref": 2, "text": "hello", "submit": false, "sensitive": false}   Type into element [2]. Set submit true to press Enter afterwards.
- select    {"ref": 5, "value": "Blue", "sensitive": false} Choose an option in dropdown [5].
- scroll    {"direction": "down"}                          One of up, down, top, bottom.
- wait      {"ms": 1000}                                   Let the page settle.
- ask_user  {"question": "..."}                            Ask the human. Use this for passwords, personal details, or any genuine ambiguity.
- done      {"summary": "..."}                             The goal is achieved. Put the actual answer in the summary.`;

const BASE_RULES = `1. Emit exactly one action as a JSON object. Always include a short "reasoning".
2. Only use element numbers that appear in the CURRENT snapshot. Never invent one.
3. Never type into a password field. Use ask_user instead.
4. If the information you need is not on screen, scroll before assuming it is absent.
5. If the last action failed, do something different — do not repeat it verbatim.
6. When the goal is a question, answer it in done.summary. Do not stop at "I found the page".
7. Prefer the smallest number of steps. Do not explore pages the goal does not require.`;

const EVERY_STEP_PROMPT = `You are a browsing agent. You are given a GOAL and a snapshot of the current web page, and you choose ONE action at a time to move toward that goal. Every action you propose is shown to the user before it runs, so keep "reasoning" short and factual — it is read as a one-line label, not a narration.

The page snapshot lists only the interactive elements, each with a number in brackets. Refer to elements by that number.

${TOOL_REFERENCE}

Rules:
${BASE_RULES}`;

const CHECKPOINT_PROMPT = `You are a browsing agent working somewhat autonomously: most of your actions run immediately, without the user watching each one, so narrate what you're doing. You are given a GOAL and a snapshot of the current web page, and you choose ONE action at a time to move toward that goal.

The page snapshot lists only the interactive elements, each with a number in brackets. Refer to elements by that number.

${TOOL_REFERENCE}

Rules:
${BASE_RULES}
8. Write "reasoning" as a short first-person sentence the user will see as you work, e.g. "I'll fill in the email field" — not a terse justification.
9. Set "sensitive": true on navigate/click/type/select whenever the action sends, pays, deletes, publishes, or otherwise has a real-world effect that would be hard to undo (submitting a form is already caught for you and always pauses — this is for anything beyond that, like a "Buy now" or "Delete account" button). Sensitive actions pause for the user's approval; everything else runs immediately. When in doubt, mark it sensitive.`;

export function buildSystemPrompt(approvalMode) {
  return approvalMode === APPROVAL_MODES.CHECKPOINTS ? CHECKPOINT_PROMPT : EVERY_STEP_PROMPT;
}

/** One snapshot element as a single compact line. */
function renderElement(element) {
  const parts = [`[${element.ref}]`, element.tag];
  if (element.type) parts.push(`type=${element.type}`);
  if (element.label) parts.push(`"${element.label}"`);
  if (element.secret) parts.push('(password — do not type into this)');
  else if (element.value) parts.push(`value="${element.value}"`);
  if (element.checked !== undefined) parts.push(element.checked ? '[x]' : '[ ]');
  if (element.options?.length) parts.push(`options=${element.options.join('|')}`);
  if (element.disabled) parts.push('(disabled)');
  if (element.inViewport === false) parts.push('(off-screen)');
  return parts.join(' ');
}

export function renderSnapshot(snapshot) {
  if (!snapshot) return 'PAGE: (not read yet)';

  const lines = [
    `URL: ${snapshot.url}`,
    `TITLE: ${snapshot.title}`,
  ];

  if (snapshot.scrollHeight > 0) {
    const pct = Math.round(
      (snapshot.scrollY / Math.max(1, snapshot.scrollHeight - 800)) * 100,
    );
    lines.push(`SCROLL: ${Math.min(100, Math.max(0, pct))}% down the page`);
  }

  lines.push('', 'ELEMENTS:');
  if (snapshot.elements.length === 0) {
    lines.push('(no interactive elements found)');
  } else {
    for (const element of snapshot.elements) lines.push(renderElement(element));
  }
  if (snapshot.truncated) {
    lines.push(`… ${snapshot.hiddenCount} more elements not shown; scroll to reach them.`);
  }

  if (snapshot.text) {
    lines.push('', 'PAGE TEXT:', snapshot.text);
  }

  return lines.join('\n');
}

/** Prior steps, one line each: what was done and what came of it. */
export function compactHistory(history, limit = HISTORY_LIMIT) {
  if (!history?.length) return '(nothing yet — this is the first step)';
  return history
    .slice(-limit)
    .map((entry) => {
      const outcome = entry.result?.ok ? 'ok' : 'FAILED';
      const detail = entry.result?.message ? ` — ${entry.result.message}` : '';
      return `${entry.n}. ${entry.summary} → ${outcome}${detail}`;
    })
    .join('\n');
}

/**
 * @param {{goal: string, history: Array, snapshot: object, lastError?: string,
 *          approvalMode?: string}} args
 * @returns {Array<{role: string, content: string}>}
 */
export function buildMessages({ goal, history, snapshot, lastError, approvalMode }) {
  const sections = [
    `GOAL: ${goal}`,
    '',
    'WHAT YOU HAVE DONE SO FAR:',
    compactHistory(history),
    '',
    'CURRENT PAGE:',
    renderSnapshot(snapshot),
  ];

  if (lastError) {
    sections.push(
      '',
      `Your previous reply was rejected: ${lastError}`,
      'Correct it and reply with one valid action.',
    );
  }

  sections.push('', 'Reply with one action as JSON.');

  return [
    { role: 'system', content: buildSystemPrompt(approvalMode) },
    { role: 'user', content: sections.join('\n') },
  ];
}
