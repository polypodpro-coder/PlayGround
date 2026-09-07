import { prepareDirectCheckout } from './commerce.mjs';
import { fail, validateHostedURL } from './security.mjs';

const TYPES = new Set(['checkout.session.completed', 'checkout.session.async_payment_succeeded',
  'checkout.session.async_payment_failed', 'checkout.session.expired']);
export function assertLaunchQuote(quote) {
  if (!/^[a-f0-9]{64}$/.test(quote.cadSha256 || '') || quote.catalogClass !== 'non_safety_critical' ||
      quote.taxReviewed !== true || !quote.acceptanceEvidenceId || !quote.refundPolicyVersion ||
      !quote.specificationVersion || !quote.sellerName || quote.shippingAddress?.country!=='US' ||
      !quote.shippingAddress.line1 || !quote.shippingAddress.city ||
      !/^[A-Z]{2}$/.test(quote.shippingAddress.state || '') || !/^\d{5}(-\d{4})?$/.test(quote.shippingAddress.postalCode || '')) {
    fail(409,'quote_review_required','A seller-approved specification, tax treatment and acceptance record are required.');
  }
  // No commission model has been approved. Do not silently introduce one.
  if (quote.platformFeeCents !== 0 || quote.tipCents !== 0) {
    fail(409,'fee_review_required','This quote uses a fee or tip arrangement that is not enabled.');
  }
}
export function buildCheckoutParams(order, baseURL) {
  const quote = order.snapshot;
  const metadata = { orderId:order.id, quoteId:order.quoteId, quoteVersion:String(order.quoteVersion) };
  const lines = [
    ['Fabrication — '+quote.sellerName, quote.fabricationCents],
    ['Shipping', quote.shippingCents], ['Sales tax (seller-approved quote)', quote.taxCents],
  ].filter(([,amount]) => amount > 0).map(([name,amount]) => ({
    price_data: { currency:'usd', product_data:{name}, unit_amount:amount }, quantity:1,
  }));
  return {
    mode:'payment', payment_method_types:['card'], line_items:lines,
    client_reference_id:order.id, metadata, payment_intent_data:{metadata},
    // Ship only to the immutable US address accepted with the quote. Letting a
    // buyer change the destination here would invalidate quoted shipping/tax.
    billing_address_collection:'required',
    success_url:baseURL+'/?order='+encodeURIComponent(order.id),
    cancel_url:baseURL+'/?checkout=cancelled',
    expires_at:Math.floor(order.sessionExpiresAt / 1000),
  };
}
export function selectPaymentTransition(order, event, mode) {
  const session=event.data?.object;
  if (event.account !== order.sellerAccountId || event.livemode !== (mode==='live') ||
      session?.livemode !== (mode==='live') || session.mode !== 'payment' ||
      session.metadata?.orderId !== order.id || session.client_reference_id !== order.id ||
      session.metadata?.quoteId !== order.quoteId || session.metadata?.quoteVersion !== String(order.quoteVersion) ||
      session.currency !== order.currency || session.amount_total !== order.totalCents ||
      !/^cs_[A-Za-z0-9_]+$/.test(session.id || '') || (order.sessionId && order.sessionId !== session.id)) {
    fail(400,'payment_event_mismatch','The payment event does not match its order.');
  }
  const intent = typeof session.payment_intent==='string' ? session.payment_intent : session.payment_intent?.id;
  if (order.paymentIntentId && intent && order.paymentIntentId !== intent) {
    fail(400,'payment_event_mismatch','The payment intent does not match its order.');
  }
  if (session.payment_status==='paid' &&
      ['checkout.session.completed','checkout.session.async_payment_succeeded'].includes(event.type)) {
    if (!/^pi_[A-Za-z0-9]+$/.test(intent || '')) fail(400,'payment_event_mismatch','A paid event requires a payment intent.');
    return {state:'paid',paymentIntentId:intent};
  }
  // A late failed/expired/unpaid event must never undo confirmed payment.
  if (order.paymentState==='paid') return {state:'paid',paymentIntentId:order.paymentIntentId};
  if (event.type==='checkout.session.expired') return {state:'expired',paymentIntentId:intent};
  if (event.type==='checkout.session.async_payment_failed') return {state:'failed',paymentIntentId:intent};
  return {state:order.paymentState,paymentIntentId:intent};
}
export class PaymentService {
  constructor({ repository, stripe, config, now=Date.now }) {
    this.repository=repository; this.stripe=stripe; this.config=config; this.now=now;
  }
  async checkout(quoteId, buyerId) {
    if (!this.config.paymentsEnabled) fail(503,'payments_unavailable','Checkout is not open yet.');
    const quote=await this.repository.loadQuoteForBuyer(quoteId,buyerId);
    assertLaunchQuote(quote);
    const account=await this.stripe.accounts.retrieve(quote.sellerAccountId);
    if (account.controller?.stripe_dashboard?.type!=='full') fail(409,'seller_unavailable','The seller requires a full provider dashboard.');
    let prepared;
    try { prepared=prepareDirectCheckout({quote,buyerId,account,now:this.now()}); }
    catch { fail(409,'quote_unavailable','The seller or quote is not currently eligible for checkout.'); }
    const order=await this.repository.reserveOrder(quote,prepared,this.now());
    // A relinked seller account must never validate a retry charged to its old account.
    if (order.quoteId!==quote.id || order.quoteVersion!==quote.version || order.buyerId!==buyerId ||
        order.sellerId!==quote.sellerId || order.sellerAccountId!==prepared.connectedAccountId ||
        order.totalCents!==prepared.totalCents || order.currency!==prepared.currency) {
      fail(409,'reconciliation_required','The reserved checkout no longer matches this quote. Payment reconciliation is required.');
    }
    if (order.paymentState!=='pending') fail(409,'checkout_unavailable','This order already has a payment outcome. Check its status.');
    let session;
    if (order.sessionId) {
      session=await this.stripe.checkout.sessions.retrieve(order.sessionId,{}, {stripeAccount:order.sellerAccountId});
    } else {
      // Stripe may prune idempotency keys after 24 hours. Never retry an unknown
      // old attempt as a fresh charge; reconcile it with the provider first.
      if (this.now()-order.createdAt > 22*60*60*1000) fail(409,'reconciliation_required','This checkout requires payment reconciliation.');
      session=await this.stripe.checkout.sessions.create(buildCheckoutParams(order,this.config.baseURL), {
        stripeAccount:order.sellerAccountId,idempotencyKey:order.providerKey,
      });
      if (!/^cs_[A-Za-z0-9_]+$/.test(session.id || '')) fail(502,'invalid_provider_response','Invalid payment session response.');
      await this.repository.attachSession(order.id,session.id);
    }
    if (session.status!=='open' || session.payment_status==='paid') {
      fail(409,'checkout_unavailable','Checkout is no longer open. Payment confirmation may still be processing.');
    }
    return {orderId:order.id,url:validateHostedURL(session.url,'checkout.stripe.com')};
  }
  async receiveWebhook(rawBody, signature) {
    if (!this.config.paymentsConfigured) fail(503,'payments_unavailable','Payment service is not configured.');
    let event;
    try { event=this.stripe.webhooks.constructEvent(rawBody,signature,this.config.webhookSecret,300); }
    catch { fail(400,'invalid_signature','Invalid payment webhook signature.'); }
    if (!/^evt_[A-Za-z0-9]+$/.test(event?.id || '') || !/^acct_[A-Za-z0-9]+$/.test(event.account || '') ||
        event.livemode !== (this.config.mode==='live')) {
      fail(400,'invalid_event_scope','This webhook is not for the configured connected-account environment.');
    }
    if (!TYPES.has(event.type)) return {received:true,ignored:true};
    if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(event.data?.object?.metadata?.orderId || '')) {
      fail(400,'invalid_event_scope','A marketplace order identifier is required.');
    }
    const result=await this.repository.applyEvent(event,order=>selectPaymentTransition(order,event,this.config.mode));
    return {received:true,...result};
  }
  async onboarding(sellerId,userId) {
    if (!this.config.paymentsConfigured) fail(503,'payments_unavailable','Seller onboarding is not configured.');
    const seller=await this.repository.sellerForOwner(sellerId,userId);
    const account=await this.stripe.accounts.retrieve(seller.stripe_account_id);
    if (account.country!=='US' || account.controller?.fees?.payer!=='account' ||
        account.controller?.losses?.payments!=='stripe' || account.controller?.stripe_dashboard?.type!=='full') {
      fail(409,'seller_configuration_required','The seller payment responsibility settings require review.');
    }
    const link=await this.stripe.accountLinks.create({
      account:account.id,type:'account_onboarding',
      refresh_url:this.config.baseURL+'/?seller=onboarding-expired',
      return_url:this.config.baseURL+'/?seller=onboarding-return',
    });
    return {url:validateHostedURL(link.url,'connect.stripe.com')};
  }
}




