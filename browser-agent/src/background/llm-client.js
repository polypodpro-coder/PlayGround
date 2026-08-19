/**
 * Client for LM Studio's OpenAI-compatible server (default http://localhost:1234/v1).
 *
 * The important call is `response_format: {type: "json_schema"}`. LM Studio
 * compiles the schema into a sampling grammar, so the model physically cannot
 * emit a malformed action — which matters enormously at 4B, where free-form
 * JSON output fails often enough to make the agent unusable.
 *
 * `parseActionContent` still exists as a belt-and-braces layer: some models
 * (Qwen3 in thinking mode especially) wrap output in <think> blocks or code
 * fences before the grammar kicks in, and a backend without grammar support
 * would otherwise fail opaquely.
 *
 * No chrome APIs here, so node can test it with a stub fetch.
 */

import { ACTION_JSON_SCHEMA } from '../shared/action-schema.js';

export class LlmError extends Error {
  constructor(message, { cause } = {}) {
    super(message);
    this.name = 'LlmError';
    this.cause = cause;
  }
}

/** Pull the action object out of whatever the model actually said. */
export function parseActionContent(content) {
  if (typeof content !== 'string' || !content.trim()) {
    throw new LlmError('The model returned an empty reply.');
  }

  let text = content
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<\|[^|]*\|>/g, '')
    .trim();

  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();

  try {
    return JSON.parse(text);
  } catch {
    // Fall through to brace scanning.
  }

  const start = text.indexOf('{');
  if (start !== -1) {
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = start; i < text.length; i += 1) {
      const char = text[i];
      if (inString) {
        if (escaped) escaped = false;
        else if (char === '\\') escaped = true;
        else if (char === '"') inString = false;
        continue;
      }
      if (char === '"') inString = true;
      else if (char === '{') depth += 1;
      else if (char === '}') {
        depth -= 1;
        if (depth === 0) {
          try {
            return JSON.parse(text.slice(start, i + 1));
          } catch (error) {
            throw new LlmError(
              `Could not parse the model's reply as JSON: ${error.message}`,
            );
          }
        }
      }
    }
  }

  throw new LlmError(
    `The model did not return JSON. It said: ${text.slice(0, 200)}`,
  );
}

function baseUrl(endpoint) {
  return String(endpoint || '').replace(/\/+$/, '');
}

async function postJson(url, body, { timeoutMs, fetchImpl }) {
  const doFetch = fetchImpl || globalThis.fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response;
  try {
    response = await doFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new LlmError(
        `The model did not answer within ${Math.round(timeoutMs / 1000)}s. ` +
          `A large model on a small GPU can be slower than this — raise the ` +
          `timeout in Options, or use a smaller quantization.`,
      );
    }
    throw new LlmError(
      `Cannot reach the local model at ${url}. Is LM Studio running with the ` +
        `server started (Developer tab → Start Server)?`,
      { cause: error },
    );
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new LlmError(
      `The local model server returned ${response.status}. ${detail.slice(0, 300)}`,
    );
  }

  return response.json();
}

/**
 * Ask the model for exactly one action.
 * @returns {Promise<{raw: object, usage: object|undefined}>}
 */
export async function requestAction(messages, settings, { fetchImpl } = {}) {
  const url = `${baseUrl(settings.endpoint)}/chat/completions`;

  const payload = await postJson(
    url,
    {
      model: settings.model,
      messages,
      temperature: settings.temperature,
      max_tokens: 512,
      stream: false,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'browser_action',
          strict: true,
          schema: ACTION_JSON_SCHEMA,
        },
      },
    },
    { timeoutMs: settings.requestTimeoutMs, fetchImpl },
  );

  const content = payload?.choices?.[0]?.message?.content;
  return { raw: parseActionContent(content), usage: payload?.usage };
}

/** Used by the options page's "Test connection" button. */
export async function listModels(settings, { fetchImpl } = {}) {
  const doFetch = fetchImpl || globalThis.fetch;
  const url = `${baseUrl(settings.endpoint)}/models`;
  let response;
  try {
    response = await doFetch(url);
  } catch (error) {
    throw new LlmError(`Cannot reach ${url}. Is the LM Studio server started?`, {
      cause: error,
    });
  }
  if (!response.ok) {
    throw new LlmError(`${url} returned ${response.status}.`);
  }
  const payload = await response.json();
  return (payload?.data || []).map((m) => m.id);
}
