// Thin client for local LLM servers. Two dialects are supported:
//   ollama  -> POST {endpoint}/api/chat
//   openai  -> POST {endpoint}/v1/chat/completions  (llama.cpp, LM Studio, vLLM, Jan, ...)
// Both are asked for strict JSON so the agent loop can parse a single action per step.

export async function chat(messages, settings, signal) {
  return settings.provider === 'openai'
    ? chatOpenAI(messages, settings, signal)
    : chatOllama(messages, settings, signal);
}

async function chatOllama(messages, settings, signal) {
  const res = await fetch(trimSlash(settings.endpoint) + '/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      model: settings.model,
      messages,
      stream: false,
      format: 'json',
      options: { temperature: Number(settings.temperature) || 0 }
    })
  });
  if (!res.ok) throw new Error(`Ollama ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  return data?.message?.content ?? '';
}

async function chatOpenAI(messages, settings, signal) {
  const headers = { 'Content-Type': 'application/json' };
  if (settings.apiKey) headers.Authorization = `Bearer ${settings.apiKey}`;
  const res = await fetch(trimSlash(settings.endpoint) + '/v1/chat/completions', {
    method: 'POST',
    headers,
    signal,
    body: JSON.stringify({
      model: settings.model,
      messages,
      temperature: Number(settings.temperature) || 0,
      response_format: { type: 'json_object' }
    })
  });
  if (!res.ok) throw new Error(`LLM ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  return data?.choices?.[0]?.message?.content ?? '';
}

export async function listModels(settings) {
  if (settings.provider === 'openai') {
    const headers = settings.apiKey ? { Authorization: `Bearer ${settings.apiKey}` } : {};
    const res = await fetch(trimSlash(settings.endpoint) + '/v1/models', { headers });
    if (!res.ok) throw new Error(`LLM ${res.status}`);
    const data = await res.json();
    return (data.data || []).map((m) => m.id);
  }
  const res = await fetch(trimSlash(settings.endpoint) + '/api/tags');
  if (!res.ok) throw new Error(`Ollama ${res.status}`);
  const data = await res.json();
  return (data.models || []).map((m) => m.name);
}

// Local models wrap JSON in prose or fences often enough that this is worth doing properly.
export function parseJsonObject(text) {
  if (!text) throw new Error('empty model response');
  let s = String(text).trim();

  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();

  // Reasoning models (qwen3, deepseek-r1) may emit a <think> block before the answer.
  s = s.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

  try {
    return JSON.parse(s);
  } catch {
    /* fall through to brace scanning */
  }

  const start = s.indexOf('{');
  if (start === -1) throw new Error('no JSON object in model response');
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return JSON.parse(s.slice(start, i + 1));
    }
  }
  throw new Error('unterminated JSON object in model response');
}

function trimSlash(u) {
  return String(u || '').replace(/\/+$/, '');
}
