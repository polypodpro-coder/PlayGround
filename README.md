# Poly Pod Pro

A US marketplace concept connecting buyers with independent print farms. The canonical application is `printmatch/` in `Z:\PolyPodPro`.

The overhaul is a **public, explorable sample preview**, ready for preview packaging and final release checks. It is not an operating marketplace: no real orders, payments, seller onboarding, or manufacturing are enabled. The prepared backend still needs provider dependencies, business-owned accounts, and staging integration tests.

## Explore locally

Use Node 22.12 or newer and pnpm:

```powershell
Set-Location Z:\PolyPodPro\printmatch
pnpm install --frozen-lockfile --ignore-scripts
pnpm dev
```

`VITE_API_ENABLED=false` is the default. The obsolete `VITE_ENABLE_DEMO` gate is no longer used. Keep sample information in the preview.

## What is included

- Responsive buyer discovery, selectable local service-radius maps, farm profiles, design concepts, and material/finishing selection.
- Local STL viewing with mm/cm/in source units, procedural samples, and millimeter STL export; other CAD and photo files remain references.
- Fulfillment-aware example quotes, farm pickup/drop-off/shipping choices and fees, sample checkout, order timelines, and local message drafts.
- Farm dashboard, searchable requests, revisioned quote drafts saved across navigation, gross-sales examples, and sample profile/fleet settings.
- Account readiness with clearly separate sample personas and prepared hosted-login support.

Preview edits are temporary. They do not update real accounts, contact sellers, upload CAD, or control printers.

## Validate and package

From `printmatch/`:

```text
pnpm lint
pnpm test
pnpm build
pnpm preview --host 127.0.0.1
```

Publish **only the contents of `printmatch/dist/`** after the release checklist is completed. Never deploy the historical root `index.html`, `preview.html`, `app.js`, or generation scripts. Hash routing and relative assets support a static GitHub Pages preview; GitHub Pages cannot host the backend.

Planned preview archive: `Z:\PolyPodPro\release\poly-pod-pro-preview.zip`.

See [release checks](docs/RELEASE-CHECKLIST.md), [launch decisions and remaining work](docs/LAUNCH-PLAN.md), [frontend details](printmatch/README.md), and [backend setup and evidence limits](docs/BACKEND-SETUP.md). No architecture or contract can guarantee zero operating costs or zero liability.


The latest [platform research](docs/PLATFORM-RESEARCH.md) records comparable marketplace models, implemented improvements, and prioritized follow-up work.

The [Meshy creation studio](docs/MESHY-PORTAL.md) adds buyer-account generation links, preparation and slicer guides, imported STL review, and a sample farm estimate loop. Persistent private sharing has prepared gated backend source and still requires staging setup.
