import { randomBytes, timingSafeEqual } from 'node:crypto';

export class HttpError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}
export function fail(status, code, message) { throw new HttpError(status, code, message); }
export function safeId(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(value)) fail(400, 'invalid_id', 'A valid identifier is required.');
  return value;
}
export function newCsrfToken() { return randomBytes(32).toString('base64url'); }
export function verifyMutation({ origin, expectedOrigin, token, sessionToken }) {
  if (origin !== expectedOrigin) fail(403, 'origin_rejected', 'This request must come from the application.');
  if (typeof token !== 'string' || typeof sessionToken !== 'string' || !/^[A-Za-z0-9_-]{32,128}$/.test(token) ||
      token.length !== sessionToken.length || !timingSafeEqual(Buffer.from(token), Buffer.from(sessionToken))) {
    fail(403, 'csrf_rejected', 'Refresh the page before trying again.');
  }
}
export function requireVerified(principal) {
  if (!principal) fail(401, 'login_required', 'Sign in to continue.');
  if (principal.blockedAt) fail(403, 'account_unavailable', 'This account is unavailable.');
  if (!principal.emailVerified) fail(403, 'verified_email_required', 'Verify your email address before continuing.');
}
export function requireRecentMfa(claims, now = Date.now()) {
  if (!Array.isArray(claims?.amr) || !claims.amr.includes('mfa') || !Number.isFinite(claims.auth_time) ||
      claims.auth_time * 1000 > now + 60000 || now - claims.auth_time * 1000 > 15 * 60 * 1000) {
    fail(403, 'recent_mfa_required', 'Sign in again with multifactor authentication for seller account changes.');
  }
}
export function validateCheckoutBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      Object.keys(body).length !== 1 || !Object.hasOwn(body, 'quoteId')) {
    fail(400, 'invalid_checkout', 'Only an accepted quote identifier is allowed.');
  }
  return safeId(body.quoteId);
}
export function validateHostedURL(value, expectedHost) {
  let url;
  try { url = new URL(value); } catch { fail(502, 'invalid_provider_response', 'Payment service returned an invalid response.'); }
  if (url.protocol !== 'https:' || url.hostname !== expectedHost || url.username || url.password) {
    fail(502, 'invalid_provider_response', 'Payment service returned an invalid response.');
  }
  return url.href;
}
export function setSecurityHeaders(res, { production, baseURL }) {
  for (const [name, value] of Object.entries({
    'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin', 'Permissions-Policy': 'camera=(), microphone=(), geolocation=(self)',
    'Cross-Origin-Opener-Policy': 'same-origin', 'Cache-Control': 'no-store',
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
  })) res.setHeader(name, value);
  if (production && baseURL.startsWith('https:')) res.setHeader('Strict-Transport-Security', 'max-age=31536000');
}
export function createRateLimiter({ limit = 120, windowMs = 60000, maxKeys = 10000, now = Date.now } = {}) {
  const windows = new Map();
  return key => {
    const time = now();
    let record = windows.get(key);
    if (!record || record.resetAt <= time) {
      if (windows.size >= maxKeys) {
        for (const [ip, item] of windows) if (item.resetAt <= time) windows.delete(ip);
        if (windows.size >= maxKeys) fail(503, 'busy', 'Please try again shortly.');
      }
      record = { count: 0, resetAt: time + windowMs };
      windows.set(key, record);
    }
    if (++record.count > limit) fail(429, 'rate_limited', 'Please wait before trying again.');
  };
}

