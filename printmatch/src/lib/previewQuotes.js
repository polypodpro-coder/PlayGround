import { previewPrice } from './previewPricing.js';
import { FULFILLMENT_METHODS, getFulfillmentOptions } from './fulfillment.js';

// A bounding-box fit is a screening check, never a manufacturability approval.
export function fitsBuildVolume(dimensions, buildVolume) {
  if (dimensions == null) return true; // Concept references have no measured mesh.
  const part = ['x','y','z'].map(axis=>dimensions[axis]).sort((a,b)=>a-b);
  const bed = ['x','y','z'].map(axis=>buildVolume?.[axis]).sort((a,b)=>a-b);
  if (![...part,...bed].every(value=>typeof value === 'number' && Number.isFinite(value) && value > 0)) return false;
  return part.every((value,index)=>value <= bed[index]);
}

function serviceAreaSnapshot(farm) {
  const location = farm.location;
  const validLocation = Array.isArray(location) && location.length === 2 &&
    location.every(Number.isFinite) && Math.abs(location[0]) <= 90 && Math.abs(location[1]) <= 180;
  return {
    radiusMi: Number.isFinite(farm.serviceRadiusMi) && farm.serviceRadiusMi >= 0 ? farm.serviceRadiusMi : null,
    location: validLocation ? [...location] : null,
  };
}

// Only the submitted request defines a quote. Editable controls are separate.
export function buildPreviewQuotes({ request, farms = [], templates = [], materials = {}, addons = [] } = {}) {
  if (!request || !materials[request.material] || !Array.isArray(farms) || !Array.isArray(templates) || !Array.isArray(addons)) return [];
  const preference = request.fulfillmentPreference === undefined ? 'any' : request.fulfillmentPreference;
  if (preference !== 'any' && !FULFILLMENT_METHODS.some((method) => method.id === preference)) return [];
  const ids = request.selectedAddons || [];
  if (!Array.isArray(ids) || ids.some((id) => !addons.some((addon) => addon.id === id))) return [];
  const addonCost = ids.reduce((sum, id) => sum + addons.find((addon) => addon.id === id).cost, 0);
  const candidates = request.directRequestPrinterId ? [{ id: `direct-${request.directRequestPrinterId}`, jobId: 'direct', printerId: request.directRequestPrinterId, price: 18.5, etaHours: 48, color: 'As specified' }] : templates;
  try {
    return candidates.flatMap((quote) => {
      const farm = farms.find((item) => item?.id === quote.printerId);
      if (!farm || farm.shopPaused || !['available', 'printing'].includes(farm.status) ||
          !Array.isArray(farm.materials) || !farm.materials.includes(request.material) ||
          !fitsBuildVolume(request.dimensions, farm.buildVolume)) return [];
      const fulfillmentOptions = getFulfillmentOptions(farm);
      if (!fulfillmentOptions.length || (preference !== 'any' && !fulfillmentOptions.some((method) => method.id === preference))) return [];
      const pricing = previewPrice({ unitPrice: quote.price, grams: Number(request.estimatedGrams), quantity: Number(request.quantity ?? 1), multiplier: materials[request.material].multiplier, addons: addonCost });
      const feeCents = preference === 'any'
        ? Math.min(...fulfillmentOptions.map((method) => method.feeCents))
        : fulfillmentOptions.find((method) => method.id === preference).feeCents;
      return [{
        ...quote, ...pricing, material: request.material, machineId: request.selectedMachineId || null,
        addons: [...ids], isPreview: true, fulfillmentOptions, fulfillmentPreference: preference,
        serviceArea: serviceAreaSnapshot(farm),
        comparisonTotalCents: Math.round(pricing.price * 100) + feeCents,
      }];
    });
  } catch { return []; }
}

function quoteIdentity(quote) {
  if (!quote || !Array.isArray(quote.fulfillmentOptions) || !quote.fulfillmentOptions.length) return null;
  const options = quote.fulfillmentOptions.map((option) => [
    option?.id, option?.label, option?.detail, option?.feeCents,
  ]).sort((left, right) => String(left[0]).localeCompare(String(right[0])));
  return JSON.stringify([
    quote.id, quote.printerId, quote.price, quote.quantity, quote.material, quote.color,
    quote.machineId || null, [...(quote.addons || [])].sort(),
    options, quote.fulfillmentPreference, quote.serviceArea?.radiusMi, quote.serviceArea?.location,
    quote.comparisonTotalCents,
  ]);
}

export function requireCurrentPreviewQuote(selected, quotes) {
  const selectedIdentity = quoteIdentity(selected);
  const current = selectedIdentity && Array.isArray(quotes) && quotes.find((quote) =>
    quote.id === selected.id && quoteIdentity(quote) === selectedIdentity);
  if (!current) throw new Error('This sample quote is no longer available. Return to quotes to select a current option.');
  return current;
}

