# Release checklist

This checklist separates publication of the **static sample preview** from opening real commerce. A checked preview item does not satisfy a commerce gate.

## Static preview release

- [x] Build the final `printmatch/` revision with `VITE_API_ENABLED=false`. The old `VITE_ENABLE_DEMO` flag is unused.
- [x] Run `pnpm lint`, `pnpm test`, and `pnpm build`; record the actual final results and any remaining warnings.
- [x] Serve `dist/` over HTTP and review desktop/mobile layouts, keyboard focus, navigation, and empty search states. Reviewed widths/pages are recorded in release evidence.
- [x] Verify farm quote revisions across navigation, STL source units and quote-summary restoration, and service-radius maps linked from profiles/settings.
- [ ] Repeat the complete sample request → quotes → checkout → order flow and end-user STL download at the intended publication destination.
- [ ] Simulate map/network failures and complete broader error-state review; map loading and reload recovery were checked.
- [ ] Confirm visible sample labeling; no real login prompts, card/bank/address collection, sent messages, live onboarding, or payable orders in the static build.
- [ ] Confirm refresh/hash routes, relative assets, and the intended hosting subdirectory work. Review map loading and local-file limits.
- [x] Package only reviewed static build files. Exclude server source, secrets, environment files, source dependencies, and all historical root HTML.
- [x] Prepare `Z:\PolyPodPro\release\poly-pod-pro-preview.zip` and verify its contents match the reviewed `dist/` build.
- [ ] Obtain publication approval for the concrete preview and destination; publish only `dist/` contents, then verify the public URL and hash routes.

GitHub Pages can host this preview. It cannot host the prepared API or turn sample orders into real transactions. The former root `preview.html` is a historical artifact and is not refreshed by building this app.

Final evidence: record build/lint/test results, browser checks, archive location, known limitations, and publication status for the reviewed revision. Do not copy prior milestone test counts.

## Separate gates for real commerce

- [ ] Backend dependency installation is authorized and completed, with reviewed lockfile/audit. The earlier installation was declined; declared dependencies alone are insufficient.
- [ ] Business-owned Auth0, Stripe Connect, database, storage, and hosting are configured in separate staging/production environments. No credentials are stored in frontend variables.
- [ ] Actual provider login/logout/recovery/MFA, database sessions, authorization, tenant isolation, and proxy behavior pass integration tests.
- [ ] Farm provisioning, ownership, onboarding, US eligibility, capabilities, and processor/loss responsibilities are verified through the real provider.
- [ ] Private uploads, validation/quarantine, access controls, retention, seller file review, immutable quotes, and durable buyer acceptance are implemented and tested.
- [ ] Hosted checkout and real signature verification pass concurrency, timeout/retry, duplicate/out-of-order webhook, reconciliation, and outage tests.
- [ ] Refunds, disputes, seller support, fulfillment controls, shipment evidence, and operational escalation are implemented and tested.
- [ ] Tax treatment/reporting, buyer/seller terms, fee/refund policy, privacy/IP rules, restricted catalog, insurance, and operating budget are reviewed and approved.
- [ ] Backups/restoration, monitoring, audit trails, abuse controls, incident response, and the payment kill switch are exercised.
- [ ] Explicit launch approval is recorded before enabling paid ordering. Recheck seller configuration and release gates after material changes.

See [LAUNCH-PLAN.md](LAUNCH-PLAN.md) for decisions and [BACKEND-SETUP.md](BACKEND-SETUP.md) for source implementation, setup steps, and test limitations. No configuration or checklist guarantees zero liability or zero costs.



## Meshy creation checkpoint
- [x] Actual local STL → selected sample farm → nonbinding estimate → buyer review and revocation verified.
- [x] Supplied associate link and nearby credit disclosure included; external preparation and slicer guides reviewed.
- [ ] New creation pages checked on a verified narrow mobile viewport; current browser ignored the requested width.
- [ ] Connected private sharing tested against real hosted identity and PostgreSQL before enabling its separate write flag.
See [MESHY-PORTAL.md](MESHY-PORTAL.md) and the current release evidence.
