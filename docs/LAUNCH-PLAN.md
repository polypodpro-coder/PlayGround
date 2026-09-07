# Poly Pod Pro launch plan

Updated 2026-09-07. Canonical working application: `Z:\PolyPodPro\printmatch`.

## Release boundary

The overhaul now exposes a public, explorable **sample preview**. The old production launch-page restriction and `VITE_ENABLE_DEMO` gate have been replaced. `VITE_API_ENABLED=false` remains the default; no real account or transaction service is needed to explore the app.

This milestone is ready for preview packaging and final release checks, **not paid marketplace launch**. Publish only the reviewed `printmatch/dist/` output. Historical root HTML and generator scripts are not deployment entry points. The planned archive is `Z:\PolyPodPro\release\poly-pod-pro-preview.zip`. Hash routing supports a static GitHub Pages preview; that host cannot run the backend.

## Confirmed decisions

- Independent print farms sell directly to buyers; initial geography is the United States.
- Auth0 managed hosted login is the selected account direction. Passwords stay in the provider-hosted experience; production sessions and permissions belong on the server.
- Stripe Connect hosted onboarding and hosted Checkout using direct charges are the proposed payment direction. Seller eligibility, fee payer, loss responsibility, and account configuration require Stripe approval and fresh provider checks.
- Farms are proposed to bear processor fees from their proceeds and price quotes accordingly. Buyers should see production, delivery, and applicable tax before payment. No automatic buyer card surcharge is proposed.
- A marketplace commission is not approved. The prepared backend disables commission and tips pending an approved policy; preview gratuities are illustrative only.
- Initial catalog is decorative work and non-safety-critical prototypes. Medical, food-contact, children's, load-bearing, and other safety-critical applications are outside the initial scope.

Selected providers are not configured integrations. Provider pricing, refunds, fraud, hosting, storage, support, insurance, and legal work can create costs. Contract wording does not eliminate statutory duties or liability. Do not advertise zero expenses, guaranteed protection, verified farms, universal manufacturability, or escrow.

## What the overhaul delivers

The responsive preview keeps buyer discovery, sample farm profiles, concept designs, local STL inspection/export, material and finishing selection, example quotes, sample checkout, order tracking, and local message drafts. Farm pages cover dashboard activity, searchable requests, local quote drafts, illustrative gross sales, service area, profile/portfolio, material rates, and manual sample fleet status.

Sample identities are separate from optional hosted account sessions. The preview collects no payment credentials or personal account edits. Files remain local; CAD references and photos do not become reconstructed or manufacturing-approved geometry. No message, manufacturing request, payout, or device connection is sent.

The latest pass adds farm quote revisions saved across navigation, explicit STL source units and millimeter exports, build-envelope screening, clearer mobile controls, and lazy page loading. Buyer maps fit complete service circles and allow selecting an individual farm; profile links open that farm's coverage. The circles are example straight-line areas, with pickup/drop-off availability and terms requiring farm confirmation. Sample state remains temporary and resets on refresh.

Backend source prepares HTTP/session controls, account authorization, quote/order snapshots, Stripe checkout/webhook handling, and hosted onboarding for already provisioned sellers. **Provider dependency installation was declined and remains incomplete.** No Auth0 tenant, Stripe account, or PostgreSQL integration has been exercised. Source implementation is not production certification. See [BACKEND-SETUP.md](BACKEND-SETUP.md) for exact behavior and gaps.

## Work required before real commerce

1. **Providers and identity:** authorize and install backend dependencies, produce a reviewed lockfile, provision business-owned accounts and a managed US database, configure HTTPS/secrets, and verify login, recovery, MFA, session revocation, and tenant isolation.
2. **Seller eligibility:** establish the reviewed farm provisioning and ownership process, complete hosted onboarding, confirm legal identity/capabilities/responsibilities, and suspend purchases when eligibility changes. A hosted-link endpoint alone is not an onboarding program.
3. **Private files and quotes:** implement quarantine/storage, type and resource limits, isolated parsing, malware checks, per-order access, retention, immutable file/specification versions, seller review, and durable quote acceptance. Sample quote IDs cannot become payment instructions.
4. **Transactions and fulfillment:** verify the actual SDK, database, webhooks, concurrency, timeouts, reconciliation, and kill switch in staging. Build refunds, partial refunds, disputes, support, seller acceptance, shipment evidence, and authorized fulfillment transitions. Keep payment and fulfillment states separate.
5. **Tax and business policies:** resolve marketplace tax treatment and reporting, fee/refund responsibilities, buyer and seller terms, privacy/retention, IP permissions, catalog enforcement, product safety escalation, and insurance with qualified advisers.
6. **Operations:** fund an operating budget; verify backups/restoration, audit trails, alerts, rate limits, incident response, vendor outages, and production/staging separation. Record the approval behind any production payment enablement.

Adding credentials or setting a frontend flag does not complete these requirements. Live quote creation/acceptance, uploads, refunds, disputes, fulfillment mutation, and administrative provisioning remain incomplete.

## Evidence and handoff

The frontend build and local tests are useful release checks. Native server and domain tests use isolated test doubles; they do not prove actual Auth0 middleware, Stripe signatures/API configuration, PostgreSQL transactions, or reverse-proxy behavior. No real integration tests or financial transactions have been completed.

Record final build/test results and browser checks against the packaged revision in [RELEASE-CHECKLIST.md](RELEASE-CHECKLIST.md). Do not infer a final test count from earlier milestones. Provider integration and paid publication remain separate gates.

Continue in `Z:\PolyPodPro\printmatch`; keep secrets outside chat, Git, and all `VITE_` variables. Use [BACKEND-SETUP.md](BACKEND-SETUP.md) as the backend handoff. No provider installation, migration, live payment enablement, or deployment is authorized by this document.

