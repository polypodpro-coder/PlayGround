/**
 * Re-exports the provider dispatcher under the import path the rest of the
 * background already uses. The actual backends live in ./providers/ —
 * local.js (LM Studio) and gemini.js (Gemini API) — chosen at call time by
 * `settings.provider`. See providers/index.js.
 */
export { LlmError, listModels, requestAction } from './providers/index.js';
