# Poly Pod Pro frontend

The canonical React/Vite application for the Poly Pod Pro overhaul. The current release is a **public sample preview** for buyers and independent US print farms, with responsive desktop and mobile layouts.

## Run and verify

Use Node 22.12 or newer and pnpm from this directory:

```text
pnpm install --frozen-lockfile --ignore-scripts
pnpm dev
pnpm lint
pnpm test
pnpm build
pnpm preview --host 127.0.0.1
```

The development server binds to `127.0.0.1`. The preview server serves the production build. Keep `VITE_API_ENABLED=false`, as shown in `.env.example`; no environment file is required for the static sample. `VITE_ENABLE_DEMO` is no longer used.

## Features and boundaries

| Experience | Available in this release |
| --- | --- |
| Buyer discovery | Sample farms, material/fulfillment filters, favorites, farm profiles, concept designs, and selectable local service-radius maps |
| Part configuration | Material, machine preference, finishing, intended use, quantity, and sample pricing assumptions |
| 3D workspace | Local STL inspection, source units (mm/cm/in), bounded rendering, procedural samples, and normalized mm STL export |
| CAD/photos | Local references; Meshy portal for external buyer-account generation and model preparation |
| Quote to order | Build-envelope and fulfillment matching; example subtotals including farm fulfillment charges; sample checkout, local orders, and progress |
| Communication | Sample conversations and local drafts; no messages sent |
| Creation studio | Buyer-owned Meshy portal, associate link, external preparation tools/slicer guides, actual STL library, selected-farm requests and nonbinding estimates in tab preview |
| Farm workspace | Dashboard, request filtering, revisioned quote drafts saved across navigation, illustrative gross sales, and sample settings |
| Account | Sample personas; provider readiness and optional hosted sign-in integration code |

Files are read locally in this preview. The optional private STL service is prepared in source but remains disabled and has not been connected to a real database. Sample orders do not collect money, reserve capacity, or start production. Public preview data and roles are not authentication or authorization. Saved farm quote drafts survive navigation in this tab; unsaved field edits, message drafts, and fleet statuses are page-local. All sample activity and settings reset on refresh. Farms explicitly enable pickup, local drop-off, and shipping with sample per-order fees. Changes to accepted fulfillment terms require a fresh quote selection.

STL files contain no unit metadata: choose the source units and verify physical dimensions. Exports use millimeter coordinates. Build-envelope screening permits axis rotation but does not validate supports, strength, printability, or equipment availability. Map circles show example straight-line service radii, not driving routes or confirmed pickup/drop-off eligibility; arrangements, fees, and timing require farm confirmation.

The account page can query a prepared same-origin API only when explicitly built with `VITE_API_ENABLED=true`. That is not a live-commerce switch. Backend provider dependencies were not installed after the installation was declined. No provider account or integration has been verified. See [backend setup](../docs/BACKEND-SETUP.md).

## Structure

- `src/pages/buyer/`: marketplace, request, quotes, sample checkout, orders, and account.
- `src/pages/owner/`: farm dashboard, requests, quote drafts, earnings, and settings.
- `src/components/`: shared UI, maps, and 3D viewing.
- `src/context/`: temporary sample workflow state and saved farm quote drafts.
- `src/data/mockData.js`: example farms, parts, orders, and metrics.
- `src/services/platformApi.js`: optional same-origin account API adapter.
- `server/`: prepared backend source; separate dependencies and setup.
- `tests/`: local automated checks, including server behavior with test doubles.

## Static publication

`pnpm build` writes `dist/`. Publish **the contents of that directory only**, with `VITE_API_ENABLED=false`. The app uses `HashRouter` and relative assets, so a GitHub Pages directory can serve routes such as `index.html#/owner` without server rewrites. Open the built site through HTTP for review.

Do not publish the repository root, old root HTML, server source, environment files, or dependencies. GitHub Pages is suitable for this static preview only. A real account service needs a separate HTTPS host with same-origin API/auth routing.

Follow [the release checklist](../docs/RELEASE-CHECKLIST.md) before publication. The planned archive is `Z:\PolyPodPro\release\poly-pod-pro-preview.zip`. A passing build or local test suite does not establish provider, database, security, tax, or operational readiness for paid orders.


See [platform research and selected improvements](../docs/PLATFORM-RESEARCH.md) for the sources and product decisions behind fulfillment matching and quote comparison.

See [Meshy portal workflow, integration research and connected-service gates](../docs/MESHY-PORTAL.md). Buyer generation stays on Meshy; sample creation sharing resets on refresh.

