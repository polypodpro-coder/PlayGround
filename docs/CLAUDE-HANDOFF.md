# Claude handoff — September 7, 2026

The user has asked Claude to take over implementation to conserve Codex usage. Continue work on Poly Pod Pro, a US-only independent print-farm marketplace. This is the current local source; do not restart from an older GitHub copy.

## Workspace and evidence

- Repository: `Z:\PolyPodPro`; application: `Z:\PolyPodPro\printmatch`.
- Preview: `http://127.0.0.1:4174/#/create`; map: `/#/?view=map`; farm creations: `/#/owner/creations`.
- Read `docs/RELEASE-EVIDENCE.md`, `docs/MESHY-PORTAL.md`, `docs/RELEASE-CHECKLIST.md`, and `docs/BACKEND-SETUP.md` first. `docs/LAUNCH-PLAN.md` and `docs/PLATFORM-RESEARCH.md` explain the marketplace decisions.
- Last checkpoint: **141 tests pass**, lint clean, production build succeeds (1,927 modules). Real provider/database integration remains untested; relevant tests use doubles.
- Static archive: `Z:\PolyPodPro\release\poly-pod-pro-preview.zip`, 52 files, 414113 bytes; SHA-256 `d52cd130992c44680b8cc55eda747e80f82a2e895f87eaf4d3a0652d80fe650b`.
- Work is saved but intentionally uncommitted. Preserve existing dirty changes. Do not reset, replace with upstream, or publish historical root HTML. Edit the canonical application above; save all deliverables on Z:.

## Product decisions and current work

Buyers buy from independent US print farms. Keep existing discovery, farm radius maps for pickup/local drop-off, materials/machine/finishing configuration, unit-aware STL viewing, farm-controlled fulfillment options/fees, sample quote/order flow, farm workspaces, and hosted-account/payment source.

Meshy generation and costs belong to each buyer's Meshy account. The studio opens Meshy's website, uses the public associate link `https://www.meshy.ai/?via=PolyPodPro` with the nearby disclosure that we may earn Meshy credits, and links image/text generation, conversion, polygon reduction, repair, all eight slicer guides, and Blender preparation. It does not collect API keys, run generation, pay for credits, embed login, or claim automatic account/file synchronization. Meshy's installed CLI documents OAuth, but no third-party web-client contract was verified. The unused fake generation service was removed.

Actual STL import → rights/current-unit/dimension review → library → selected farm request → actual model review → nonbinding estimate → buyer review/revocation works in the static preview. Files and sample activity stay only in tab memory and reset on reload. Preview allows five files, 10 MB/150k triangles each. Source units (mm/cm/in) matter; STL stores no units. Farm estimates never become payable orders automatically.

Prepared backend files `server/creations.mjs`, `creation-repository.mjs`, and `creations.sql` add private validated immutable STL bytes/SHA-256, authenticated active/verified-account access, Origin/CSRF mutations, approved US seller membership access, buyer revocation, limits (five imports/day, 100/library, ten active farms/model), and stale request revision checks. API routes, context and UI are wired. Reads/revoke remain allowed when new-write flag is off. Real PostgreSQL migrations/isolation, retention, backups and hosted sessions have not been exercised.

## Next bounded work

1. Verify the canonical directory and current evidence before editing. Inspect the actual app; don't repeat successful tests until a code change or unresolved issue calls for them.
2. Finish new-page narrow mobile QA at actual 320/375/768 px, keyboard navigation and practical accessibility. The last browser ignored requested 320 px emulation; only ~716 px was verified for the new pages. Fix problems found.
3. Verify original and normalized STL downloads (and source units), repeat the creation → sample farm → estimate → revoke flow, and the existing request → quotes → sample checkout → order flow. Check malformed files and unavailable-service states. Never contact actual sellers or incur charges while testing.
4. Inspect prepared connected sharing for release blockers. Real backend setup remains blocked by the previously declined dependency installation; document missing configuration and staging tests rather than pretending it is live. Meaningful source/tests/fixes remain authorized.
5. Run tests/lint/build appropriate to changes; update `docs/RELEASE-EVIDENCE.md`, handoff notes and the dist-only release archive/hash when the checkpoint is stable. Report what works, what's still gated and the next concrete task.

## Constraints to preserve

- Provider dependency installation (`express`, `express-openid-connect`, `stripe`, `pg`) was declined. Do not install/retry or create provider accounts without a fresh user decision. No passwords/secret keys in chat or frontend variables.
- Static default is `VITE_API_ENABLED=false`. Private sharing requires hosted identity/database, the separate `creations.sql` migration and `CREATION_SHARING_ENABLED=true`; payments have a separate disabled gate. No live migration, paid API call or publishing has occurred.
- Do not deploy, merge or enable payments as part of this QA handoff. Prepare a concrete reviewable release first. The public GitHub Pages preview is still the older artifact.
- Keep billing/account handling with suitable hosted providers; avoid platform-funded Meshy costs and unapproved fee arrangements. No zero-cost or zero-liability guarantees.
- Maintain clear preview labeling; no fabricated testimonials, verified farms, generated models, successful uploads, paid quotes or completed transactions.
- User wants visual progress and efficient usage. Work independently in focused batches, give brief meaningful updates and leave a stable checkpoint.

## Runtime notes

Existing frontend dependencies are installed. Node and pnpm may need these already available runtimes:

- Node: `C:\Users\damia\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe`
- pnpm: `C:\Users\damia\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd`

Put the Node directory on the current process PATH if pnpm cannot find node. In `printmatch`, the normal checks are `pnpm test`, `pnpm lint`, `pnpm build`. Do not install a new runtime just to run them. Publish/package only `printmatch/dist` contents; never the repository root, server, env files or dependencies.

If Claude cannot access Z:, clearly say so and request this handoff/source through a supported local-folder workflow. Do not silently work on the older cloud branch. Codex will stop editing to avoid competing changes after this handoff.
