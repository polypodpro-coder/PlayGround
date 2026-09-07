// Server-side domain rules. These are not an HTTP API or payment integration.
// Call only with records loaded by an authenticated, authorized server handler.
const MAX_CENTS = 10_000_000;
function cents(value, name) {
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_CENTS) {
    throw new Error(`Invalid ${name}`);
  }
  return value;
}
export function priceOrder({ fabricationCents, shippingCents, taxCents, platformFeeCents, tipCents = 0 }) {
  // Seller quote already includes its processing/operating costs. No buyer surcharge.
  const fabrication = cents(fabricationCents, "fabrication");
  const shipping = cents(shippingCents, "shipping");
  const tax = cents(taxCents, "tax");
  const fee = cents(platformFeeCents, "platform fee");
  const tip = cents(tipCents, "tip");
  if (fee > fabrication) throw new Error("Fee exceeds fabrication price");
  const total = cents(fabrication + shipping + tax + tip, "total");
  if (total === 0 || fee >= total) throw new Error("Invalid payable total");
  return Object.freeze({ totalCents: total, platformFeeCents: fee, sellerGrossCents: total - fee,
    buyerSurchargeCents: 0, fabricationCents: fabrication, shippingCents: shipping, taxCents: tax, tipCents: tip });
}
export function assertSellerReady(account) {
  if (!account || !/^acct_[A-Za-z0-9]+$/.test(account.id || "") || account.country !== "US" ||
      account.charges_enabled !== true || account.payouts_enabled !== true ||
      account.capabilities?.card_payments !== "active" ||
      account.controller?.fees?.payer !== "account" ||
      account.controller?.losses?.payments !== "stripe") {
    throw new Error("Seller payment configuration is not approved");
  }
}
export function prepareDirectCheckout({ quote, buyerId, account, now = Date.now() }) {
  assertSellerReady(account);
  if (!quote || typeof buyerId !== "string" || !buyerId || quote.buyerId !== buyerId ||
      quote.sellerAccountId !== account.id || quote.status !== "accepted" ||
      quote.currency !== "usd" || !Number.isFinite(now) ||
      !Number.isFinite(quote.expiresAt) || quote.expiresAt <= now ||
      typeof quote.id !== "string" || !/^[A-Za-z0-9_-]{1,100}$/.test(quote.id) ||
      !Number.isSafeInteger(quote.version) || quote.version < 1 ||
      !quote.sellerTermsVersion || !quote.platformTermsVersion) {
    throw new Error("Quote is not eligible for checkout");
  }
  const amounts = priceOrder(quote);
  return Object.freeze({
    connectedAccountId: account.id,
    idempotencyKey: `checkout:${quote.id}:v${quote.version}`,
    quoteId: quote.id,
    currency: "usd",
    ...amounts,
  });
}
