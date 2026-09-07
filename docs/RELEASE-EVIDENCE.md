# Preview release evidence — September 7, 2026

Current checkpoint: Meshy buyer portal, model preparation guides, imported STL review, and selected-farm nonbinding estimates. Static preview packaged; not published. Live commerce and persistent private sharing remain disabled.

## Validation

- **141 tests pass**, zero failures/skips. Full output: `test-results.txt`. This adds 33 creation-focused checks to the prior 108 checks: STL/base64 limits, consent, private metadata and file integrity, selected-farm authorization SQL, revocation, daily/library caps, concurrent request revision checks, HTTP authentication/CSRF, upload envelopes and safe referral URLs. Provider/database checks use doubles.
- Full oxlint is clean. Vite production build passes with 1,927 modules. Main JavaScript: 217.14 KB (69.84 KB gzip); creation studio, inbox, toolkit, map and 3D code load separately.
- Browser: imported the actual `tests/fixtures/unit-cube.stl` (12 triangles). Displayed 1 × 1 × 1 mm, then changed source units to cm and saw 10 × 10 × 10 mm. The save button became disabled until size confirmation was renewed.
- Saved the actual file to the tab-only creation library. Selected Riverside Rapid Prints, added a brief, and confirmed its farm inbox displayed the same file, selected units, dimensions, and buyer notes.
- Farm estimate rejected `12.345`, accepted `$12.50` production and `$0.00` fulfillment, and required model review. The buyer then saw a $12.50 nonbinding estimate with a three-business-day lead time.
- Removed the sample share from the buyer library and confirmed the farm inbox returned to zero requests. Refresh cleared the tab-only creation library as labeled.
- Final build checked: associate link preserved as `https://www.meshy.ai/?via=PolyPodPro`, disclosure visible, buyer toolkit links present, and eight slicer guides plus Blender on the farm page. No browser warnings/errors were reported by the inspected preview log.
- The current studio fit the available browser view without horizontal overflow (document 701 px within reported 716 px window). Requested 320 px viewport emulation was not reflected by this browser surface; this checkpoint does not claim a completed 320 px check for the new pages. Prior map/fulfillment pages were checked at 320 px in the earlier checkpoint. Viewport override was reset.

## What changed and what remains gated

[Meshy workflow and research](MESHY-PORTAL.md) records the full integrations review, adopted tools, buyer-account billing boundary, source links, migration and prepared API routes. The old unused simulated Meshy generation service was replaced. No Meshy API key or generation calls are part of the web app.

The prior platform research, local service-area maps, sample farm-controlled fulfillment, unit conversion, quote revisions, sample checkout and account/security source remain included. See [PLATFORM-RESEARCH.md](PLATFORM-RESEARCH.md).

Preview: `http://127.0.0.1:4174/#/create`. Canonical source: `Z:\PolyPodPro\printmatch`.

The release archive contains only final dist files; all 52 entries were compared with source SHA-256 hashes. No server source, environment files, dependencies, personal art or historical root pages are included.

No new dependencies or paid services were added. Provider dependency installation remains declined. No deployment, real transaction, Meshy generation, remote CAD upload, actual seller contact, account provisioning or database migration occurred. Meshy referral credit attribution was not exercised. PostgreSQL isolation/locking and real hosted account integration remain unverified. Prepared private STL sharing must pass staging and operating checks before being enabled; it does not enable paid orders.

Next publication checks: new-page narrow mobile review, end-user downloads and complete sample flow at the intended destination, hosting subdirectory, simulated outages, and final destination verification. The existing public GitHub Pages preview is unchanged. See RELEASE-CHECKLIST.md and BACKEND-SETUP.md.

This is a stable stopping point. All changes and research are saved; resume from these notes without repeating successful checks unless code or conditions change.

## Cloud verification — September 7, 2026 (Claude handoff continuation)

Continued from the Codex handoff (`docs/CLAUDE-HANDOFF.md`) in an isolated Linux cloud container. Environment: Node 22.22.2, pnpm 10.33.0. Frozen install (`pnpm install --frozen-lockfile --ignore-scripts`) succeeded from `pnpm-lock.yaml` (lockfile v9). This checkpoint reflects the first clean-Linux baseline; earlier checkpoints ran on Windows.

### Automated checks (cloud)
- **146 tests pass**, zero failures/skips (`pnpm test`). This is the prior 141 plus 5 new `tests/migrate-plan.test.mjs` checks covering which schema files the migration runner applies.
- Full oxlint clean (`pnpm lint`, exit 0). Vite production build passes with **1,927 modules** (`pnpm build`), matching the prior checkpoint. Main JS bundle unchanged at 217.14 KB (69.84 KB gzip).

### STL units and downloads (actual `tests/fixtures/unit-cube.stl`, 12 triangles)
Verified through `src/lib/stlUnits.js`: source **mm → 1 mm**, **cm → 10 mm**, **in → 25.4 mm** cube. Source geometry coordinates are unchanged after conversion (original-file download preserves source units). A normalized cm export re-imports as a valid 12-triangle 10 mm cube and stays 10 mm when reopened as mm. `isCurrentModelInfo` invalidates size confirmation when source units change (cm → in).

### Responsive and accessibility (headless Chromium, Playwright)
Audited `/#/`, `/#/?view=map`, `/#/create`, `/#/request`, `/#/owner/creations`, `/#/account` at **320, 375, 768 and 1280 px**.
- **Zero horizontal overflow at every viewport on every page**, including the new creation pages. This closes the previously-unverified 320 px narrow-mobile check that the earlier Windows browser could not emulate.
- Zero JavaScript console/page errors on all routes.
- Small raw-element sizes flagged by the audit are not real target-size failures: consent checkboxes are wrapped in full-width `<label>` rows (confirmed by clicking the label text, away from the 16 px box, which toggles the control), file inputs are `sr-only` and triggered by visible buttons, and the remaining items are inline text links plus third-party Leaflet/OpenStreetMap attribution.
- Keyboard: "Skip to content" is the first tab stop and moves focus to `#main-content`; route changes move focus to the main region and reset scroll.

### Sample workflows (headless Chromium, end-to-end)
- Creation → estimate → revoke: imported the actual `unit-cube.stl`, set source units to cm (10 × 10 × 10 mm shown), confirmed rights and dimensions, saved to the tab library, requested review from the sample farm (Riverside Rapid Prints), and confirmed the farm inbox showed the same file, source units and dimensions. The estimate form rejected `12.345` ("must be a dollar amount with at most two decimal places"), accepted `$12.50` production / `$0.00` fulfillment, and the buyer then saw a $12.50 nonbinding estimate at three business days. Removing the sample request returned the farm inbox to zero requests.
- Request → quotes → sample checkout → order: configured a procedural sample part, quantity 2, and compared three example quotes showing per-order fulfillment charges (farm pickup $0.00, local drop-off $5.00, US shipping $6.00) with a "Lowest example subtotal" badge. Checkout listed three delivery options; selecting local drop-off surfaced the farm's "10-mile example service radius" note; the sample subtotal computed to $35.78. Creating the sample order routed to `/orders/demo-…`, which renders the order-tracking workspace ("Sample · Queued"), not a payable order.

### Error and edge states
Oversized (>10 MB) files rejected on `/#/create`; unsupported extensions rejected on `/#/request`; a malformed `.stl` produces a clear viewer validation error ("This STL is incomplete or has an invalid binary length"); the `*` route renders the 404 page ("This page moved off the print bed.", title "Page not found | Poly Pod Pro").

### Connected-sharing boundary (reviewed, not enabled)
Ran the prepared backend status service with no provider variables set: `node server/index.mjs` starts with `identityConfigured:false, paymentsEnabled:false` and needs no provider dependencies. `GET /api/status` and `GET /api/creation-status` (`{configured:false, enabled:false}`) report disabled; `POST /api/creations` fails closed with **503 `identity_unavailable`**. No provider dependencies were installed, no database was migrated, and no service was enabled.

### Documentation/release gaps addressed this checkpoint
- The private-creation migration now has an explicit command: `node server/migrate.mjs --with-creations` (or `CREATION_SHARING_ENABLED=true node server/migrate.mjs`) applies `schema.sql` then `creations.sql`, each under its own advisory lock; the default command still applies only `schema.sql`. Covered by `tests/migrate-plan.test.mjs`; the actual PostgreSQL application still requires the authorized dependency install and staging verification.
- The stale `printmatch/package-lock.json` (older package name, missing the direct Three dependency) was removed so `pnpm-lock.yaml` is the single frontend lockfile; the README states the pnpm-only policy. No dependency versions were changed.

### Still gated (unchanged by this checkpoint)
Real Auth0/PostgreSQL/Stripe integration, live migrations, payments, publication/deployment, Meshy referral attribution, storage retention/backups, and large-inbox pagination remain unexercised and gated. Relevant server tests still use doubles. A configured server is not a launched marketplace, and this checkpoint did not deploy anything or open commerce. The static-preview release archive and hash below were produced in the earlier Windows checkpoint and were not regenerated here.

Archive: `Z:\PolyPodPro\release\poly-pod-pro-preview.zip`
Files: 52
Bytes: 414113
SHA-256: d52cd130992c44680b8cc55eda747e80f82a2e895f87eaf4d3a0652d80fe650b
