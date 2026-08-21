/**
 * Unit coverage for everything that does not need a browser: action
 * validation, prompt assembly, and the LM Studio client's response handling.
 *
 *   node --test test/unit.test.mjs
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import {
  ACTION_JSON_SCHEMA,
  TOOLS,
  describeAction,
  isHostAllowed,
  validateAction,
} from '../src/shared/action-schema.js';
import { CONTENT_MSG } from '../src/shared/protocol.js';
import { buildMessages, buildSystemPrompt, compactHistory, renderSnapshot } from '../src/background/prompt.js';
import { LlmError, requestAction } from '../src/background/llm-client.js';
import { parseActionContent } from '../src/background/providers/local.js';
import { toolFunctionDeclarations, toRawAction } from '../src/background/providers/gemini.js';
import { startMockServer } from './mock-llm-server.mjs';

const snapshot = {
  snapshotId: 's1',
  url: 'https://fixture.test/login',
  title: 'Sign in',
  scrollY: 0,
  scrollHeight: 1200,
  truncated: false,
  hiddenCount: 0,
  text: 'Sign in to Fixture. Support: help@fixture.test',
  elements: [
    { ref: 1, tag: 'input', type: 'email', label: 'Email', value: '', inViewport: true },
    { ref: 2, tag: 'input', type: 'password', label: 'Password', secret: true, value: '(set)', inViewport: true },
    { ref: 3, tag: 'select', label: 'Plan', value: 'free', options: ['free', 'pro'], inViewport: true },
    { ref: 4, tag: 'button', label: 'Sign in', inViewport: true },
  ],
};

// ── validateAction ─────────────────────────────────────────────────────────

test('accepts a well-formed type action', () => {
  const result = validateAction(
    { reasoning: 'fill the email', tool: 'type', ref: 1, text: 'a@b.test', submit: true },
    snapshot,
  );
  assert.equal(result.ok, true);
  assert.equal(result.action.text, 'a@b.test');
  assert.equal(result.action.submit, true);
  assert.match(result.action.target, /input "Email"/);
});

test('rejects an unknown tool', () => {
  const result = validateAction({ tool: 'teleport', reasoning: 'x' }, snapshot);
  assert.equal(result.ok, false);
  assert.match(result.error, /Unknown tool/);
});

test('rejects a ref that is not on the page', () => {
  const result = validateAction({ tool: 'click', ref: 47, reasoning: 'x' }, snapshot);
  assert.equal(result.ok, false);
  assert.match(result.error, /No element \[47\]/);
});

test('rejects a ref-taking tool with no ref at all', () => {
  const result = validateAction({ tool: 'click', reasoning: 'x' }, snapshot);
  assert.equal(result.ok, false);
  assert.match(result.error, /needs a "ref"/);
});

test('refuses to type into a password field', () => {
  const result = validateAction(
    { tool: 'type', ref: 2, text: 'hunter2', reasoning: 'log in' },
    snapshot,
  );
  assert.equal(result.ok, false);
  assert.match(result.error, /password field/);
});

test('clicking a password field is still allowed', () => {
  // Only *typing* a secret is forbidden; focusing the field for the user is fine.
  assert.equal(validateAction({ tool: 'click', ref: 2, reasoning: 'x' }, snapshot).ok, true);
});

test('rejects non-http navigation', () => {
  for (const url of ['javascript:alert(1)', 'file:///etc/passwd', 'data:text/html,x']) {
    const result = validateAction({ tool: 'navigate', url, reasoning: 'x' }, snapshot);
    assert.equal(result.ok, false, `${url} should be rejected`);
  }
});

test('normalizes a valid URL', () => {
  const result = validateAction(
    { tool: 'navigate', url: 'https://example.com', reasoning: 'x' },
    snapshot,
  );
  assert.equal(result.ok, true);
  assert.equal(result.action.url, 'https://example.com/');
});

test('defaults and clamps the loose numeric arguments', () => {
  assert.equal(validateAction({ tool: 'scroll', reasoning: 'x' }, snapshot).action.direction, 'down');
  assert.equal(validateAction({ tool: 'wait', ms: 999999, reasoning: 'x' }, snapshot).action.ms, 10000);
  assert.equal(validateAction({ tool: 'wait', ms: 1, reasoning: 'x' }, snapshot).action.ms, 100);
  assert.equal(validateAction({ tool: 'wait', reasoning: 'x' }, snapshot).action.ms, 1000);
});

test('done always yields a summary', () => {
  const result = validateAction({ tool: 'done', reasoning: 'x' }, snapshot);
  assert.equal(result.ok, true);
  assert.ok(result.action.summary.length > 0);
});

test('every tool in TOOLS is in the JSON schema enum', () => {
  assert.deepEqual(ACTION_JSON_SCHEMA.properties.tool.enum, TOOLS);
  assert.equal(ACTION_JSON_SCHEMA.additionalProperties, false);
});

test('describeAction produces something a human can check', () => {
  const { action } = validateAction(
    { tool: 'type', ref: 1, text: 'hi', submit: true, reasoning: 'x' },
    snapshot,
  );
  assert.match(describeAction(action), /Type "hi" into \[1\] input "Email" and press Enter/);
});

// ── allowlist ──────────────────────────────────────────────────────────────

test('an empty allowlist permits everything', () => {
  assert.equal(isHostAllowed('https://anything.test/x', []), true);
  assert.equal(isHostAllowed('https://anything.test/x', undefined), true);
});

test('allowlist matches the host and its subdomains only', () => {
  const list = ['wikipedia.org', '*.github.com'];
  assert.equal(isHostAllowed('https://en.wikipedia.org/wiki/X', list), true);
  assert.equal(isHostAllowed('https://wikipedia.org', list), true);
  assert.equal(isHostAllowed('https://gist.github.com', list), true);
  assert.equal(isHostAllowed('https://notwikipedia.org', list), false);
  assert.equal(isHostAllowed('not a url', list), false);
});

// ── prompt ─────────────────────────────────────────────────────────────────

test('the snapshot renders refs and marks the password field without leaking it', () => {
  const rendered = renderSnapshot(snapshot);
  assert.match(rendered, /\[1\] input type=email "Email"/);
  assert.match(rendered, /\[2\].*password — do not type into this/);
  assert.ok(!rendered.includes('hunter2'));
  assert.match(rendered, /options=free\|pro/);
  assert.match(rendered, /help@fixture\.test/);
});

test('history compacts to one line per step and keeps only the tail', () => {
  const history = Array.from({ length: 20 }, (_, i) => ({
    n: i + 1,
    summary: `Click [${i}]`,
    result: { ok: i % 2 === 0, message: 'msg' },
  }));
  const lines = compactHistory(history).split('\n');
  assert.equal(lines.length, 15);
  assert.match(lines[0], /^6\. Click \[5\] → FAILED — msg$/);
  assert.match(lines.at(-1), /^20\. Click \[19\] → FAILED/);
});

test('the first step says so rather than showing an empty list', () => {
  assert.match(compactHistory([]), /first step/);
});

test('buildMessages surfaces a rejection back to the model', () => {
  const messages = buildMessages({
    goal: 'log in',
    history: [],
    snapshot,
    lastError: 'No element [47] on this page',
  });
  assert.equal(messages.length, 2);
  assert.equal(messages[0].role, 'system');
  assert.match(messages[0].content, /Never type into a password field/);
  assert.match(messages[1].content, /GOAL: log in/);
  assert.match(messages[1].content, /previous reply was rejected: No element \[47\]/);
});

// ── llm-client ─────────────────────────────────────────────────────────────

test('parses bare JSON, fenced JSON, thinking blocks, and prose wrappers', () => {
  const expected = { tool: 'click', ref: 3, reasoning: 'go' };
  const inputs = [
    '{"tool":"click","ref":3,"reasoning":"go"}',
    '```json\n{"tool":"click","ref":3,"reasoning":"go"}\n```',
    '<think>Let me consider the options.</think>{"tool":"click","ref":3,"reasoning":"go"}',
    'Sure! Here is the action: {"tool":"click","ref":3,"reasoning":"go"} Hope that helps.',
  ];
  for (const input of inputs) {
    assert.deepEqual(parseActionContent(input), expected, `failed on: ${input}`);
  }
});

test('brace scanning is not fooled by braces inside strings', () => {
  const parsed = parseActionContent('noise {"tool":"type","text":"a } b","reasoning":"x"} tail');
  assert.equal(parsed.text, 'a } b');
});

test('a reply with no JSON at all is a clear error, not a crash', () => {
  assert.throws(() => parseActionContent('I cannot help with that.'), LlmError);
  assert.throws(() => parseActionContent(''), LlmError);
});

test('requestAction sends the grammar-constraining response_format', async () => {
  const mock = await startMockServer({ port: 0 });
  try {
    const settings = {
      provider: 'local',
      endpoint: `http://127.0.0.1:${mock.port}/v1`,
      model: 'test-model',
      temperature: 0.2,
      requestTimeoutMs: 5000,
    };
    const { raw } = await requestAction([{ role: 'user', content: 'go' }], settings);
    assert.equal(raw.tool, 'scroll');

    const sent = mock.requests[0];
    assert.equal(sent.model, 'test-model');
    assert.equal(sent.stream, false);
    assert.equal(sent.response_format.type, 'json_schema');
    assert.equal(sent.response_format.json_schema.strict, true);
    assert.deepEqual(sent.response_format.json_schema.schema, ACTION_JSON_SCHEMA);
  } finally {
    await mock.close();
  }
});

test('an unreachable server explains what to check', async () => {
  const settings = {
    provider: 'local',
    endpoint: 'http://127.0.0.1:9/v1',
    model: 'x',
    temperature: 0,
    requestTimeoutMs: 2000,
  };
  await assert.rejects(
    () => requestAction([{ role: 'user', content: 'go' }], settings),
    (error) => error instanceof LlmError && /Is LM Studio running/.test(error.message),
  );
});

test('checkpoint mode asks for narration and the sensitive flag; every-step does not', () => {
  const everyStep = buildSystemPrompt('every-step');
  assert.match(everyStep, /read as a one-line label/);
  assert.ok(!everyStep.includes('"sensitive": true'));

  const checkpoint = buildSystemPrompt('checkpoints');
  assert.match(checkpoint, /narrate what you're doing/);
  assert.match(checkpoint, /"sensitive": true/);
});

test('buildMessages threads approvalMode into the system prompt', () => {
  const messages = buildMessages({ goal: 'x', history: [], snapshot, approvalMode: 'checkpoints' });
  assert.match(messages[0].content, /narrate what you're doing/);
});

// ── gemini adapter ─────────────────────────────────────────────────────────

test('toolFunctionDeclarations covers every tool with no drift from TOOL_FIELDS', () => {
  const decls = toolFunctionDeclarations();
  assert.deepEqual(decls.map((d) => d.name), TOOLS);
  const click = decls.find((d) => d.name === 'click');
  assert.deepEqual(Object.keys(click.parameters.properties).sort(), ['ref', 'reasoning', 'sensitive'].sort());
  assert.deepEqual(click.parameters.required, ['reasoning', 'ref']);
  const type = decls.find((d) => d.name === 'type');
  assert.deepEqual(type.parameters.required, ['reasoning', 'ref', 'text']);
  assert.ok(!type.parameters.required.includes('submit'), 'submit is optional');
});

test('toRawAction reshapes a Gemini functionCall into the raw action shape', () => {
  const raw = toRawAction({ name: 'click', args: { reasoning: 'go', ref: 3 } });
  assert.deepEqual(raw, { tool: 'click', reasoning: 'go', ref: 3 });
});

test('toRawAction returns null for a missing or malformed functionCall', () => {
  assert.equal(toRawAction(undefined), null);
  assert.equal(toRawAction({ args: {} }), null);
});

test('gemini requestAction sends functionDeclarations and the api key header, not in the url', async () => {
  const mock = await startMockServer({ port: 0, mode: 'gemini' });
  try {
    const settings = {
      provider: 'gemini',
      geminiApiBase: `http://127.0.0.1:${mock.port}/v1beta`,
      geminiApiKey: 'test-key-123',
      geminiModel: 'gemini-test',
      temperature: 0.2,
      requestTimeoutMs: 5000,
    };
    const { raw } = await requestAction([
      { role: 'system', content: 'you are an agent' },
      { role: 'user', content: 'go' },
    ], settings);
    assert.equal(raw.tool, 'scroll');

    const [url, sent, headers] = mock.requests.at(-1).gemini;
    assert.match(url, /models\/gemini-test:generateContent$/);
    assert.ok(!url.includes('test-key-123'), 'api key must not appear in the url');
    assert.equal(headers['x-goog-api-key'], 'test-key-123');
    assert.equal(sent.systemInstruction.parts[0].text, 'you are an agent');
    assert.equal(sent.tools[0].functionDeclarations.length, TOOLS.length);
  } finally {
    await mock.close();
  }
});

test('a bad gemini api key produces a clear error, not a raw 401', async () => {
  const mock = await startMockServer({ port: 0, mode: 'gemini', failStatus: 401 });
  try {
    const settings = {
      provider: 'gemini',
      geminiApiBase: `http://127.0.0.1:${mock.port}/v1beta`,
      geminiApiKey: 'bad-key',
      geminiModel: 'gemini-test',
      temperature: 0,
      requestTimeoutMs: 5000,
    };
    await assert.rejects(
      () => requestAction([{ role: 'user', content: 'go' }], settings),
      (error) => error instanceof LlmError && /rejected the request/.test(error.message),
    );
  } finally {
    await mock.close();
  }
});

test('an unknown provider fails loudly instead of silently doing nothing', async () => {
  await assert.rejects(
    () => requestAction([], { provider: 'carrier-pigeon' }),
    (error) => error instanceof LlmError && /Unknown provider/.test(error.message),
  );
});

// ── checkpoint gating ──────────────────────────────────────────────────────

test('isCheckpointAction gates form submits, off-allowlist navigation, and model-flagged actions', async () => {
  const { isCheckpointAction } = await import('../src/shared/action-schema.js');

  assert.equal(isCheckpointAction({ tool: 'click' }, []), false);
  assert.equal(isCheckpointAction({ tool: 'click', formSubmit: true }, []), true);
  assert.equal(isCheckpointAction({ tool: 'type', submit: true, formSubmit: true }, []), true);
  assert.equal(isCheckpointAction({ tool: 'click', sensitive: true }, []), true);
  assert.equal(
    isCheckpointAction({ tool: 'navigate', url: 'https://evil.test' }, ['good.test']),
    true,
  );
  assert.equal(
    isCheckpointAction({ tool: 'navigate', url: 'https://good.test' }, ['good.test']),
    false,
  );
});

test('a click on a form submit button is marked formSubmit by validateAction', () => {
  const withSubmit = {
    ...snapshot,
    elements: [{ ref: 1, tag: 'button', label: 'Sign in', formSubmit: true, inViewport: true }],
  };
  const { action } = validateAction({ tool: 'click', ref: 1, reasoning: 'x' }, withSubmit);
  assert.equal(action.formSubmit, true);
});

// ── content-script protocol drift ──────────────────────────────────────────

test('content script message literals match CONTENT_MSG', async () => {
  // Content scripts are classic scripts and cannot import the ES module, so
  // they repeat these strings. This guards against the two drifting apart.
  const path = fileURLToPath(new URL('../src/content/index.js', import.meta.url));
  const source = await readFile(path, 'utf8');
  for (const value of Object.values(CONTENT_MSG)) {
    assert.ok(source.includes(`'${value}'`), `src/content/index.js is missing ${value}`);
  }
});
