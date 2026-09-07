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

Archive: `Z:\PolyPodPro\release\poly-pod-pro-preview.zip`
Files: 52
Bytes: 414113
SHA-256: d52cd130992c44680b8cc55eda747e80f82a2e895f87eaf4d3a0652d80fe650b
