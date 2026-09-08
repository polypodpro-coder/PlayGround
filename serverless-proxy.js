/**
 * Poly Pod Pro — Meshy BYOK CORS proxy (Cloudflare Worker)
 * ---------------------------------------------------------
 * The Creation Studio (#/create) calls this Worker instead of Meshy directly,
 * because a browser cannot call https://api.meshy.ai from GitHub Pages (CORS),
 * and because the user's Meshy API key must never be embedded in the static site.
 *
 * How it works
 *   - The frontend sends the user's own key in a custom header: X-User-Meshy-Key.
 *   - This Worker forwards allow-listed /openapi/* requests to Meshy, moving that
 *     key into the standard `Authorization: Bearer <key>` header. The user is
 *     billed by Meshy — Poly Pod Pro never sees or stores the key server-side.
 *   - It also proxies the finished model download (GET /download?url=...) so the
 *     browser can fetch the result STL from Meshy's CDN with CORS headers.
 *
 * Deploy
 *   1. Create a Worker at https://dash.cloudflare.com (Workers & Pages → Create →
 *      Start with Hello World!), then Edit code and paste this whole file.
 *   2. Deploy.
 *   3. (Optional) Set an environment variable ALLOWED_ORIGIN to your site's exact
 *      origin, e.g. https://polypodpro-coder.github.io — to restrict who may use
 *      the proxy from a browser. You can list several, comma-separated. If unset
 *      (or "*"), any origin is allowed and the caller's origin is echoed back, so
 *      CORS "just works" without configuration. A request from an origin that is
 *      NOT in a configured list gets a clear 403 message (not a silent failure).
 *   4. Copy the Worker URL (e.g. https://poly-pod-meshy.<you>.workers.dev) and
 *      paste it into the Creation Studio settings panel as the "Proxy URL".
 *
 * Security notes
 *   - Only specific Meshy endpoints are allow-listed (text-to-3d, image-to-3d).
 *   - Downloads are restricted to *.meshy.ai hosts.
 *   - The key is read per-request and forwarded once; it is never logged or stored.
 */

const MESHY_API = 'https://api.meshy.ai';
const ALLOWED_API_PREFIXES = [
  '/openapi/v2/text-to-3d',
  '/openapi/v1/image-to-3d',
];

function isAllowedDownloadHost(hostname) {
  return hostname === 'meshy.ai' || hostname.endsWith('.meshy.ai');
}

// Always return a browser-usable Access-Control-Allow-Origin. When ALLOWED_ORIGIN
// is unset or "*", echo the caller's origin; otherwise still echo it so the
// response is readable, and enforce the allowlist separately (see originAllowed).
function allowOriginFor(request) {
  return request.headers.get('Origin') || '*';
}

// Whether this origin is permitted. Unset/"*" allows all; a comma-separated list
// restricts to those origins (trailing slashes ignored).
function originAllowed(request, env) {
  const configured = ((env && env.ALLOWED_ORIGIN) || '').trim();
  if (!configured || configured === '*') return true;
  const reqOrigin = (request.headers.get('Origin') || '').replace(/\/+$/, '');
  if (!reqOrigin) return true; // non-browser callers have no Origin
  const list = configured.split(',').map((s) => s.replace(/\/+$/, '').trim()).filter(Boolean);
  return list.includes(reqOrigin);
}

function corsHeaders(request) {
  return {
    'Access-Control-Allow-Origin': allowOriginFor(request),
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-User-Meshy-Key',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function json(status, body, request) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(request) },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Preflight — always answer with CORS so the browser proceeds.
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }

    // Enforce the optional origin allowlist with a readable error (not a silent CORS fail).
    if (!originAllowed(request, env)) {
      return json(403, { error: { message: 'This origin is not allowed by the proxy. Set ALLOWED_ORIGIN to your site origin, or remove it to allow all.' } }, request);
    }

    // Result download passthrough: GET /download?url=<meshy asset url>
    if (url.pathname === '/download') {
      if (request.method !== 'GET') return json(405, { error: { message: 'Use GET for downloads.' } }, request);
      const target = url.searchParams.get('url');
      let parsed;
      try { parsed = new URL(target); } catch { return json(400, { error: { message: 'Missing or invalid url parameter.' } }, request); }
      if (parsed.protocol !== 'https:' || !isAllowedDownloadHost(parsed.hostname)) {
        return json(403, { error: { message: 'Downloads are restricted to Meshy hosts.' } }, request);
      }
      let upstream;
      try { upstream = await fetch(parsed.href, { method: 'GET' }); }
      catch { return json(502, { error: { message: 'Could not download the model from Meshy.' } }, request); }
      const headers = new Headers(corsHeaders(request));
      const contentType = upstream.headers.get('Content-Type');
      if (contentType) headers.set('Content-Type', contentType);
      headers.set('Cache-Control', 'no-store');
      return new Response(upstream.body, { status: upstream.status, headers });
    }

    // API passthrough: /openapi/* forwarded to Meshy with the user's key.
    const isAllowedApi = ALLOWED_API_PREFIXES.some(
      (prefix) => url.pathname === prefix || url.pathname.startsWith(prefix + '/'),
    );
    if (!isAllowedApi) {
      return json(404, { error: { message: 'Unknown proxy route.' } }, request);
    }
    if (request.method !== 'GET' && request.method !== 'POST') {
      return json(405, { error: { message: 'Only GET and POST are supported.' } }, request);
    }

    const userKey = request.headers.get('X-User-Meshy-Key');
    if (!userKey) {
      return json(401, { error: { message: 'Missing X-User-Meshy-Key header.' } }, request);
    }

    const upstreamHeaders = new Headers();
    upstreamHeaders.set('Authorization', `Bearer ${userKey}`);
    const contentType = request.headers.get('Content-Type');
    if (contentType) upstreamHeaders.set('Content-Type', contentType);

    const init = { method: request.method, headers: upstreamHeaders };
    if (request.method === 'POST') init.body = await request.text();

    let upstream;
    try {
      upstream = await fetch(MESHY_API + url.pathname + url.search, init);
    } catch {
      return json(502, { error: { message: 'Could not reach Meshy. Try again shortly.' } }, request);
    }

    const headers = new Headers(corsHeaders(request));
    headers.set('Content-Type', upstream.headers.get('Content-Type') || 'application/json');
    headers.set('Cache-Control', 'no-store');
    return new Response(upstream.body, { status: upstream.status, headers });
  },
};
