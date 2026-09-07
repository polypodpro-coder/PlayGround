import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPreviewQuotes, requireCurrentPreviewQuote } from '../src/lib/previewQuotes.js';
const request = { material: 'PLA', selectedMachineId: 'sample-machine', selectedAddons: ['finish'], estimatedGrams: 55, quantity: 3, directRequestPrinterId: null };
const inputs = { request, farms: [{ id: 'p1', shopPaused: false, status: 'available', materials: ['PLA', 'PETG'], fulfillmentOptions: { pickup: { enabled: true, feeCents: 0 } } }, { id: 'p2', shopPaused: false, status: 'available', materials: ['PLA'], fulfillmentOptions: { pickup: { enabled: true, feeCents: 0 } } }], templates: [{ id: 'q1', printerId: 'p1', price: 10, color: 'Orange' }, { id: 'q2', printerId: 'p2', price: 12, color: 'Orange' }], materials: { PLA: { multiplier: 1 }, PETG: { multiplier: 1.33 } }, addons: [{ id: 'finish', cost: 12.5 }] };

test('submitted request fixes material, machine, finishing and per-piece quantity pricing', () => {
  const quote = buildPreviewQuotes({ ...inputs, selectedMaterial: 'PETG', selectedMachineId: 'unsaved-machine', selectedAddons: [] })[0];
  assert.equal(quote.material, 'PLA'); assert.equal(quote.machineId, 'sample-machine');
  assert.deepEqual(quote.addons, ['finish']); assert.equal(quote.quantity, 3);
  assert.equal(quote.price, (10 + 12.5) * 3);
});

test('only submitting a new request changes committed quote specifications', () => {
  const old = buildPreviewQuotes(inputs)[0];
  const next = buildPreviewQuotes({ ...inputs, request: { ...request, material: 'PETG', selectedMachineId: 'new-machine', quantity: 2 } })[0];
  assert.equal(old.material, 'PLA'); assert.equal(old.quantity, 3);
  assert.equal(next.material, 'PETG'); assert.equal(next.quantity, 2);
  assert.throws(() => requireCurrentPreviewQuote(old, [next]), /no longer available/);
});

test('paused, offline, removed and unsupported farms invalidate accepted quotes before orders', () => {
  const selected = buildPreviewQuotes(inputs)[0];
  for (const change of [{ shopPaused: true }, { status: 'offline' }, { materials: ['TPU'] }]) {
    const current = buildPreviewQuotes({ ...inputs, farms: inputs.farms.map((farm) => farm.id === 'p1' ? { ...farm, ...change } : farm) });
    assert.throws(() => requireCurrentPreviewQuote(selected, current), /no longer available/);
  }
  assert.throws(() => requireCurrentPreviewQuote(selected, buildPreviewQuotes({ ...inputs, farms: [] })), /no longer available/);
});

test('the farm selection comes from the submitted request, not unsaved controls', () => {
  const quotes = buildPreviewQuotes({ ...inputs, directRequestPrinterId: 'p2' });
  assert.equal(quotes.length, 2);
  const direct = buildPreviewQuotes({ ...inputs, request: { ...request, directRequestPrinterId: 'p2' } });
  assert.equal(direct.length, 1); assert.equal(direct[0].printerId, 'p2');
});

test('equal-price changes to specifications still invalidate the old quote', () => {
  const selected = buildPreviewQuotes(inputs)[0];
  for (const changed of [{ machineId: 'different' }, { material: 'PETG' }, { quantity: 99 }, { addons: [] }, { printerId: 'p2' }]) {
    assert.throws(() => requireCurrentPreviewQuote(selected, [{ ...selected, ...changed }]), /no longer available/);
  }
  assert.equal(requireCurrentPreviewQuote(selected, [selected]), selected);
});

test('missing or invalid requests do not invent quotes', () => {
  assert.deepEqual(buildPreviewQuotes({ ...inputs, request: null }), []);
  assert.deepEqual(buildPreviewQuotes({ ...inputs, request: { ...request, material: 'unknown' } }), []);
  assert.deepEqual(buildPreviewQuotes({ ...inputs, request: { ...request, selectedAddons: ['unknown'] } }), []);
  assert.deepEqual(buildPreviewQuotes({ ...inputs, request: { ...request, quantity: -2 } }), []);
});

