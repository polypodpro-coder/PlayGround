import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readConfig } from '../server/config.mjs';
import { createRequestHandler } from '../server/app.mjs';
import { newCsrfToken, verifyMutation, requireRecentMfa, createRateLimiter } from '../server/security.mjs';
import { PaymentService, buildCheckoutParams, selectPaymentTransition, assertLaunchQuote } from '../server/payments.mjs';
import { PostgresSessionStore, Repository } from '../server/database.mjs';

const quoteId='11111111-1111-4111-8111-111111111111';
const orderId='22222222-2222-4222-8222-222222222222';
const buyerId='33333333-3333-4333-8333-333333333333';
const sellerId='44444444-4444-4444-8444-444444444444';
const now=Date.now();
const token=newCsrfToken();
const base=readConfig({});
const active={...base,identityConfigured:true,paymentsConfigured:true,paymentsEnabled:true,webhookSecret:'test-only'};
const principal={id:buyerId,name:'Buyer',email:'buyer@example.invalid',emailVerified:true};
const session={principal,csrfToken:token,claims:{amr:['mfa'],auth_time:Math.floor(now/1000)}};
const quote={
  id:quoteId,buyerId,sellerId,sellerName:'Example Farm',sellerAccountId:'acct_example',version:1,
  status:'accepted',currency:'usd',expiresAt:now+3600000,
  fabricationCents:5000,shippingCents:500,taxCents:500,platformFeeCents:0,tipCents:0,
  sellerTermsVersion:'seller-v1',platformTermsVersion:'marketplace-v1',refundPolicyVersion:'refund-v1',
  specificationVersion:'spec-v1',acceptanceEvidenceId:'evidence-example',
  cadSha256:'a'.repeat(64),catalogClass:'non_safety_critical',taxReviewed:true,
  shippingAddress:{country:'US',line1:'Example address',city:'Austin',state:'TX',postalCode:'78701'},
};
const account={id:'acct_example',country:'US',charges_enabled:true,payouts_enabled:true,
  capabilities:{card_payments:'active'},controller:{fees:{payer:'account'},losses:{payments:'stripe'},stripe_dashboard:{type:'full'}}};
const order={id:orderId,quoteId,buyerId,sellerId,quoteVersion:1,sellerAccountId:'acct_example',
  snapshot:quote,totalCents:6000,currency:'usd',providerKey:'checkout:'+orderId,
  sessionExpiresAt:now+2400000,createdAt:now,paymentState:'pending',sessionId:'cs_test_example',paymentIntentId:null};
function event(overrides={}) {
  return {id:'evt_example',account:'acct_example',livemode:false,type:'checkout.session.completed',
    data:{object:{id:'cs_test_example',mode:'payment',livemode:false,currency:'usd',amount_total:6000,
      client_reference_id:orderId,metadata:{orderId,quoteId,quoteVersion:'1'},payment_status:'paid',
      payment_intent:'pi_example'}},...overrides};
}
async function withServer(options,run) {
  const handler=createRequestHandler({config:active,repository:{},resolveSession:async()=>session,logger:{error(){}},...options});
  const server=createServer((req,res)=>{options.decorateResponse?.(res);return handler(req,res);});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin='http://127.0.0.1:'+server.address().port;
  try { await run((path,options)=>fetch(origin+path,options)); }
  finally { server.closeAllConnections();await new Promise(resolve=>server.close(resolve)); }
}
function post(body,headers={}) {
  return {method:'POST',headers:{'Content-Type':'application/json',Origin:base.baseURL,'X-CSRF-Token':token,...headers},body:JSON.stringify(body)};
}
test('configuration fails closed without providers and rejects incomplete enabled payments',()=>{
  assert.equal(base.identityConfigured,false);assert.equal(base.paymentsEnabled,false);
  assert.throws(()=>readConfig({PAYMENTS_ENABLED:'true'}),/complete/);
  assert.throws(()=>readConfig({NODE_ENV:'production',APP_BASE_URL:'http://example.com'}),/HTTPS/);
  assert.throws(()=>readConfig({SESSION_SECRET:'short'}),/random bytes/);
});
test('production database TLS cannot be disabled or weakened through URL parameters',()=>{
  const config=readConfig({NODE_ENV:'production',APP_BASE_URL:'https://example.com',DATABASE_URL:'postgres://user:password@db.example/db?sslmode=no-verify'});
  assert.equal(config.database.ssl.rejectUnauthorized,true);
  assert.equal(new URL(config.database.connectionString).searchParams.has('sslmode'),false);
  assert.throws(()=>readConfig({NODE_ENV:'production',APP_BASE_URL:'https://example.com',DATABASE_URL:'postgres://host/db',DATABASE_TLS:'false'}),/TLS/);
});
test('live payment enablement requires explicit production launch approval',()=>{
  const env={APP_BASE_URL:'https://example.com',AUTH0_ISSUER_BASE_URL:'https://tenant.auth0.com',AUTH0_CLIENT_ID:'id',
    AUTH0_CLIENT_SECRET:'secret',SESSION_SECRET:'a'.repeat(64),DATABASE_URL:'postgres://host/db',
    STRIPE_SECRET_KEY:'sk_live_example',STRIPE_CONNECT_WEBHOOK_SECRET:'whsec_example',PAYMENTS_ENABLED:'true'};
  assert.throws(()=>readConfig(env),/approval/);
  assert.throws(()=>readConfig({...env,NODE_ENV:'production'}),/approval/);
  assert.equal(readConfig({...env,NODE_ENV:'production',LAUNCH_APPROVAL_REFERENCE:'approved-review'}).paymentsEnabled,true);
});
test('CSRF validation rejects missing origin, foreign origin, changed token and Unicode',()=>{
  const valid={origin:base.baseURL,expectedOrigin:base.baseURL,token,sessionToken:token};
  assert.doesNotThrow(()=>verifyMutation(valid));
  for (const altered of [{origin:undefined},{origin:'https://evil.example'},{token:'a'.repeat(43)},{token:'é'.repeat(43)}]) {
    assert.throws(()=>verifyMutation({...valid,...altered}));
  }
});
test('seller-sensitive actions require recent verified MFA claims',()=>{
  assert.doesNotThrow(()=>requireRecentMfa(session.claims,now));
  for (const claims of [{amr:['pwd'],auth_time:now/1000},{amr:['mfa'],auth_time:(now-3600000)/1000},{amr:['mfa']}]) {
    assert.throws(()=>requireRecentMfa(claims,now),/multifactor/);
  }
});
test('public status stays available without auth; protected endpoints remain closed',async()=>{
  await withServer({config:base},async request=>{
    const status=await request('/api/status');assert.equal(status.status,200);
    assert.equal((await status.json()).paymentsEnabled,false);
    assert.equal(status.headers.get('x-frame-options'),'DENY');
    assert.equal((await request('/api/orders')).status,503);
    const sessionResponse=await request('/api/session');
    assert.deepEqual(await sessionResponse.json(),{authenticated:false,available:false});
  });
});
test('client identity and role headers cannot create authentication',async()=>{
  await withServer({resolveSession:async()=>null},async request=>{
    const result=await request('/api/orders',{headers:{Authorization:'Bearer fabricated','X-User-Id':buyerId,'X-Role':'admin'}});
    assert.equal(result.status,401);
  });
});
test('unverified and blocked accounts cannot access commerce',async()=>{
  for (const change of [{emailVerified:false},{blockedAt:new Date()}]) {
    await withServer({resolveSession:async()=>({...session,principal:{...principal,...change}})},async request=>{
      assert.equal((await request('/api/orders')).status,403);
    });
  }
});
test('orders are loaded with authenticated identity and unrelated orders return opaque 404',async()=>{
  const calls=[];
  await withServer({repository:{
    listOrders:async id=>{calls.push(id);return [{id:orderId}];},
    getOrder:async(id,userId)=>{calls.push(userId);return id===orderId ? null : undefined;},
  }},async request=>{
    const list=await request('/api/orders?buyerId=someone-else');
    assert.equal(list.status,200);assert.deepEqual((await list.json()).orders,[{id:orderId}]);
    const unrelated=await request('/api/orders/'+orderId);
    assert.equal(unrelated.status,404);assert.equal((await unrelated.json()).error.code,'order_not_found');
    assert.deepEqual(calls,[buyerId,buyerId]);
  });
});
test('checkout rejects cross-origin and client-supplied amount/account fields before provider calls',async()=>{
  let calls=0;
  await withServer({payments:{checkout:async()=>{calls++;return {};}}},async request=>{
    assert.equal((await request('/api/checkout',post({quoteId},{Origin:'https://evil.example'}))).status,403);
    assert.equal((await request('/api/checkout',post({quoteId,totalCents:1,stripeAccount:'acct_attacker'}))).status,400);
    assert.equal((await request('/api/checkout',post({quoteId},{'X-CSRF-Token':''}))).status,403);
    assert.equal(calls,0);
  });
});
test('checkout delegates only server principal and one valid quote identifier',async()=>{
  await withServer({payments:{checkout:async(id,userId)=>{
    assert.equal(id,quoteId);assert.equal(userId,buyerId);return {orderId,url:'https://checkout.stripe.com/example'};
  }}},async request=>{
    const response=await request('/api/checkout',post({quoteId}));
    assert.equal(response.status,200);assert.equal((await response.json()).orderId,orderId);
  });
});
test('request size and media type are bounded',async()=>{
  await withServer({payments:{}},async request=>{
    assert.equal((await request('/api/checkout',post({quoteId:'x'.repeat(20000)}))).status,413);
    assert.equal((await request('/api/checkout',post({quoteId},{'Content-Type':'text/plain'}))).status,415);
  });
});
test('provider errors never leak keys or private data into responses or logs',async()=>{
  const logs=[];
  await withServer({logger:{error:value=>logs.push(value)},payments:{checkout:async()=>{throw new Error('sk_live_secret private-cad-file');}}},async request=>{
    const response=await request('/api/checkout',post({quoteId}));
    assert.equal(response.status,503);
    assert.doesNotMatch(await response.text(),/sk_live|private-cad/);
    assert.doesNotMatch(JSON.stringify(logs),/sk_live|private-cad/);
  });
});
test('webhook handler preserves raw bytes and accepts processing while new payments are disabled',async()=>{
  const raw='{ "id": "evt_example", "spacing": true }';
  await withServer({config:{...active,paymentsEnabled:false},payments:{receiveWebhook:async(bytes,signature)=>{
    assert.ok(Buffer.isBuffer(bytes));assert.equal(bytes.toString(),raw);assert.equal(signature,'signed-test');
    return {received:true};
  }}},async request=>{
    const response=await request('/api/webhooks/stripe',{method:'POST',headers:{'Stripe-Signature':'signed-test'},body:raw});
    assert.equal(response.status,200);
    assert.equal((await request('/api/checkout',post({quoteId}))).status,503);
  });
});
test('webhook route refuses absent signature before accepting an event',async()=>{
  await withServer({payments:{receiveWebhook:async()=>assert.fail('must not be called')}},async request=>{
    assert.equal((await request('/api/webhooks/stripe',{method:'POST',body:'{}'})).status,400);
  });
});
test('checkout parameters use immutable cents and provider-hosted pages without account transfer or buyer surcharge',()=>{
  const params=buildCheckoutParams(order,base.baseURL);
  assert.equal(params.line_items.reduce((sum,line)=>sum+line.price_data.unit_amount*line.quantity,0),6000);
  assert.deepEqual(params.payment_method_types,['card']);
  assert.equal(params.payment_intent_data.transfer_data,undefined);
  assert.equal(params.payment_intent_data.application_fee_amount,undefined);
  assert.equal(params.shipping_address_collection,undefined);
  assert.equal(params.client_reference_id,orderId);
});
test('launch quotes require safety, consent, tax and US destination evidence',()=>{
  assert.doesNotThrow(()=>assertLaunchQuote(quote));
  for (const change of [{cadSha256:''},{catalogClass:'medical'},{taxReviewed:false},{platformFeeCents:1},
    {acceptanceEvidenceId:''},{shippingAddress:{...quote.shippingAddress,country:'CA'}}]) {
    assert.throws(()=>assertLaunchQuote({...quote,...change}));
  }
});
test('paid event matching covers seller, live mode, amount, currency, quote version and checkout identity',()=>{
  assert.equal(selectPaymentTransition(order,event(),'test').state,'paid');
  const altered=[
    {...event(),account:'acct_attacker'},{...event(),livemode:true},
    ...[{amount_total:1},{currency:'eur'},{id:'cs_test_other'},{payment_intent:null},
      {metadata:{orderId,quoteId,quoteVersion:'2'}}].map(change=>({...event(),data:{object:{...event().data.object,...change}}})),
  ];
  for (const mismatch of altered) assert.throws(()=>selectPaymentTransition(order,mismatch,'test'));
});
test('late expired, failed and unpaid events cannot undo a confirmed payment',()=>{
  const paid={...order,paymentState:'paid',paymentIntentId:'pi_example'};
  for (const type of ['checkout.session.expired','checkout.session.async_payment_failed','checkout.session.completed']) {
    const late=event({type});late.data.object.payment_status='unpaid';
    assert.equal(selectPaymentTransition(paid,late,'test').state,'paid');
  }
});
test('unpaid checkout completion never marks paid; async success requires paid state',()=>{
  const pending=event();pending.data.object.payment_status='unpaid';
  assert.equal(selectPaymentTransition(order,pending,'test').state,'pending');
  pending.type='checkout.session.async_payment_succeeded';
  assert.equal(selectPaymentTransition(order,pending,'test').state,'pending');
});
test('payment creation scopes a durable idempotency key to the actual connected account',async()=>{
  const calls=[];
  const repository={loadQuoteForBuyer:async()=>quote,reserveOrder:async()=>({...order,sessionId:null}),
    attachSession:async(...args)=>calls.push(args)};
  const stripe={accounts:{retrieve:async()=>account},checkout:{sessions:{create:async(params,options)=>{
    assert.deepEqual(options,{stripeAccount:'acct_example',idempotencyKey:order.providerKey});
    assert.equal(params.metadata.orderId,orderId);
    return {id:'cs_test_example',status:'open',url:'https://checkout.stripe.com/example'};
  }}}};
  const result=await new PaymentService({repository,stripe,config:active,now:()=>now}).checkout(quoteId,buyerId);
  assert.equal(result.orderId,orderId);assert.deepEqual(calls,[[orderId,'cs_test_example']]);
});
test('unknown payment attempts older than provider idempotency retention cannot create another charge',async()=>{
  const repository={loadQuoteForBuyer:async()=>quote,reserveOrder:async()=>({...order,sessionId:null,createdAt:now-23*3600000})};
  const stripe={accounts:{retrieve:async()=>account},checkout:{sessions:{create:async()=>assert.fail('must not call provider')}}};
  await assert.rejects(new PaymentService({repository,stripe,config:active,now:()=>now}).checkout(quoteId,buyerId),/reconciliation/);
});
test('existing checkout is retrieved in its connected account rather than creating a duplicate',async()=>{
  let retrieved=0;
  const repository={loadQuoteForBuyer:async()=>quote,reserveOrder:async()=>order};
  const stripe={accounts:{retrieve:async()=>account},checkout:{sessions:{retrieve:async(id,_params,options)=>{
    retrieved++;assert.equal(id,order.sessionId);assert.equal(options.stripeAccount,order.sellerAccountId);
    return {status:'open',url:'https://checkout.stripe.com/example'};
  }}}};
  await new PaymentService({repository,stripe,config:active,now:()=>now}).checkout(quoteId,buyerId);
  assert.equal(retrieved,1);
});
test('webhook verifier failures are rejected; duplicate-event repository outcome is returned',async()=>{
  const repository={applyEvent:async(received,transition)=>{
    assert.equal(received.id,'evt_example');assert.equal(transition(order).state,'paid');return {duplicate:true};
  }};
  const stripe={webhooks:{constructEvent:(raw,signature,secret,tolerance)=>{
    assert.ok(Buffer.isBuffer(raw));assert.equal(secret,'test-only');assert.equal(tolerance,300);
    if(signature!=='valid')throw new Error('invalid signature');return event();
  }}};
  const service=new PaymentService({repository,stripe,config:active});
  await assert.rejects(service.receiveWebhook(Buffer.from('{}'),'forged'),/signature/);
  assert.deepEqual(await service.receiveWebhook(Buffer.from('{}'),'valid'),{received:true,duplicate:true});
});
test('encrypted session storage does not expose tokens and detects tampering',()=>{
  const store=new PostgresSessionStore({},'a'.repeat(64));
  const secret={header:{exp:123},data:{id_token:'private-token',csrfToken:token}};
  const ciphertext=store.encrypt(secret);
  assert.equal(ciphertext.includes('private-token'),false);assert.deepEqual(store.decrypt(ciphertext),secret);
  const bytes=Buffer.from(ciphertext,'base64');bytes[bytes.length-1]^=1;
  assert.throws(()=>store.decrypt(bytes.toString('base64')));
  assert.notEqual(store.sessionKey('cookie-id'),'cookie-id');
});
test('per-process limiter bounds abusive requests and expires windows',()=>{
  let clock=0;const limit=createRateLimiter({limit:2,now:()=>clock});
  limit('ip');limit('ip');assert.throws(()=>limit('ip'),/wait/);
  clock=60001;assert.doesNotThrow(()=>limit('ip'));
});

test('unverified or blocked users can still end their own session through a CSRF-protected form',async()=>{
  for (const change of [{emailVerified:false},{blockedAt:new Date()}]) {
    let ended=false;
    await withServer({resolveSession:async()=>({...session,principal:{...principal,...change}}),
      decorateResponse:res=>{res.oidc={logout:()=>{ended=true;res.statusCode=204;res.end();}};},
    },async request=>{
      const response=await request('/auth/logout',{method:'POST',headers:{Origin:base.baseURL,
        'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({csrfToken:token})});
      assert.equal(response.status,204);assert.equal(ended,true);
    });
  }
});

test('PostgreSQL URL cannot disable or override the explicit verified TLS policy',()=>{
  const configured=readConfig({NODE_ENV:'production',APP_BASE_URL:'https://example.com',
    DATABASE_URL:'postgres://host/db?ssl=false&sslmode=no-verify&sslcert=wrong&sslkey=wrong&sslrootcert=wrong'});
  for (const key of ['ssl','sslmode','sslcert','sslkey','sslrootcert']) {
    assert.equal(new URL(configured.database.connectionString).searchParams.has(key),false);
  }
  assert.equal(configured.database.ssl.rejectUnauthorized,true);
});
test('changed account, buyer, revision or amount in a reservation stops checkout before a provider session call',async()=>{
  for (const change of [{sellerAccountId:'acct_previous'},{buyerId:sellerId},{quoteVersion:2},{totalCents:1},{currency:'eur'}]) {
    for (const sessionId of [null,'cs_test_example']) {
      let providerCalls=0;
      const repository={loadQuoteForBuyer:async()=>quote,reserveOrder:async()=>({...order,...change,sessionId})};
      const stripe={accounts:{retrieve:async()=>account},checkout:{sessions:{
        create:async()=>{providerCalls++;},retrieve:async()=>{providerCalls++;},
      }}};
      const service=new PaymentService({repository,stripe,config:active,now:()=>now});
      await assert.rejects(service.checkout(quoteId,buyerId),error=>error.code==='reconciliation_required');
      assert.equal(providerCalls,0);
    }
  }
});
// This test double models the issued PostgreSQL UPSERT conditions. Real concurrent
// PostgreSQL tests remain required before launch; no database library is installed.
function sessionPool() {
  const rows=new Map();
  return {rows,async query(sql,params){
    const [key,payload,expiry]=params;
    if (sql.startsWith('DELETE')) { rows.delete(key);return {rowCount:1}; }
    if (sql.startsWith('SELECT')) {
      const row=rows.get(key);
      return {rows:row && !row.revoked && row.expiry>now ? [{encrypted_payload:row.payload}] : []};
    }
    if (sql.includes('expires_at,revoked_at)')) {
      rows.set(key,{payload,expiry:Number(expiry),revoked:true});return {rowCount:1};
    }
    const previous=rows.get(key);
    if (previous?.revoked && sql.includes('WHERE auth_sessions.revoked_at IS NULL')) return {rowCount:0};
    rows.set(key,{payload,expiry:Number(expiry),revoked:false});return {rowCount:1};
  }};
}
const storeCall=(store,method,...args)=>new Promise((resolve,reject)=>{
  store[method](...args,(error,value)=>error ? reject(error) : resolve(value));
});
test('logout tombstone prevents a request loaded before logout from resurrecting its session',async()=>{
  const pool=sessionPool();
  const store=new PostgresSessionStore(pool,'a'.repeat(64),{now:()=>now});
  const saved={header:{exp:(now+1800000)/1000},data:{id_token:'sensitive'}};
  await storeCall(store,'set','browser',saved);
  assert.deepEqual(await storeCall(store,'get','browser'),saved);
  await storeCall(store,'destroy','browser');
  assert.equal(await storeCall(store,'get','browser'),null);
  await assert.rejects(storeCall(store,'set','browser',saved),/revoked/);
  assert.equal(await storeCall(store,'get','browser'),null);
  const tombstone=pool.rows.get(store.sessionKey('browser'));
  assert.equal(tombstone.revoked,true);
  assert.ok(tombstone.expiry>=now+8*3600000);
});
test('back-channel logout markers can be cleared and written again independently of browser tombstones',async()=>{
  const pool=sessionPool();
  const browser=new PostgresSessionStore(pool,'a'.repeat(64),{now:()=>now});
  const markers=new PostgresSessionStore(pool,'a'.repeat(64),{purpose:'logout',now:()=>now});
  const value={cookie:{expires:now+1800000,maxAge:1800000}};
  assert.notEqual(browser.sessionKey('same-id'),markers.sessionKey('same-id'));
  await storeCall(browser,'destroy','same-id');
  await storeCall(markers,'set','same-id',value);
  await storeCall(markers,'destroy','same-id');
  await storeCall(markers,'set','same-id',value);
  assert.deepEqual(await storeCall(markers,'get','same-id'),value);
  assert.equal(await storeCall(browser,'get','same-id'),null);
});
test('session persistence rejects invalid expiry and caps retention at the absolute session maximum',async()=>{
  const pool=sessionPool();const store=new PostgresSessionStore(pool,'a'.repeat(64),{now:()=>now});
  for (const value of [{},{header:{exp:NaN}},{header:{exp:now/1000-1}}]) {
    await assert.rejects(storeCall(store,'set','browser',value),/expiry/);
  }
  assert.equal(pool.rows.size,0);
  await storeCall(store,'set','browser',{header:{exp:(now+24*3600000)/1000},data:{}});
  assert.equal(pool.rows.get(store.sessionKey('browser')).expiry,now+8*3600000);
});
test('seller suspension or relinking between quote load and reservation aborts without inserting an order',async()=>{
  for (const seller of [{status:'suspended',stripe_account_id:account.id},{status:'approved',stripe_account_id:'acct_relinked'}]) {
    const calls=[];
    const pool={connect:async()=>({release(){},async query(sql){
      calls.push(sql);
      if (sql.startsWith('SELECT * FROM quotes')) return {rows:[{status:'accepted',version:quote.version,seller_id:quote.sellerId,expires_at:new Date(quote.expiresAt)}]};
      if (sql.startsWith('SELECT stripe_account_id')) {assert.match(sql,/FOR SHARE/);return {rows:[seller]};}
      return {rows:[]};
    }})};
    await assert.rejects(new Repository(pool).reserveOrder(quote,{connectedAccountId:account.id},now),error=>error.code==='seller_changed');
    assert.ok(calls.includes('ROLLBACK'));assert.equal(calls.some(sql=>sql.startsWith('INSERT')),false);
  }
});

test('a restricted account can retrieve its own logout token without gaining commerce access',async()=>{
  for (const [change,accountStatus] of [[{blockedAt:new Date()},'suspended'],[{emailVerified:false},'email_unverified']]) {
    let ended=false;
    await withServer({resolveSession:async()=>({...session,principal:{...principal,...change}}),
      decorateResponse:res=>{res.oidc={logout:()=>{ended=true;res.statusCode=204;res.end();}};},
    },async request=>{
      const response=await request('/api/session');
      assert.equal(response.status,200);
      const status=await response.json();
      assert.equal(status.authenticated,true);
      assert.equal(status.accountStatus,accountStatus);
      assert.equal(status.csrfToken,token);
      assert.equal((await request('/api/orders')).status,403);
      const logout=await request('/auth/logout',{method:'POST',headers:{origin:base.baseURL,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({csrfToken:status.csrfToken}).toString()});
      assert.equal(logout.status,204);assert.equal(ended,true);
    });
  }
});
