/**
 * A stand-in for either backend's real server, so the whole extension can be
 * exercised without a GPU or an API key.
 *
 *   mode: 'local'  (default) — LM Studio's OpenAI-compatible API:
 *                   GET /v1/models, POST /v1/chat/completions.
 *   mode: 'gemini'            — Gemini's generateContent API:
 *                   GET /v1beta/models, POST /v1beta/models/:model:generateContent.
 *
 * Each request returns the next action from a script, shaped for whichever
 * mode is active. Point the extension's endpoint (local) or let it hit this
 * server via a stubbed fetch (gemini, since the real Gemini host is fixed) and
 * it will believe it is talking to the real thing.
 *
 *   node test/mock-llm-server.mjs [--port 1234] [--script path/to/script.json]
 *
 * The script is a JSON array of raw action objects: {tool, reasoning, ...args}.
 * POST /__script replaces it and rewinds, which is how the automated tests
 * drive different scenarios without starting a new server per test.
 */

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

const DEFAULT_SCRIPT = [
  {
    reasoning: 'The support address is likely in the page text; read it first.',
    tool: 'scroll',
    direction: 'down',
  },
  {
    reasoning: 'The support address is visible in the page text.',
    tool: 'done',
    summary: 'The support email is help@fixture.test',
  },
];

function parseArgs(argv) {
  const args = { port: 1234, script: null, mode: 'local' };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--port') args.port = Number(argv[++i]);
    if (argv[i] === '--script') args.script = argv[++i];
    if (argv[i] === '--mode') args.mode = argv[++i];
  }
  return args;
}

export async function startMockServer({
  port = 1234,
  script = DEFAULT_SCRIPT,
  mode = 'local',
  failStatus = null,
} = {}) {
  let actions = [...script];
  let cursor = 0;
  const requests = [];

  const nextAction = () => {
    const action = actions[cursor] ?? {
      reasoning: 'The script ran out of actions.',
      tool: 'done',
      summary: 'mock script exhausted',
    };
    cursor += 1;
    return action;
  };

  const server = createServer(async (req, res) => {
    const json = (status, body) => {
      res.writeHead(status, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
      });
      res.end(JSON.stringify(body));
    };

    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      });
      return res.end();
    }

    const body = await new Promise((resolve) => {
      let raw = '';
      req.on('data', (chunk) => (raw += chunk));
      req.on('end', () => {
        try {
          resolve(raw ? JSON.parse(raw) : {});
        } catch {
          resolve({});
        }
      });
    });

    if (req.url === '/__script' && req.method === 'POST') {
      actions = Array.isArray(body) ? body : body.actions || [];
      cursor = 0;
      requests.length = 0;
      return json(200, { ok: true, count: actions.length });
    }

    if (req.url === '/__requests') return json(200, requests);

    if (failStatus) {
      return json(failStatus, { error: { message: 'mock failure', status: failStatus } });
    }

    // ── Gemini-shaped routes ────────────────────────────────────────────
    if (mode === 'gemini') {
      if (/\/models$/.test(req.url) && req.method === 'GET') {
        return json(200, { models: [{ name: 'models/gemini-test' }] });
      }
      const match = req.url.match(/\/models\/([^:]+):generateContent$/);
      if (match && req.method === 'POST') {
        requests.push({ gemini: [req.url, body, req.headers] });
        const action = nextAction();
        const { tool, reasoning, ...args } = action;
        return json(200, {
          candidates: [
            {
              content: { role: 'model', parts: [{ functionCall: { name: tool, args: { reasoning, ...args } } }] },
            },
          ],
          usageMetadata: { promptTokenCount: 0, candidatesTokenCount: 0 },
        });
      }
      return json(404, { error: `no mock gemini route for ${req.url}` });
    }

    // ── LM Studio / OpenAI-shaped routes ────────────────────────────────
    if (req.url.endsWith('/models')) {
      return json(200, { object: 'list', data: [{ id: 'mock-model', object: 'model' }] });
    }

    if (req.url.endsWith('/chat/completions')) {
      requests.push(body);
      const action = nextAction();
      return json(200, {
        id: `mock-${cursor}`,
        object: 'chat.completion',
        model: body.model || 'mock-model',
        choices: [
          {
            index: 0,
            finish_reason: 'stop',
            message: { role: 'assistant', content: JSON.stringify(action) },
          },
        ],
        usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      });
    }

    return json(404, { error: `no mock route for ${req.url}` });
  });

  await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));

  return {
    server,
    port: server.address().port,
    get requests() {
      return requests;
    },
    setScript(next) {
      actions = [...next];
      cursor = 0;
      requests.length = 0;
    },
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const args = parseArgs(process.argv.slice(2));
  const script = args.script
    ? JSON.parse(await readFile(args.script, 'utf8'))
    : DEFAULT_SCRIPT;
  const mock = await startMockServer({ port: args.port, script, mode: args.mode });
  const base = args.mode === 'gemini' ? `http://localhost:${mock.port}/v1beta` : `http://localhost:${mock.port}/v1`;
  console.log(`Mock ${args.mode} server listening on ${base}`);
  console.log(`Scripted actions: ${script.length}`);
}
