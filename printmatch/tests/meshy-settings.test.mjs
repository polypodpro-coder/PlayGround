import test from 'node:test';
import assert from 'node:assert/strict';
import {
  safeProxyUrl, isPlausibleApiKey, isMeshyConfigured,
  readMeshySettings, saveMeshySettings, clearMeshySettings,
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
  assert.deepEqual(readMeshySettings(store), { apiKey: '', proxyUrl: '' });
  saveMeshySettings({ apiKey: '  msy_abcdefgh  ', proxyUrl: '  https://w.example.dev  ' }, store);
  assert.deepEqual(readMeshySettings(store), { apiKey: 'msy_abcdefgh', proxyUrl: 'https://w.example.dev' });
  clearMeshySettings(store);
  assert.deepEqual(readMeshySettings(store), { apiKey: '', proxyUrl: '' });
});
