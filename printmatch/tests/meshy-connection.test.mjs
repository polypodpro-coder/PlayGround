import test from 'node:test';
import assert from 'node:assert/strict';
import { checkMeshyConnection, checkMeshyProxy, createTask, pollTask } from '../src/services/meshyService.js';

const proxyUrl = 'https://worker.example';
const apiKey = 'msy_test_only_not_a_real_key';
const options = { proxyUrl, apiKey };
const jsonResponse = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

test('connection check only lists one existing task and returns no task data', async (t) => {
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => jsonResponse([{ id: 'existing-task', status: 'SUCCEEDED' }]));
  assert.equal(await checkMeshyConnection({ ...options, apiKey: `  ${apiKey}  ` }), true);
  assert.equal(fetchMock.mock.callCount(), 1);
  const [url, init] = fetchMock.mock.calls[0].arguments;
  assert.equal(url, `${proxyUrl}/openapi/v2/text-to-3d?page_size=1`);
  assert.equal(init.method, 'GET');
  assert.equal(Object.hasOwn(init, 'body'), false);
  assert.deepEqual(init.headers, { 'X-User-Meshy-Key': apiKey });
  assert.equal(init.credentials, 'omit');
  assert.equal(init.redirect, 'error');
});

test('connection check accepts an account with no tasks', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => jsonResponse([]));
  assert.equal(await checkMeshyConnection(options), true);
});

for (const body of ['<html>Wrong site</html>', '', 'null', 'true', '{}', '[true]', '[{}]']) {
  test(`connection check rejects an unexpected successful response: ${JSON.stringify(body)}`, async (t) => {
    t.mock.method(globalThis, 'fetch', async () => new Response(body, { status: 200 }));
    await assert.rejects(checkMeshyConnection(options), /unexpected response.*Proxy URL/i);
  });
}

for (const [status, expected] of [[401, /API key.*reconnect/i], [402, /API credits/i], [403, /permissions.*origin/i], [404, /endpoint.*Proxy URL/i], [429, /too many requests/i]]) {
  test(`connection check gives a useful HTTP ${status} error without echoing the key`, async (t) => {
    t.mock.method(globalThis, 'fetch', async () => jsonResponse({ error: { message: `Upstream echo: ${apiKey}` } }, status));
    await assert.rejects(checkMeshyConnection(options), (failure) => expected.test(failure.message) && !failure.message.includes(apiKey));
  });
}

test('other upstream errors redact raw and encoded submitted keys', async (t) => {
  const unusualKey = 'test+key/only-for-redaction';
  t.mock.method(globalThis, 'fetch', async () => jsonResponse({ message: `Rejected ${unusualKey}; encoded ${encodeURIComponent(unusualKey)}; ${apiKey}` }, 400));
  await assert.rejects(checkMeshyConnection({ ...options, apiKey: unusualKey }), (failure) => {
    assert.match(failure.message, /HTTP 400/);
    assert.match(failure.message, /\[redacted\]/);
    assert.equal(failure.message.includes(unusualKey), false);
    assert.equal(failure.message.includes(encodeURIComponent(unusualKey)), false);
    assert.equal(failure.message.includes(apiKey), false);
    return true;
  });
});

test('network and redirect failures show connection guidance without reflecting their contents', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => { throw new TypeError(`Failed to fetch ${apiKey}`); });
  await assert.rejects(checkMeshyConnection(options), (failure) => /Could not reach.*proxy/i.test(failure.message) && /site/.test(failure.message) && !failure.message.includes(apiKey));
});

test('failure while reading a response also receives connection guidance', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => ({ text: async () => { throw new TypeError('Stream failed'); } }));
  await assert.rejects(checkMeshyConnection(options), /Could not reach the Meshy proxy/);
});

test('missing key is rejected before any request', async (t) => {
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => { throw new Error('Unexpected request'); });
  await assert.rejects(checkMeshyConnection({ proxyUrl, apiKey: '  ' }), /Add your Meshy API key/);
  assert.equal(fetchMock.mock.callCount(), 0);
});

function pendingFetch(t) {
  return t.mock.method(globalThis, 'fetch', (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason), { once: true });
  }));
}

test('connection check preserves cancellation and removes its listener', async (t) => {
  const controller = new AbortController();
  const removeListener = t.mock.method(controller.signal, 'removeEventListener');
  pendingFetch(t);
  const reason = new DOMException('Check canceled', 'AbortError');
  const pending = checkMeshyConnection({ ...options, signal: controller.signal });
  controller.abort(reason);
  await assert.rejects(pending, (failure) => failure === reason);
  assert.equal(removeListener.mock.callCount(), 1);
});

test('already canceled checks make no request', async (t) => {
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => { throw new Error('Unexpected request'); });
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(checkMeshyConnection({ ...options, signal: controller.signal }), { name: 'AbortError' });
  assert.equal(fetchMock.mock.callCount(), 0);
});

test('connection checks time out after 15 seconds', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const fetchMock = pendingFetch(t);
  const pending = checkMeshyConnection(options);
  t.mock.timers.tick(15_000);
  await assert.rejects(pending, /connection check timed out/i);
  assert.equal(fetchMock.mock.calls[0].arguments[1].signal.aborted, true);
});

test('successful checks clear their timeout', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => jsonResponse([]));
  assert.equal(await checkMeshyConnection(options), true);
  t.mock.timers.tick(15_000);
  assert.equal(fetchMock.mock.calls[0].arguments[1].signal.aborted, false);
});

test('service check recognizes the proxy without sending a key or creating a task', async (t) => {
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => jsonResponse({ error: { message: 'Missing X-User-Meshy-Key header.' } }, 401));
  assert.equal(await checkMeshyProxy({ proxyUrl }), true);
  const [url, init] = fetchMock.mock.calls[0].arguments;
  assert.equal(url, `${proxyUrl}/openapi/v2/text-to-3d?page_size=1`);
  assert.equal(init.method, 'GET');
  assert.equal(Object.hasOwn(init, 'body'), false);
  assert.deepEqual(init.headers, {});
  assert.equal(init.credentials, 'omit');
  assert.equal(init.redirect, 'error');
});

for (const [status, data, expected] of [
  [200, [], /unexpected response/i],
  [401, { message: 'Login required' }, /unexpected response/i],
  [403, { error: { message: 'Origin not allowed' } }, /origin/i],
]) {
  test(`service check rejects an unrelated or inaccessible endpoint (HTTP ${status})`, async (t) => {
    t.mock.method(globalThis, 'fetch', async () => jsonResponse(data, status));
    await assert.rejects(checkMeshyProxy({ proxyUrl }), expected);
  });
}

test('service checks have the same bounded timeout', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  pendingFetch(t);
  const pending = checkMeshyProxy({ proxyUrl });
  t.mock.timers.tick(15_000);
  await assert.rejects(pending, /connection check timed out/i);
});

test('generation requests retain their JSON body while omitting cookies and refusing redirects', async (t) => {
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => jsonResponse({ result: 'new-task' }));
  assert.equal(await createTask({ ...options, kind: 'text', prompt: 'A vase' }), 'new-task');
  const [url, init] = fetchMock.mock.calls[0].arguments;
  assert.equal(url, `${proxyUrl}/openapi/v2/text-to-3d`);
  assert.equal(init.method, 'POST');
  assert.equal(JSON.parse(init.body).prompt, 'A vase');
  assert.equal(init.headers['Content-Type'], 'application/json');
  assert.equal(init.credentials, 'omit');
  assert.equal(init.redirect, 'error');
});

test('task failure messages also redact an echoed API key', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => jsonResponse({ status: 'FAILED', task_error: { message: `Task rejected ${apiKey}` } }));
  await assert.rejects(pollTask({ ...options, kind: 'text', taskId: 'existing-task' }), (failure) => failure.message.includes('[redacted]') && !failure.message.includes(apiKey));
});
