import test from 'node:test';
import assert from 'node:assert/strict';
import {
  safeProxyUrl, isPlausibleApiKey, isMeshyConfigured,
  readMeshySettings, saveMeshySettings, clearMeshySettings,
  DEFAULT_MESHY_PROXY_URL,
} from '../src/lib/meshySettings.js';

function fakeStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}

test('safeProxyUrl accepts https and normalizes trailing slashes', () => {
  assert.equal(safeProxyUrl('https://w.example.dev/'), 'https://w.example.dev');
  assert.equal(safeProxyUrl('  https://w.example.dev/api//  '), 'https://w.example.dev/api');
});

test('safeProxyUrl rejects non-https, credentials, and junk', () => {
  assert.equal(safeProxyUrl('http://w.example.dev'), null);
  assert.equal(safeProxyUrl('https://user:pass@w.example.dev'), null);
  assert.equal(safeProxyUrl('javascript:alert(1)'), null);
  assert.equal(safeProxyUrl(''), null);
  assert.equal(safeProxyUrl(null), null);
});

test('isPlausibleApiKey needs a non-trivial string', () => {
  assert.equal(isPlausibleApiKey('msy_abcdefgh'), true);
  assert.equal(isPlausibleApiKey('short'), false);
  assert.equal(isPlausibleApiKey(''), false);
  assert.equal(isPlausibleApiKey(undefined), false);
});

test('isMeshyConfigured requires both a key and a valid proxy', () => {
  assert.equal(isMeshyConfigured({ apiKey: 'msy_abcdefgh', proxyUrl: 'https://w.example.dev' }), true);
  assert.equal(isMeshyConfigured({ apiKey: 'msy_abcdefgh', proxyUrl: 'http://insecure' }), false);
  assert.equal(isMeshyConfigured({ apiKey: 'x', proxyUrl: 'https://w.example.dev' }), false);
  assert.equal(isMeshyConfigured({}), false);
});

test('read/save/clear round-trip through a storage backend', () => {
  const store = fakeStorage();
  assert.deepEqual(readMeshySettings(store), { apiKey: '', proxyUrl: DEFAULT_MESHY_PROXY_URL });
  saveMeshySettings({ apiKey: '  msy_abcdefgh  ', proxyUrl: '  https://w.example.dev  ' }, store);
  assert.deepEqual(readMeshySettings(store), { apiKey: 'msy_abcdefgh', proxyUrl: 'https://w.example.dev' });
  clearMeshySettings(store);
  assert.deepEqual(readMeshySettings(store), { apiKey: '', proxyUrl: DEFAULT_MESHY_PROXY_URL });
});

test('proxy URLs cannot hide API routes inside a query or fragment', () => {
  for (const value of ['https://worker.example/?tab=1', 'https://worker.example/#settings', 'https://worker.example/?', 'https://worker.example/#']) {
    assert.equal(safeProxyUrl(value), null);
  }
});

test('existing custom proxies are never silently replaced', () => {
  for (const proxyUrl of ['https://private.example', 'https://private.example/#invalid']) {
    assert.equal(readMeshySettings(fakeStorage({ 'ppp.meshy.proxyUrl': proxyUrl })).proxyUrl, proxyUrl);
  }
});

test('blocked storage still supplies the public proxy without fabricating credentials', () => {
  const store = { getItem() { throw new Error('blocked'); } };
  assert.deepEqual(readMeshySettings(store), { apiKey: '', proxyUrl: DEFAULT_MESHY_PROXY_URL });
});

test('API key validation rejects pasted whitespace, control characters and non-header text', () => {
  for (const apiKey of ['msy_one\nmsy_two', 'Bearer msy_example', 'msy_😀example']) {
    assert.equal(isPlausibleApiKey(apiKey), false);
  }
  assert.equal(isPlausibleApiKey('  msy_example  '), true);
});
