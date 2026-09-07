import { createServer } from 'node:http';
import { readConfig } from './config.mjs';
import { createRequestHandler, json } from './app.mjs';
import { Repository, PostgresSessionStore } from './database.mjs';
import { PaymentService } from './payments.mjs';
import { CreationRepository } from './creation-repository.mjs';
import { CreationService } from './creations.mjs';
import { newCsrfToken, setSecurityHeaders, createRateLimiter } from './security.mjs';

async function start() {
  const config=readConfig();
  let pool, handler;
  if (config.identityConfigured) {
    // Official provider libraries are optional only while integrations are disabled.
    // No hand-written OAuth, bearer-token decoding or payment-signature substitute.
    const [{default:express},oidc,pg]=await Promise.all([import('express'),import('express-openid-connect'),import('pg')]);
    pool=new pg.default.Pool(config.database);
    const schema=await pool.query("SELECT to_regclass('public.orders') AS orders, to_regclass('public.auth_sessions') AS sessions");
    if (!schema.rows[0].orders || !schema.rows[0].sessions) throw new Error('Database migration required');
    const repository=new Repository(pool);
    const creationSchema=await pool.query("SELECT to_regclass('public.creations') AS creations, to_regclass('public.creation_shares') AS shares, to_regclass('public.creation_offers') AS offers");
    const creationsReady=Object.values(creationSchema.rows[0]).every(Boolean);
    if (config.creationSharingEnabled && !creationsReady) throw new Error('Creation sharing migration required');
    const creations=creationsReady ? new CreationService({repository:new CreationRepository(pool),config}) : null;
    let payments=null;
    if (config.paymentsConfigured) {
      const {default:Stripe}=await import('stripe');
      payments=new PaymentService({repository,config,stripe:new Stripe(config.stripeKey,{maxNetworkRetries:2,timeout:15000})});
    }
    const resolveSession=async req => {
      if (!req.oidc?.isAuthenticated()) return null;
      const claims=req.oidc.idTokenClaims;
      const principal=await repository.principal(claims);
      req.polySession.csrfToken ||= newCsrfToken();
      return {principal,claims,csrfToken:req.polySession.csrfToken};
    };
    const api=createRequestHandler({config,repository,payments,creations,resolveSession});
    const app=express();
    app.disable('x-powered-by');
    if (config.trustedProxy) app.set('trust proxy',config.trustedProxy.split(',').map(value=>value.trim()));
    app.use((req,res,next)=>{setSecurityHeaders(res,config);next();});
    app.get('/api/status',api);
    app.get('/api/creation-status',api);
    app.post('/api/webhooks/stripe',api); // Raw bytes, before ANY JSON or auth middleware.
    const authLimiter=createRateLimiter({limit:30});
    app.use('/auth',(req,res,next)=>{
      try { authLimiter(req.ip); next(); }
      catch { json(res,429,{error:{code:'rate_limited',message:'Please wait before trying again.'}}); }
    });
    const auth=oidc.auth || oidc.default.auth;
    app.use(auth({
      authRequired:false,auth0Logout:true,errorOnRequiredAuth:true,
      backchannelLogout:{store:new PostgresSessionStore(pool,config.sessionSecret,{purpose:'logout'})},
      secret:config.sessionSecret,baseURL:config.baseURL,
      clientID:config.clientID,clientSecret:config.clientSecret,issuerBaseURL:config.issuerBaseURL,
      authorizationParams:{response_type:'code',response_mode:'query',scope:'openid profile email',max_age:28800},
      idTokenSigningAlg:'RS256',legacySameSiteCookie:false,enableTelemetry:false,httpTimeout:5000,
      routes:{login:false,logout:false,callback:'/auth/callback',backchannelLogout:'/auth/backchannel-logout'},
      session:{
        name:'polySession',store:new PostgresSessionStore(pool,config.sessionSecret),
        signSessionStoreCookie:true,requireSignedSessionStoreCookie:true,
        rolling:true,rollingDuration:1800,absoluteDuration:28800,
        cookie:{httpOnly:true,secure:config.baseURL.startsWith('https:'),sameSite:'Lax',path:'/'},
      },
      transactionCookie:{name:'polyLoginTransaction',sameSite:'Lax'},
      afterCallback:async(_req,_res,session)=>({...session,csrfToken:newCsrfToken()}),
    }));
    app.get('/auth/login',(req,res)=>res.oidc.login({
      returnTo:config.baseURL+'/#/account',
      ...(req.query.stepUp==='true' ? {authorizationParams:{
        max_age:0,acr_values:'http://schemas.openid.net/pape/policies/2007/06/multi-factor',
      }} : {}),
    }));
    app.use(api);
    app.use((_error,_req,res,_next)=>{
      if (!res.headersSent) json(res,503,{error:{code:'identity_unavailable',message:'Secure account service is temporarily unavailable.'}});
      else res.destroy();
    });
    handler=app;
  } else {
    handler=createRequestHandler({config});
  }
  const server=createServer({maxHeaderSize:16384},handler);
  server.requestTimeout=30000; server.headersTimeout=15000; server.keepAliveTimeout=5000;
  server.listen(config.port,config.host,()=>console.info(JSON.stringify({
    service:'poly-pod-pro',port:config.port,identityConfigured:config.identityConfigured,
    paymentsEnabled:config.paymentsEnabled,mode:config.mode,
  })));
  const shutdown=()=>server.close(async()=>{await pool?.end();process.exit(0);});
  process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);
}
start().catch(()=>{
  console.error('Server startup failed. Check server configuration, installed dependencies, database connectivity and migrations.');
  process.exitCode=1;
});



