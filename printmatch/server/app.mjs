import { randomUUID } from 'node:crypto';
import { HttpError, fail, safeId, requireVerified, requireRecentMfa, verifyMutation,
  validateCheckoutBody, setSecurityHeaders, createRateLimiter } from './security.mjs';

export function json(res, status, value) {
  res.statusCode=status; res.setHeader('Content-Type','application/json; charset=utf-8'); res.end(JSON.stringify(value));
}
async function readBody(req, limit=16384) {
  const announced=Number(req.headers['content-length'] || 0);
  if (announced>limit) fail(413,'body_too_large','The request is too large.');
  let length=0; const chunks=[];
  for await (const chunk of req) {
    length+=chunk.length;
    if (length>limit) fail(413,'body_too_large','The request is too large.');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
async function readJson(req, limit=16384) {
  if (req.headers['content-type']?.split(';')[0].trim()!=='application/json') fail(415,'json_required','Send JSON for this request.');
  try { return JSON.parse((await readBody(req,limit)).toString('utf8')); }
  catch(error) { if (error instanceof HttpError) throw error; fail(400,'invalid_json','The request body is invalid JSON.'); }
}
function recordId(value) {
  safeId(value);
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value)) fail(400,'invalid_id','A valid record identifier is required.');
  return value;
}
// Dependency injection is only a server construction parameter, never client input.
// The production resolver in index.mjs trusts only the official OIDC middleware.
export function createRequestHandler({config,repository,payments,creations,resolveSession=async()=>null,logger=console,
  limiter=createRateLimiter()}) {
  return async (req,res) => {
    const requestId=randomUUID();
    setSecurityHeaders(res,config); res.setHeader('X-Request-Id',requestId);
    try {
      const path=new URL(req.url,config.baseURL).pathname;
      if (path==='/api/status' && req.method==='GET') {
        return json(res,200,{service:'poly-pod-pro',identityConfigured:config.identityConfigured,
          paymentsConfigured:config.paymentsConfigured,paymentsEnabled:config.paymentsEnabled,mode:config.mode});
      }
      if (path==='/api/creation-status' && req.method==='GET') {
        return json(res,200,{configured:Boolean(creations && config.identityConfigured),enabled:Boolean(creations && config.creationSharingEnabled)});
      }
      if (path==='/api/webhooks/stripe' && req.method==='POST') {
        if (!payments) fail(503,'payments_unavailable','Payment service is not configured.');
        const signature=req.headers['stripe-signature'];
        if (typeof signature!=='string' || signature.length>4096) fail(400,'invalid_signature','A webhook signature is required.');
        const raw=await readBody(req,262144);
        // Webhooks intentionally remain active when the new-payment kill switch is off.
        return json(res,200,await payments.receiveWebhook(raw,signature));
      }
      limiter(req.ip || req.socket.remoteAddress || 'unknown');
      if (path==='/api/session' && req.method==='GET') {
        if (!config.identityConfigured) return json(res,200,{authenticated:false,available:false});
        const session=await resolveSession(req);
        if (!session?.principal) return json(res,200,{authenticated:false,available:true});
        // Session status remains readable so restricted users can still obtain their logout token.
        const {id,name,email,emailVerified}=session.principal;
        return json(res,200,{authenticated:true,accountStatus:session.principal.blockedAt?'suspended':emailVerified?'active':'email_unverified',user:{id,name,email,emailVerified},csrfToken:session.csrfToken});
      }
      if (!path.startsWith('/api/') && !path.startsWith('/auth/')) fail(404,'not_found','API route not found.');
      if (!config.identityConfigured || !repository) fail(503,'identity_unavailable','Secure accounts are not open yet.');
      if (path==='/auth/login') fail(503,'identity_unavailable','The login service is unavailable.');
      const session=await resolveSession(req);
      if (!session?.principal) fail(401,'login_required','Sign in to continue.');
      if (!['GET','HEAD'].includes(req.method)) {
        let token=req.headers['x-csrf-token'];
        if (path==='/auth/logout' && req.headers['content-type']?.split(';')[0].trim()==='application/x-www-form-urlencoded') {
          const form=new URLSearchParams((await readBody(req)).toString('utf8'));
          if ([...form.keys()].length!==1 || !form.has('csrfToken')) fail(400,'invalid_request','Invalid logout request.');
          token=form.get('csrfToken');
        }
        verifyMutation({origin:req.headers.origin,expectedOrigin:config.baseURL,
          token,sessionToken:session.csrfToken});
      }
      if (path==='/auth/logout' && req.method==='POST') {
        if (!res.oidc) fail(503,'identity_unavailable','The login service is unavailable.');
        return res.oidc.logout({returnTo:config.baseURL});
      }
      requireVerified(session.principal);
      if (/^\/api\/(?:creations(?:\/|$)|creation-(?:inbox|farms|shares)(?:\/|$))/.test(path)) {
        if (!creations) fail(503,'creations_unavailable','Private creation sharing is not open yet.');
        const userId=session.principal.id;
        if (path==='/api/creations' && req.method==='GET') return json(res,200,{creations:await creations.list(userId)});
        if (path==='/api/creations' && req.method==='POST') return json(res,201,{creation:await creations.create(userId,await readJson(req,14*1024*1024))});
        if (path==='/api/creation-farms' && req.method==='GET') return json(res,200,{farms:await creations.farms(userId)});
        if (path==='/api/creation-inbox' && req.method==='GET') return json(res,200,{inbox:await creations.inbox(userId)});
        const creationMatch=path.match(/^\/api\/creations\/([^/]+)(?:\/(model|shares))?$/);
        if (creationMatch) {
          const creationId=recordId(creationMatch[1]);
          if (!creationMatch[2] && req.method==='GET') return json(res,200,{creation:await creations.get(creationId,userId)});
          if (creationMatch[2]==='shares' && req.method==='POST') return json(res,201,{share:await creations.share(creationId,userId,await readJson(req))});
          if (creationMatch[2]==='model' && req.method==='GET') {
            const model=await creations.model(creationId,userId);
            res.statusCode=200; res.setHeader('Content-Type','model/stl');
            res.setHeader('Content-Disposition','attachment; filename="creation.stl"');
            res.setHeader('Content-Length',model.bytes.length); return res.end(model.bytes);
          }
        }
        const shareMatch=path.match(/^\/api\/creation-shares\/([^/]+)(\/quote)?$/);
        if (shareMatch) {
          const shareId=recordId(shareMatch[1]);
          if (shareMatch[2] && req.method==='POST') return json(res,200,{offer:await creations.respond(shareId,userId,await readJson(req))});
          if (!shareMatch[2] && req.method==='DELETE') return json(res,200,await creations.revoke(shareId,userId));
        }
      }
      if (path==='/api/orders' && req.method==='GET') {
        return json(res,200,{orders:await repository.listOrders(session.principal.id)});
      }
      const orderMatch=path.match(/^\/api\/orders\/([^/]+)$/);
      if (orderMatch && req.method==='GET') {
        const order=await repository.getOrder(recordId(orderMatch[1]),session.principal.id);
        if (!order) fail(404,'order_not_found','Order not found.');
        return json(res,200,{order});
      }
      if (path==='/api/checkout' && req.method==='POST') {
        if (!config.paymentsEnabled || !payments) fail(503,'payments_unavailable','Checkout is not open yet.');
        const quoteId=recordId(validateCheckoutBody(await readJson(req)));
        return json(res,200,await payments.checkout(quoteId,session.principal.id));
      }
      const sellerMatch=path.match(/^\/api\/sellers\/([^/]+)\/onboarding$/);
      if (sellerMatch && req.method==='POST') {
        requireRecentMfa(session.claims);
        if (!payments) fail(503,'payments_unavailable','Seller onboarding is not configured.');
        const body=await readJson(req);
        if (!body || Array.isArray(body) || Object.keys(body).length) fail(400,'invalid_request','No account identifiers may be supplied.');
        return json(res,200,await payments.onboarding(recordId(sellerMatch[1]),session.principal.id));
      }
      fail(404,'not_found','API route not found.');
    } catch(error) {
      const known=error instanceof HttpError;
      const status=known ? error.status : 503;
      // No bodies, headers, secrets, CAD names, tokens or provider exception messages.
      logger.error?.({requestId,code:known ? error.code : 'service_unavailable',status});
      if (res.headersSent) return res.destroy();
      if (status===429) res.setHeader('Retry-After','60');
      json(res,status,{error:{code:known ? error.code : 'service_unavailable',
        message:known ? error.message : 'This service is temporarily unavailable. Please try again.',requestId}});
    }
  };
}




