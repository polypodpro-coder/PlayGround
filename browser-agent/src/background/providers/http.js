/**
 * Small fetch wrapper shared by both providers: timeout via AbortController,
 * and a consistent LlmError shape so agent-loop.js never needs to know which
 * backend it's talking to.
 */

export class LlmError extends Error {
  constructor(message, { cause } = {}) {
    super(message);
    this.name = 'LlmError';
    this.cause = cause;
  }
}

/**
 * @param {string} url
 * @param {object} body
 * @param {{timeoutMs: number, fetchImpl?: Function, headers?: object,
 *          unreachableMessage?: string, mapErrorStatus?: (status:number, detail:string)=>string|null}} opts
 */
export async function postJson(url, body, opts) {
  const { timeoutMs, fetchImpl, headers = {}, unreachableMessage, mapErrorStatus } = opts;
  const doFetch = fetchImpl || globalThis.fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response;
  try {
    response = await doFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new LlmError(
        `The model did not answer within ${Math.round(timeoutMs / 1000)}s. ` +
          `Raise the timeout in Options, or try again.`,
      );
    }
    throw new LlmError(
      unreachableMessage || `Cannot reach ${url}.`,
      { cause: error },
    );
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    const mapped = mapErrorStatus?.(response.status, detail);
    throw new LlmError(
      mapped || `The model server returned ${response.status}. ${detail.slice(0, 300)}`,
    );
  }

  return response.json();
}
