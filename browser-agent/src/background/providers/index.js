/**
 * Picks a backend by `settings.provider` and normalizes both to the same
 * `{raw, usage}` shape. agent-loop.js calls `requestAction()` and never needs
 * to know which provider actually answered — same as it never needs to know
 * which model, only that it gets back a raw action object to validate.
 */

import { LlmError } from './http.js';
import * as local from './local.js';
import * as gemini from './gemini.js';

const PROVIDERS = { local, gemini };

function providerFor(settings) {
  const provider = PROVIDERS[settings.provider];
  if (!provider) {
    throw new LlmError(`Unknown provider "${settings.provider}".`);
  }
  return provider;
}

export async function requestAction(messages, settings, opts) {
  return providerFor(settings).requestAction(messages, settings, opts);
}

export async function listModels(settings, opts) {
  return providerFor(settings).listModels(settings, opts);
}

export { LlmError };
