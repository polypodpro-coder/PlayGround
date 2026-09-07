import test from 'node:test';
import assert from 'node:assert/strict';
import { priceOrder, prepareDirectCheckout } from '../server/commerce.mjs';
import { isApiEnabled } from '../src/config/runtime.js';
const account = { id: 'acct_farm1', country: 'US', charges_enabled: true, payouts_enabled: true,
  capabilities: { card_payments: 'active' }, controller: { fees: { payer: 'account' }, losses: { payments: 'stripe' } } };
const quote = { id: 'quote_1', version: 1, buyerId: 'buyer1', sellerAccountId: account.id,
  status: 'accepted', currency: 'usd', expiresAt: 2000, fabricationCents: 2000,
  shippingCents: 500, taxCents: 200, platformFeeCents: 150,
  sellerTermsVersion: 'v1', platformTermsVersion: 'v1' };
const prepare = (changes = {}) => prepareDirectCheckout({ quote, account, buyerId: 'buyer1', now: 1000, ...changes });
test('API integration is disabled by default and requires an explicit flag', () => {
  assert.equal(isApiEnabled({ VITE_API_ENABLED: 'false' }), false);
  assert.equal(isApiEnabled({}), false);
  assert.equal(isApiEnabled({ VITE_API_ENABLED: 'true' }), true);
});
test('fee is deducted from seller proceeds, no buyer surcharge or default tip', () => {
  const result = prepare();
  assert.equal(result.totalCents, 2700);
  assert.equal(result.sellerGrossCents, 2550);
  assert.equal(result.buyerSurchargeCents, 0);
  assert.equal(result.tipCents, 0);
});
for (const invalid of [-1, 0.5, NaN, Infinity, '2000', Number.MAX_SAFE_INTEGER]) {
  test(`reject invalid money ${invalid}`, () => assert.throws(() => priceOrder({ ...quote, fabricationCents: invalid })));
}
test('reject fees exceeding the seller fabrication price', () => assert.throws(() => priceOrder({ ...quote, platformFeeCents: 2001 })));
for (const patch of [{ buyerId: 'other' }, { expiresAt: 1000 }, { expiresAt: NaN }, { status: 'draft' },
  { currency: 'eur' }, { sellerAccountId: 'acct_other' }, { platformTermsVersion: '' }, { version: 0 }]) {
  test(`reject quote ${JSON.stringify(patch)}`, () => assert.throws(() => prepare({ quote: { ...quote, ...patch } })));
}
for (const patch of [{ country: 'CA' }, { payouts_enabled: false }, { charges_enabled: false },
  { controller: { fees: { payer: 'application' }, losses: { payments: 'application' } } }]) {
  test(`reject seller ${JSON.stringify(patch)}`, () => assert.throws(() => prepare({ account: { ...account, ...patch } })));
}
test('retries share a key; approved revisions have new keys', () => {
  assert.equal(prepare().idempotencyKey, prepare().idempotencyKey);
  assert.notEqual(prepare().idempotencyKey, prepare({ quote: { ...quote, version: 2 } }).idempotencyKey);
});

