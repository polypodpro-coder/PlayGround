import test from 'node:test';
import assert from 'node:assert/strict';
import { FULFILLMENT_METHODS, getFulfillmentOptions, fulfillmentLabel, selectFulfillment } from '../src/lib/fulfillment.js';
import { buildPreviewQuotes, requireCurrentPreviewQuote } from '../src/lib/previewQuotes.js';

const config = () => ({
  pickup: { enabled: true, feeCents: 0 },
  dropoff: { enabled: true, feeCents: 500 },
  ship: { enabled: true, feeCents: 600 },
});
const farm = (id, overrides = {}) => ({
  id, status: 'available', shopPaused: false, materials: ['PLA'],
  serviceRadiusMi: 10, location: [39.786, -89.644], fulfillmentOptions: config(), ...overrides,
});
const inputs = (overrides = {}) => ({
  request: { material: 'PLA', estimatedGrams: 55, quantity: 2, selectedAddons: [] },
  farms: [farm('f1'), farm('f2', { fulfillmentOptions: { ship: { enabled: true, feeCents: 900 } } })],
  templates: [{ id: 'q1', printerId: 'f1', price: 10 }, { id: 'q2', printerId: 'f2', price: 12 }],
  materials: { PLA: { multiplier: 1 } }, addons: [], ...overrides,
});

test('fulfillment methods share stable IDs and buyer-facing wording', () => {
  assert.deepEqual(FULFILLMENT_METHODS.map(({ id, label }) => [id, label]), [
    ['pickup', 'Farm pickup'], ['dropoff', 'Local drop-off'], ['ship', 'US shipping'],
  ]);
  assert.equal(fulfillmentLabel('dropoff'), 'Local drop-off');
  assert.equal(fulfillmentLabel('unknown'), 'Fulfillment not selected');
});
test('missing, malformed and inherited farm configuration never implies availability', () => {
  for (const value of [undefined, null, [], {}, 'pickup', true, 100]) {
    assert.deepEqual(getFulfillmentOptions({ fulfillmentOptions: value }), []);
  }
  assert.deepEqual(getFulfillmentOptions(null), []);
  assert.deepEqual(getFulfillmentOptions({ fulfillmentOptions: Object.create({ pickup: { enabled: true, feeCents: 0 } }) }), []);
  assert.deepEqual(getFulfillmentOptions({ fulfillmentOptions: { pickup: Object.create({ enabled: true, feeCents: 0 }) } }), []);
  assert.deepEqual(getFulfillmentOptions({ fulfillmentOptions: { teleport: { enabled: true, feeCents: 0 } } }), []);
});
test('only explicitly enabled options with integer bounded USD fees are offered', () => {
  for (const feeCents of [-1, 0.5, '500', NaN, Infinity, 100001, Number.MAX_SAFE_INTEGER]) {
    assert.deepEqual(getFulfillmentOptions({ fulfillmentOptions: { pickup: { enabled: true, feeCents } } }), []);
  }
  for (const option of [{}, { enabled: true }, { feeCents: 0 }, { enabled: false, feeCents: 0 },
    { enabled: 1, feeCents: 0 }, null, []]) {
    assert.deepEqual(getFulfillmentOptions({ fulfillmentOptions: { pickup: option } }), []);
  }
  assert.deepEqual(getFulfillmentOptions({ fulfillmentOptions: { ship: { enabled: true, feeCents: 100000 } } })
    .map(({ id, feeCents }) => [id, feeCents]), [['ship', 100000]]);
  assert.equal(getFulfillmentOptions(farm('f1'))[0].feeCents, 0);
});
test('fulfillment helper results do not alias farm configuration or shared descriptions', () => {
  const source = farm('f1');
  const options = getFulfillmentOptions(source);
  source.fulfillmentOptions.ship.feeCents = 2000;
  assert.equal(options.find(({ id }) => id === 'ship').feeCents, 600);
  options[0].label = 'Changed';
  assert.equal(FULFILLMENT_METHODS[0].label, 'Farm pickup');
  assert.equal(getFulfillmentOptions(source)[0].label, 'Farm pickup');
});
test('any preference defaults to farms with at least one explicit option and uses the lowest fee once per order', () => {
  const quotes = buildPreviewQuotes(inputs());
  assert.equal(quotes.length, 2);
  assert.equal(quotes[0].fulfillmentPreference, 'any');
  assert.equal(quotes[0].comparisonTotalCents, 2000);
  assert.equal(quotes[1].comparisonTotalCents, 3300);
  const noMethods = inputs({ farms: [farm('f1', { fulfillmentOptions: {} }), farm('f2', { fulfillmentOptions: undefined })] });
  assert.deepEqual(buildPreviewQuotes(noMethods), []);
});
test('specific request preferences filter farms and include that method fee in comparison totals', () => {
  const args = inputs();
  const ship = buildPreviewQuotes({ ...args, request: { ...args.request, fulfillmentPreference: 'ship' } });
  assert.deepEqual(ship.map(({ printerId, comparisonTotalCents }) => [printerId, comparisonTotalCents]), [['f1', 2600], ['f2', 3300]]);
  for (const [preference, expected] of [['pickup', 2000], ['dropoff', 2500]]) {
    const quotes = buildPreviewQuotes({ ...args, request: { ...args.request, fulfillmentPreference: preference } });
    assert.equal(quotes.length, 1); assert.equal(quotes[0].printerId, 'f1');
    assert.equal(quotes[0].comparisonTotalCents, expected);
  }
});
test('unknown and malformed request preferences fail closed, including direct farm requests', () => {
  const args = inputs();
  for (const fulfillmentPreference of ['', null, 'shipping', 'Any', {}, ['ship'], 0]) {
    assert.deepEqual(buildPreviewQuotes({ ...args, request: { ...args.request, fulfillmentPreference } }), []);
  }
  assert.deepEqual(buildPreviewQuotes({ ...args, request: { ...args.request, directRequestPrinterId: 'f2', fulfillmentPreference: 'dropoff' } }), []);
});
test('farm fees, enabled methods, service radius and location are accepted quote terms', () => {
  for (const change of [
    (source) => { source.fulfillmentOptions.ship.feeCents = 700; },
    (source) => { source.fulfillmentOptions.ship.enabled = false; },
    (source) => { source.serviceRadiusMi = 12; },
    (source) => { source.location[0] = 40; },
    (source) => { source.location[1] = -90; },
  ]) {
    const args = inputs();
    const selected = buildPreviewQuotes(args)[0];
    change(args.farms[0]);
    const current = buildPreviewQuotes(args);
    assert.throws(() => requireCurrentPreviewQuote(selected, current), /no longer available/);
  }
});
test('changed preference invalidates an old quote even when the displayed comparison total is unchanged', () => {
  const args = inputs();
  const selected = buildPreviewQuotes(args)[0];
  const current = buildPreviewQuotes({ ...args, request: { ...args.request, fulfillmentPreference: 'pickup' } });
  assert.equal(selected.comparisonTotalCents, current[0].comparisonTotalCents);
  assert.throws(() => requireCurrentPreviewQuote(selected, current), /no longer available/);
});
test('quotes snapshot methods, fees and service-area coordinates without mutable farm aliases', () => {
  const args = inputs();
  const quote = buildPreviewQuotes(args)[0];
  assert.deepEqual(quote.serviceArea, { radiusMi: 10, location: [39.786, -89.644] });
  assert.notEqual(quote.serviceArea.location, args.farms[0].location);
  args.farms[0].location[0] = 20;
  args.farms[0].fulfillmentOptions.pickup.feeCents = 100;
  args.farms[0].fulfillmentOptions.ship.enabled = false;
  assert.deepEqual(quote.serviceArea.location, [39.786, -89.644]);
  assert.equal(quote.fulfillmentOptions[0].feeCents, 0);
  assert.equal(quote.fulfillmentOptions.length, 3);
});
test('selecting fulfillment uses the quote fee and returns an independent canonical option', () => {
  const quote = buildPreviewQuotes(inputs())[0];
  const selected = selectFulfillment(quote, 'ship');
  assert.deepEqual(selected, { ...FULFILLMENT_METHODS[2], feeCents: 600 });
  selected.feeCents = 1;
  assert.equal(quote.fulfillmentOptions.find(({ id }) => id === 'ship').feeCents, 600);
  // Minimal stored snapshots remain valid; display text is supplied by the helper.
  assert.equal(selectFulfillment({ fulfillmentOptions: [{ id: 'pickup', label: 'Legacy label', feeCents: 0 }] }, 'pickup').label, 'Farm pickup');
});
test('unavailable, malformed and ambiguous fulfillment selections are rejected', () => {
  const quote = buildPreviewQuotes(inputs())[1];
  for (const method of ['pickup', 'unknown', undefined, { id: 'ship', feeCents: 0 }]) {
    assert.throws(() => selectFulfillment(quote, method));
  }
  for (const options of [undefined, [], [{ id: 'ship', feeCents: -1 }],
    [{ id: 'ship', feeCents: 600 }, { id: 'ship', feeCents: 1 }]]) {
    assert.throws(() => selectFulfillment({ fulfillmentOptions: options }, 'ship'));
  }
});
test('checkout selection cannot override the submitted specific fulfillment preference', () => {
  const args = inputs();
  const quote = buildPreviewQuotes({ ...args, request: { ...args.request, fulfillmentPreference: 'ship' } })[0];
  assert.throws(() => selectFulfillment(quote, 'pickup'), /submitted request/);
  assert.throws(() => selectFulfillment(quote, 'dropoff'), /submitted request/);
  assert.equal(selectFulfillment(quote, 'ship').feeCents, 600);
  assert.throws(() => selectFulfillment({ ...quote, fulfillmentPreference: 'unknown' }, 'ship'), /submitted request/);
});

