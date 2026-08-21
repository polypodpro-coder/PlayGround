/**
 * Client for the Gemini API's native function calling
 * (https://ai.google.dev/gemini-api/docs/function-calling).
 *
 * Unlike the local backend, Gemini doesn't take one polymorphic "action"
 * object — it wants a set of discrete named functions. `toolFunctionDeclarations()`
 * derives those eight functions from the exact same `FIELD_DEFS`/`TOOL_FIELDS`
 * that `ACTION_JSON_SCHEMA` is built from (src/shared/action-schema.js), so the
 * two backends can never disagree about what a tool accepts — there is one
 * source of truth for the tool vocabulary, not two schemas maintained by hand.
 *
 * The response comes back as a `functionCall` part; `toRawAction()` reshapes
 * that into the same `{tool, reasoning, ...args}` object the local backend
 * produces, so `validateAction()` in action-schema.js runs unmodified — same
 * stale-ref check, same password-field block, same allowlist check, for
 * both backends.
 */

import { FIELD_DEFS, TOOL_FIELDS, TOOLS } from '../../shared/action-schema.js';
import { LlmError, postJson } from './http.js';

const DEFAULT_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

/** Overridable so tests can point this at the mock server instead of Google. */
function apiBase(settings) {
  return settings.geminiApiBase || DEFAULT_API_BASE;
}

/** A field is required on a function unless it's genuinely optional (submit, sensitive). */
const OPTIONAL_FIELDS = new Set(['submit', 'sensitive']);

/**
 * Build one Gemini FunctionDeclaration per tool from the shared field
 * definitions. Pure and side-effect free — trivial to unit test for drift
 * against TOOLS/FIELD_DEFS.
 */
export function toolFunctionDeclarations() {
  return TOOLS.map((tool) => {
    const fields = TOOL_FIELDS[tool] || [];
    const properties = { reasoning: { type: 'STRING' } };
    const required = ['reasoning'];

    for (const field of fields) {
      const def = FIELD_DEFS[field];
      properties[field] = def.enum
        ? { type: 'STRING', enum: def.enum, description: def.description }
        : { type: def.type.toUpperCase(), description: def.description };
      if (!OPTIONAL_FIELDS.has(field)) required.push(field);
    }

    return {
      name: tool,
      description: TOOL_DESCRIPTIONS[tool],
      parameters: { type: 'OBJECT', properties, required },
    };
  });
}

const TOOL_DESCRIPTIONS = {
  navigate: 'Load a different URL in the current tab.',
  click: 'Click an element from the page snapshot, by its [ref] number.',
  type: 'Type text into an input, textarea, or editable element, by its [ref] number.',
  select: 'Choose an option in a <select> dropdown, by its [ref] number.',
  scroll: 'Scroll the page up, down, to the top, or to the bottom.',
  wait: 'Pause briefly to let the page finish loading or animating.',
  ask_user: 'Ask the human a question and wait for their answer — for passwords, personal details, or genuine ambiguity.',
  done: 'The goal has been achieved. Report the result.',
};

/** Reshape a Gemini functionCall part into the raw action shape validateAction() expects. */
export function toRawAction(functionCall) {
  if (!functionCall || typeof functionCall.name !== 'string') return null;
  return { tool: functionCall.name, ...(functionCall.args || {}) };
}

function mapErrorStatus(status, detail) {
  if (status === 400 || status === 401 || status === 403) {
    return (
      'Gemini rejected the request — check that the API key in Settings is correct ' +
      `and has the Generative Language API enabled. (${status}: ${detail.slice(0, 200)})`
    );
  }
  if (status === 429) {
    return 'Gemini rate limit or quota exceeded. Wait a moment and try again, or check your quota in Google AI Studio.';
  }
  if (status >= 500) {
    return `Gemini's server had a problem (${status}). Usually transient — try again.`;
  }
  return null;
}

/**
 * Ask Gemini for exactly one action.
 * @returns {Promise<{raw: object, usage: object|undefined}>}
 */
export async function requestAction(messages, settings, { fetchImpl } = {}) {
  if (!settings.geminiApiKey) {
    throw new LlmError('No Gemini API key set. Add one in Settings.');
  }

  const model = settings.geminiModel || 'gemini-2.5-flash';
  const url = `${apiBase(settings)}/models/${encodeURIComponent(model)}:generateContent`;

  // Gemini has no "system" role message; fold it into systemInstruction and
  // convert the remaining chat history into its contents/parts shape.
  const systemMessage = messages.find((m) => m.role === 'system');
  const rest = messages.filter((m) => m.role !== 'system');

  const payload = await postJson(
    url,
    {
      ...(systemMessage
        ? { systemInstruction: { parts: [{ text: systemMessage.content }] } }
        : {}),
      contents: rest.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      })),
      tools: [{ functionDeclarations: toolFunctionDeclarations() }],
      toolConfig: { functionCallingConfig: { mode: 'ANY' } },
      generationConfig: { temperature: settings.temperature },
    },
    {
      timeoutMs: settings.requestTimeoutMs,
      fetchImpl,
      headers: { 'x-goog-api-key': settings.geminiApiKey },
      unreachableMessage: `Cannot reach the Gemini API. Check your internet connection.`,
      mapErrorStatus,
    },
  );

  const parts = payload?.candidates?.[0]?.content?.parts || [];
  const call = parts.find((p) => p.functionCall)?.functionCall;
  const raw = toRawAction(call);
  if (!raw) {
    const text = parts.find((p) => p.text)?.text || '(no function call and no text)';
    throw new LlmError(`Gemini did not call a tool. It said: ${text.slice(0, 200)}`);
  }

  return { raw, usage: payload?.usageMetadata };
}

/** Used by the options page's "Test connection" button. */
export async function listModels(settings, { fetchImpl } = {}) {
  if (!settings.geminiApiKey) {
    throw new LlmError('No Gemini API key set.');
  }
  const doFetch = fetchImpl || globalThis.fetch;
  const url = `${apiBase(settings)}/models`;
  let response;
  try {
    response = await doFetch(url, { headers: { 'x-goog-api-key': settings.geminiApiKey } });
  } catch (error) {
    throw new LlmError('Cannot reach the Gemini API. Check your internet connection.', {
      cause: error,
    });
  }
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new LlmError(mapErrorStatus(response.status, detail) || `${url} returned ${response.status}.`);
  }
  const payload = await response.json();
  return (payload?.models || [])
    .map((m) => String(m.name || '').replace(/^models\//, ''))
    .filter((name) => name.includes('gemini'));
}
