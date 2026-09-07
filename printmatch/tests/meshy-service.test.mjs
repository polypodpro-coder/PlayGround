import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTextTo3dPayload, buildImageTo3dPayload, clampProgress, isTerminalStatus,
  extractStlUrl, proxyEndpoint, taskStatusPath, MESHY_PATHS,
} from '../src/services/meshyService.js';

test('text-to-3d payload matches the Meshy preview contract', () => {
  const payload = buildTextTo3dPayload('  a small vase  ');
  assert.deepEqual(payload, { mode: 'preview', prompt: 'a small vase', art_style: 'realistic', target_formats: ['stl'] });
});

test('text-to-3d payload rejects an empty prompt', () => {
  assert.throws(() => buildTextTo3dPayload('   '), /prompt/i);
});

test('image-to-3d payload passes the Base64 data URI as image_url', () => {
  const uri = 'data:image/png;base64,AAAA';
  assert.deepEqual(buildImageTo3dPayload(uri), { image_url: uri, target_formats: ['stl'] });
});

test('image-to-3d payload rejects a non-data-uri', () => {
  assert.throws(() => buildImageTo3dPayload('https://example.com/x.png'), /reference image/i);
});

test('progress is clamped to an integer 0-100', () => {
  assert.equal(clampProgress(-5), 0);
  assert.equal(clampProgress(50.6), 51);
  assert.equal(clampProgress(999), 100);
  assert.equal(clampProgress('nope'), 0);
});

test('terminal statuses are recognized', () => {
  for (const s of ['SUCCEEDED', 'FAILED', 'CANCELED', 'EXPIRED']) assert.equal(isTerminalStatus(s), true);
  for (const s of ['PENDING', 'IN_PROGRESS', undefined]) assert.equal(isTerminalStatus(s), false);
});

test('extractStlUrl returns only a valid https STL url', () => {
  assert.equal(extractStlUrl({ model_urls: { stl: 'https://assets.meshy.ai/x.stl' } }), 'https://assets.meshy.ai/x.stl');
  assert.equal(extractStlUrl({ model_urls: { glb: 'https://assets.meshy.ai/x.glb' } }), null);
  assert.equal(extractStlUrl({ model_urls: { stl: 'ftp://x' } }), null);
  assert.equal(extractStlUrl(null), null);
});

test('proxyEndpoint joins a valid https proxy with a path and rejects bad proxies', () => {
  assert.equal(proxyEndpoint('https://w.example.dev/', '/openapi/v2/text-to-3d'), 'https://w.example.dev/openapi/v2/text-to-3d');
  assert.equal(proxyEndpoint('https://w.example.dev', 'openapi/x'), 'https://w.example.dev/openapi/x');
  assert.throws(() => proxyEndpoint('http://insecure.dev', '/x'), /proxy/i);
  assert.throws(() => proxyEndpoint('', '/x'), /proxy/i);
});

test('taskStatusPath uses the right versioned endpoint per kind', () => {
  assert.equal(taskStatusPath('text', 'abc'), `${MESHY_PATHS.text}/abc`);
  assert.equal(taskStatusPath('image', 'abc'), `${MESHY_PATHS.image}/abc`);
  assert.equal(taskStatusPath('anything-else', 'a b'), `${MESHY_PATHS.text}/a%20b`);
});
