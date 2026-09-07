// Server-only configuration; never expose these values through VITE_* variables.
export function readConfig(env = process.env) {
  const production = env.NODE_ENV === 'production';
  let base;
  try { base = new URL(env.APP_BASE_URL || 'http://localhost:8787'); }
  catch { throw new Error('APP_BASE_URL must be an absolute URL'); }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname);
  if (base.username || base.password || base.search || base.hash || base.pathname !== '/' ||
      !['http:', 'https:'].includes(base.protocol) || (base.protocol !== 'https:' && (!local || production))) {
    throw new Error('APP_BASE_URL requires HTTPS (HTTP allowed only on local development)');
  }
  const identityConfigured = ['AUTH0_ISSUER_BASE_URL', 'AUTH0_CLIENT_ID', 'AUTH0_CLIENT_SECRET',
    'SESSION_SECRET', 'DATABASE_URL'].every(key => Boolean(env[key]));
  if (env.SESSION_SECRET && !/^[a-fA-F0-9]{64,128}$/.test(env.SESSION_SECRET)) {
    throw new Error('SESSION_SECRET must be 32 to 64 cryptographically random bytes encoded as hexadecimal');
  }
  if (env.AUTH0_ISSUER_BASE_URL) {
    const issuer = new URL(env.AUTH0_ISSUER_BASE_URL);
    if (issuer.protocol !== 'https:' || issuer.username || issuer.password || issuer.search || issuer.hash || issuer.pathname !== '/') {
      throw new Error('AUTH0_ISSUER_BASE_URL requires an HTTPS origin');
    }
  }
  const stripeKey = env.STRIPE_SECRET_KEY || '';
  if (stripeKey && !/^(sk|rk)_(test|live)_/.test(stripeKey)) throw new Error('Unrecognized Stripe server key');
  const mode = stripeKey.includes('_live_') ? 'live' : 'test';
  const paymentsConfigured = identityConfigured && Boolean(stripeKey && env.STRIPE_CONNECT_WEBHOOK_SECRET);
  const paymentsEnabled = paymentsConfigured && env.PAYMENTS_ENABLED === 'true';
  const creationSharingEnabled = identityConfigured && env.CREATION_SHARING_ENABLED === 'true';
  if (env.CREATION_SHARING_ENABLED === 'true' && !identityConfigured) throw new Error('Private creation sharing requires complete identity and database configuration');
  if (env.PAYMENTS_ENABLED === 'true' && !paymentsConfigured) throw new Error('Payments require complete identity, database and Stripe configuration');
  if (paymentsEnabled && mode === 'live' && (!production || !env.LAUNCH_APPROVAL_REFERENCE)) {
    throw new Error('Live payments require production mode and a completed launch approval reference');
  }
  const port = Number(env.PORT || 8787);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT');
  let connectionString = env.DATABASE_URL || '';
  if (connectionString) {
    const db = new URL(connectionString);
    if (!['postgres:', 'postgresql:'].includes(db.protocol)) throw new Error('DATABASE_URL requires PostgreSQL');
    for (const key of ['ssl', 'sslmode', 'sslcert', 'sslkey', 'sslrootcert']) db.searchParams.delete(key);
    connectionString = db.href;
  }
  if (production && connectionString && env.DATABASE_TLS === 'false') throw new Error('Database TLS is mandatory in production');
  return Object.freeze({
    production, baseURL: base.origin, port, host: env.HOST || '127.0.0.1',
    trustedProxy: env.TRUSTED_PROXY || '', identityConfigured, paymentsConfigured, paymentsEnabled, creationSharingEnabled, mode,
    issuerBaseURL: env.AUTH0_ISSUER_BASE_URL, clientID: env.AUTH0_CLIENT_ID,
    clientSecret: env.AUTH0_CLIENT_SECRET, sessionSecret: env.SESSION_SECRET,
    stripeKey, webhookSecret: env.STRIPE_CONNECT_WEBHOOK_SECRET,
    database: connectionString ? {
      connectionString, max: 10, connectionTimeoutMillis: 5000, statement_timeout: 10000,
      ssl: env.DATABASE_TLS === 'false' && !production ? false : {
        rejectUnauthorized: true, ...(env.DATABASE_CA ? { ca: env.DATABASE_CA } : {}),
      },
    } : null,
  });
}


