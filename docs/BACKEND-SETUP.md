# Backend setup and release boundary

This is a prepared server foundation, saved in `Z:\PolyPodPro\printmatch\server`. It is **not an operating payment system**. No provider accounts exist, no production credentials have been supplied, no database has been migrated and no money has moved. The public application remains a clearly labeled sample experience. Its sample quote identifiers are never payment instructions.

The attempted provider dependency installation was declined. It was not retried. `server/package.json` declares the four official libraries; they are not installed or locked. The native HTTP API, domain tests and encrypted-session tests run using Node alone. Auth0, PostgreSQL and Stripe adapter integration requires installation and staging verification before enabling any real account or checkout UI.

## What is implemented

- A Node HTTP API with bounded bodies, same-origin mutations, session-bound CSRF tokens, redacted errors, no CORS grants and bounded per-process request limits.
- Optional official Auth0 authorization-code login with server-side sessions in PostgreSQL. The browser receives an SDK-signed session identifier. Session payloads are encrypted using AES-256-GCM. Cookies are HttpOnly, Secure on HTTPS, SameSite=Lax; idle sessions expire in 30 minutes, with an eight-hour absolute limit. The SDK owns OIDC state, nonce, PKCE and session ID rotation. No passwords, card numbers or provider tokens pass through frontend state.
- Verified-email checks, database-controlled account suspension and farm membership. Order reads filter by the authenticated buyer or farm membership in SQL. There is no public administrator endpoint, client role override or automatic farm membership.
- Immutable accepted-quote and order financial snapshots. Checkout reserves one durable order per quote. A stable provider idempotency key is retained; unknown attempts older than 22 hours stop for reconciliation.
- Stripe-hosted Checkout created on the seller's connected account. Seller fee payer must be `account`, payment loss responsibility must be `stripe`, US country and active card/payout capabilities are checked using fresh Stripe data. Commission and tips are disabled pending an approved fee policy.
- Exact raw-body Stripe webhook verification through the official SDK. Account, mode, currency, total, checkout ID, quote revision and metadata must match. Event deduplication and order state changes share a database transaction. Return URLs never mark an order paid; late unpaid events cannot reverse confirmed payment.
- Hosted onboarding for an already provisioned seller account, restricted to its database owner with recent MFA. It does not create an account or grant ownership. Responsibility settings and full seller dashboard are checked before requesting the hosted link.

There are **no** live quote creation/acceptance, CAD upload/storage, refund, dispute, fulfillment mutation or administrative provisioning endpoints. These missing workflows deliberately prevent the sample frontend from becoming a live marketplace simply by adding credentials.

## Local use without any provider

From `Z:\PolyPodPro\printmatch`, using Node 22.12 or newer:

```text
node server/index.mjs
node --test tests/server.test.mjs tests/commerce.test.mjs
```

The API listens on `127.0.0.1:8787`. `GET /api/status` and `GET /api/session` work without secrets. Protected operations fail closed. This server only serves API/auth routes; the Vite frontend is served separately. A production reverse proxy must serve the built frontend and route `/api/*` and `/auth/*` to this API under the same HTTPS origin. GitHub Pages alone cannot run this backend.

The example environment file is a reference; the process does not automatically load it. Use the host's secret manager or explicitly inject environment variables. Do not paste secrets into chat, add them to Git or name them with the `VITE_` prefix.

## Provider preparation after installation is authorized

1. Install the separate server package using the approved package manager in `printmatch/server`, generate a lockfile, review the dependency audit and commit that lockfile. No installation command has been executed successfully in this milestone. Versions are pinned from official repository manifests: Express 5.2.1, express-openid-connect 3.4.0, stripe 22.6.1 and pg 8.23.0. Published-package availability and the resolved dependency tree still need verification at installation.
2. Provision a managed PostgreSQL database in a US region. Keep TLS certificate verification enabled. Restrict network access, separate schema-owner credentials from the runtime role, enable encrypted backups and test restoration. The connection parser strips URL SSL flags so they cannot silently override certificate verification. `DATABASE_TLS=false` is permitted only in local development.
3. Review `schema.sql`, then explicitly run `node server/migrate.mjs` using migration credentials. The server never runs DDL at startup. Run the HTTP service with a least-privilege database role that cannot change schema, accepted financial fields or business memberships outside authorized workflows. Apply and verify permissions as part of staging.
4. Create a business-owned Auth0 Regular Web Application using Universal Login. Set the exact callback to `https://YOUR_HOST/auth/callback` and logout URL to the exact application origin. Use a high-entropy `SESSION_SECRET`: at least 32 random bytes represented as hexadecimal. Configure Auth0 back-channel logout to /auth/backchannel-logout and test signed logout-token delivery; the official SDK handles token verification using the same persistent store. Configure the tenant for verified email, recovery and MFA. Sensitive seller requests require a verified `mfa` authentication-method claim and an authentication time within 15 minutes; test your tenant's actual claims and step-up policy.
5. Create a business-owned Stripe Connect platform and obtain Stripe's approval of the business/charge configuration. In staging, use separate test keys, database and webhook secret. Register a **connected accounts** snapshot-event endpoint at `/api/webhooks/stripe` for `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed` and `checkout.session.expired`. Pin and test the destination's API version against the installed SDK. Connect direct charges require account-scoped API calls and account-scoped event verification.
6. Provision initial farms and memberships through a reviewed administrative process. Confirm each seller's legal name and US status. The existing hosted-onboarding endpoint works only for a prelinked connected account. Never populate these tables from public forms without a reviewed ownership and approval workflow.
7. Build the quote creation/acceptance workflow and its tenant-isolation tests. The required snapshot includes integer fabrication/shipping/tax cents, zero platform fee and tip, USD, expiry, immutable US delivery address, accepted CAD SHA-256, seller-reviewed non-safety-critical catalog classification, specification version, seller/platform/refund terms versions, tax review and durable consent evidence. A destination change requires a new quote; Checkout does not collect a different shipping destination.
8. Keep `PAYMENTS_ENABLED=false` until all release gates below are satisfied. A live key additionally requires `NODE_ENV=production`, HTTPS and a documented `LAUNCH_APPROVAL_REFERENCE`. This variable is a deliberate release latch, not a substitute for the reviews it references.

For reverse proxies, set `TRUSTED_PROXY` to the exact trusted proxy subnet(s) and prevent public direct access to the API port. Do not trust arbitrary forwarded headers. Set `HOST=0.0.0.0` only when the hosting network and firewall are configured to reach the service safely. Enforce TLS and frontend security headers at the edge as well as API headers here.

## Frontend contract

All API responses have `Cache-Control: no-store`. Error responses are `{error:{code,message,requestId}}`; provider secrets and internal error details are omitted.

| Method and route | Request | Result |
| --- | --- | --- |
| GET /api/status | Public | `service, identityConfigured, paymentsConfigured, paymentsEnabled, mode`; these are configuration flags, not provider health certification |
| GET /api/session | Same-origin cookie | `{authenticated:false,available}` or `{authenticated:true,accountStatus,user:{id,name,email,emailVerified},csrfToken}` |
| GET /auth/login | Browser navigation | Auth0-hosted login; optional `?stepUp=true` requests recent MFA |
| POST /auth/logout | Same-origin form with one `csrfToken` hidden field, or `X-CSRF-Token` header | Browser redirect through Auth0 logout; ordinary form navigation is preferred so the cross-origin redirect can complete |
| GET /api/orders | Verified session | `{orders:[...]}`, latest 100 authorized orders |
| GET /api/orders/:id | Verified session | `{order:{id,sellerName,totalCents,currency,paymentState,fulfillmentState,createdAt}}`; unrelated IDs return 404 |
| POST /api/checkout | Verified session, Origin, X-CSRF-Token; JSON `{quoteId}` only | `{orderId,url}`; redirect only to the returned Stripe-hosted URL |
| POST /api/sellers/:id/onboarding | Owner session with recent MFA, Origin, X-CSRF-Token; JSON `{}` | `{url}` for hosted onboarding |
| POST /api/webhooks/stripe | Exact raw body and Stripe-Signature | Verified, durable processing; remains active with the checkout kill switch off |

`accountStatus` is `active`, `suspended`, or `email_unverified`. A restricted account can read its own session and obtain the CSRF token needed to sign out; protected commerce operations remain forbidden. The optional account UI explains that restriction and retains hosted sign-out.

Client-supplied account IDs, roles, totals, fees or shipping overrides are rejected or never consulted. Login return targets and provider return URLs are server-generated. The sample React session and local storage are not real authorization.

## Required staging and operations gates

The local suite verifies native HTTP request handling and payment-domain behavior using isolated server-side test doubles. It **does not** verify a live PostgreSQL transaction, actual Stripe signature library, Auth0 redirect/callback/session middleware, a real reverse proxy, or any live provider configuration. All of those must be exercised after authorized dependency installation.

Before taking orders, verify concurrent double-click checkout, provider timeout followed by retry, a webhook arriving before the create response, duplicate and out-of-order webhooks, wrong account/mode/currency/amount, provider outage, expired quotes, account suspension and membership removal, cross-tenant reads, account recovery, session revocation, logout and MFA downgrade. Use Stripe test mode and multiple Auth0 test identities.

Build and test refunds, partial refunds, seller/customer support, disputes, payment reconciliation and alerts before live transactions. Payment and fulfillment states must stay separate. An order may enter production only after verified payment and seller acceptance. The current API does not start printing or send messages.

Schedule expired-session deletion, payment reconciliation and alerting through the deployment platform. Limit requests and payload sizes at the edge; the included rate limit is per process and is not a distributed abuse-control service. Monitor event failures using request IDs without logging request bodies, identity tokens, authorization headers, CAD names or addresses. Ensure clock synchronization for provider signature windows.

Business gates remain the approved fee/refund model, marketplace tax determination, reviewed buyer and seller terms, privacy/retention and IP policies, restricted catalog enforcement, insurance advice, incident response, backup restoration and a budget for unavoidable operating costs. This architecture neither creates escrow nor guarantees zero costs or zero liability.

## Official implementation references

- [Auth0 Express quickstart](https://auth0.com/docs/quickstart/webapp/express/index)
- [Auth0 SDK configuration](https://auth0.github.io/express-openid-connect/interfaces/ConfigParams.html)
- [Auth0 server session stores](https://auth0.github.io/express-openid-connect/interfaces/SessionConfigParams.html)
- [Stripe hosted direct charges](https://docs.stripe.com/connect/direct-charges?platform=web&ui=stripe-hosted)
- [Stripe webhook verification](https://docs.stripe.com/webhooks?lang=node)
- [PostgreSQL client TLS behavior](https://node-postgres.com/features/ssl)



## Security review follow-up

The prepared server now strips the connection-string `ssl` flag as well as other SSL overrides so `ssl=false` cannot override verified database TLS. Checkout rechecks the seller under a database lock at reservation and refuses to reuse a reserved order whose buyer, quote revision, seller account, currency or amount differs from the currently validated quote.

Session logout now retains an eight-hour revocation tombstone, preventing a request that loaded the session before logout from restoring it with an UPSERT at response completion. Auth0 back-channel logout markers use a separate store namespace and remain clearable on login. Session persistence rejects missing or expired timestamps and caps storage retention at eight hours.

Apply the updated schema migration before restarting this server; it adds `auth_sessions.revoked_at`. The session-key namespace change signs out previously stored sessions, which is intentional for this security change. Delete expired rows only when `expires_at <= now()`; do not remove unexpired revocation tombstones. The focused store tests exercise emitted SQL conditions through a deterministic test double. Actual PostgreSQL concurrency and the official OIDC middleware still need staging verification after authorized dependency installation.


## Optional private creation sharing
See [MESHY-PORTAL.md](MESHY-PORTAL.md) for the migration, endpoints, explicit CREATION_SHARING_ENABLED gate and verification limits. Apply server/creations.sql only after schema.sql. Meshy generation remains buyer-owned on Meshy's website; no Meshy API key is required. Disabling new writes preserves authorized reads and buyer revocation. This source has not been exercised against a real PostgreSQL deployment.
