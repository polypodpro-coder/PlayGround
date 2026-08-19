/**
 * Thin client for a local Ollama server. Nothing here talks to the internet:
 * every request goes to the endpoint in settings (default http://localhost:11434).
 */

/** JSON schema Ollama constrains the model's output to, so parsing never guesses. */
export const ACTION_SCHEMA = {
  type: 'object',
  properties: {
    thought: {
      type: 'string',
      description: 'One or two sentences: what you see and why the next action moves toward the goal.'
    },
    action: {
      type: 'string',
      enum: ['click', 'type', 'select', 'scroll', 'press', 'extract', 'navigate', 'wait', 'answer', 'ask']
    },
    ref: { type: 'integer', description: 'Element number from the ELEMENTS list. Required for click/type/select.' },
    text: { type: 'string', description: 'Text to type, option to select, key to press, string to search for, or the answer/question.' },
    url: { type: 'string', description: 'Absolute URL for the navigate action.' },
    direction: { type: 'string', enum: ['up', 'down', 'top', 'bottom'] },
    submit: { type: 'boolean', description: 'For type: press Enter afterwards.' }
  },
  required: ['thought', 'action']
};

export async function listModels(endpoint) {
  const res = await fetch(`${endpoint.replace(/\/$/, '')}/api/tags`);
  if (!res.ok) throw new Error(`Ollama responded ${res.status}`);
  const body = await res.json();
  return (body.models || []).map((m) => m.name);
}

export async function chat({ endpoint, model, messages, schema, temperature, contextWindow, signal }) {
  let res;
  try {
    res = await fetch(`${endpoint.replace(/\/$/, '')}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({
        model,
        messages,
        stream: false,
        format: schema,
        options: { temperature, num_ctx: contextWindow }
      })
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new Error(
      `Could not reach Ollama at ${endpoint}. Is it running, and is OLLAMA_ORIGINS set to allow chrome-extension://* ? (${err.message})`
    );
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Ollama error ${res.status}: ${detail.slice(0, 300)}`);
  }

  const body = await res.json();
  const raw = body.message?.content ?? '';
  try {
    return JSON.parse(raw);
  } catch {
    // Some models wrap JSON in prose or a fenced block; salvage the object.
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error(`Model did not return JSON: ${raw.slice(0, 200)}`);
  }
}
