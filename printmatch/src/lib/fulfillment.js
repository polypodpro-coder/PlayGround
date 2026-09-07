// Sample fulfillment terms are farm-controlled; absence is never implied consent.
export const FULFILLMENT_METHODS = Object.freeze([
  Object.freeze({ id: 'pickup', label: 'Farm pickup', detail: 'Collect from the farm at a mutually confirmed time.' }),
  Object.freeze({ id: 'dropoff', label: 'Local drop-off', detail: 'Farm-arranged drop-off within its confirmed local service area.' }),
  Object.freeze({ id: 'ship', label: 'US shipping', detail: 'Ship to a confirmed US address using the farm’s agreed service.' }),
]);
const validFee = (feeCents) => Number.isSafeInteger(feeCents) && feeCents >= 0 && feeCents <= 100000;
const methodById = (id) => FULFILLMENT_METHODS.find((method) => method.id === id);

export function getFulfillmentOptions(farm) {
  const config = farm?.fulfillmentOptions;
  if (!config || typeof config !== 'object' || Array.isArray(config)) return [];
  return FULFILLMENT_METHODS.flatMap((method) => {
    if (!Object.hasOwn(config, method.id)) return [];
    const option = config[method.id];
    if (!option || typeof option !== 'object' || Array.isArray(option) ||
        !Object.hasOwn(option, 'enabled') || !Object.hasOwn(option, 'feeCents') || option.enabled !== true || !validFee(option.feeCents)) return [];
    return [{ ...method, feeCents: option.feeCents }];
  });
}

export function fulfillmentLabel(id) {
  return methodById(id)?.label || 'Fulfillment not selected';
}

export function selectFulfillment(quote, method) {
  const descriptor = methodById(method);
  const options = quote?.fulfillmentOptions;
  if (!descriptor || !Array.isArray(options) || options.length === 0) {
    throw new Error('Choose a fulfillment method offered in the current sample quote.');
  }
  const preference = quote.fulfillmentPreference === undefined ? 'any' : quote.fulfillmentPreference;
  if ((preference !== 'any' && !methodById(preference)) || (preference !== 'any' && preference !== method)) {
    throw new Error('Choose the fulfillment method specified in the submitted request.');
  }
  const seen = new Set();
  for (const option of options) {
    if (!option || !methodById(option.id) || !validFee(option.feeCents) || seen.has(option.id)) {
      throw new Error('This sample quote has invalid fulfillment terms. Return to quotes.');
    }
    seen.add(option.id);
  }
  const chosen = options.find((option) => option.id === method);
  if (!chosen) throw new Error('This fulfillment method is not available in the current sample quote.');
  // Use canonical method wording and the quoted fee, never caller-supplied labels/fees.
  return { ...descriptor, feeCents: chosen.feeCents };
}


