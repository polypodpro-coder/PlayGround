/**
 * A stand-in for LM Studio, so the whole extension can be exercised without a
 * GPU. It speaks just enough of the OpenAI-compatible API for the client:
 * GET /v1/models and POST /v1/chat/completions.
 *
 * Each chat completion returns the next action from a script. Point the
 * extension's endpoint at http://localhost:1234/v1 in Options and it will
 * believe it is talking to a real model.
 *
 *   node test/mock-llm-server.mjs [--port 1234] [--script path/to/script.json]
 *
 * The script is a JSON array of raw action objects. POST /__script replaces it
 * and rewinds, which is how the automated tests drive different scenarios.
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
  const args = { port: 1234, script: null };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--port') args.port = Number(argv[++i]);
    if (argv[i] === '--script') args.script = argv[++i];
  }
  return args;
}

export async function startMockServer({ port = 1234, script = DEFAULT_SCRIPT } = {}) {
  let actions = [...script];
  let cursor = 0;
  const requests = [];

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

    if (req.url.endsWith('/models')) {
      return json(200, { object: 'list', data: [{ id: 'mock-model', object: 'model' }] });
    }

    if (req.url.endsWith('/chat/completions')) {
      requests.push(body);
      const action = actions[cursor] ?? {
        reasoning: 'The script ran out of actions.',
        tool: 'done',
        summary: 'mock script exhausted',
      };
      cursor += 1;
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
  const mock = await startMockServer({ port: args.port, script });
  console.log(`Mock LM Studio listening on http://localhost:${mock.port}/v1`);
  console.log(`Scripted actions: ${script.length}`);
}
