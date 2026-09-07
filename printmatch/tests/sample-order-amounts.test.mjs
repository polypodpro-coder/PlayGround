import test from 'node:test';
import assert from 'node:assert/strict';
import { sampleOrderAmounts } from '../src/lib/sampleOrderAmounts.js';
const quote = { price: 17.89, fulfillmentPreference: 'any', fulfillmentOptions: [{id:'pickup',label:'Farm pickup',feeCents:200}, {id:'dropoff',label:'Local drop-off',feeCents:525}] };
test('sample order includes the chosen farm fee and integer-cent tip', () => {
  const result = sampleOrderAmounts(quote, 'dropoff', 15);
  assert.equal(result.fulfillmentFeeCents,525); assert.equal(result.tip,2.68); assert.equal(result.total,25.82);
  assert.equal(result.deliveryMethod,'dropoff'); assert.equal(result.serviceFee,0);
});
test('pickup uses its listed fee instead of assuming free collection', () => {
  assert.equal(sampleOrderAmounts(quote,'pickup').total,19.89);
});
test('unavailable methods and unsupported tips cannot produce sample orders', () => {
  assert.throws(()=>sampleOrderAmounts(quote,'ship')); assert.throws(()=>sampleOrderAmounts(quote,'pickup',99));
});
