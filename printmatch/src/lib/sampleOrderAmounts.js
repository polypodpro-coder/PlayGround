import { selectFulfillment } from './fulfillment.js';

// Preview-only arithmetic. Accepted quote terms determine fees, never UI totals.
export function sampleOrderAmounts(quote, method, tipPercent = 0) {
  const option = selectFulfillment(quote, method);
  if (![0, 10, 15, 20].includes(tipPercent)) throw new Error('Choose a listed sample tip amount.');
  const printCents = Math.round(quote.price * 100);
  if (!Number.isSafeInteger(printCents) || printCents < 0) throw new Error('The sample price is invalid.');
  const tipCents = Math.round(printCents * tipPercent / 100);
  return { deliveryMethod: option.id, fulfillmentFeeCents: option.feeCents, shippingFee: option.feeCents / 100, tip: tipCents / 100, total: (printCents + option.feeCents + tipCents) / 100, creditsUsed: 0, serviceFee: 0 };
}
