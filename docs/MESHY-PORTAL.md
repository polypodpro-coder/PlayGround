# Meshy portal and farm review — September 7, 2026

The buyer creates in their own Meshy account and pays Meshy directly for any plan or credit use. Poly Pod Pro supplies a tool portal, reviews an exported STL, and supports explicit selected-farm requests for nonbinding estimates. An associate link does not fund generation or authenticate a buyer. Generation can happen on Meshy's website (import the STL back) or, optionally, natively in the Creation Studio using the buyer's own API key (Bring Your Own Key) — see "Optional native generation" below.

## Available workflow

1. Open `/#/create` from Discover, the photo request helper, or the footer.
2. Use [Meshy Workspace](https://www.meshy.ai/workspace), or sign up through the supplied [PolyPodPro associate link](https://www.meshy.ai/?via=PolyPodPro). The adjacent disclosure says we may earn Meshy credits. The referral URL is preserved with HTTPS; actual attribution/credit awards have not been tested.
3. Create from an image or prompt. Use the linked converter, reducer, or repair tool as needed, then download an STL. External tools do not automatically upload to or synchronize with this app.
4. Import one STL up to 10 MB and 150,000 triangles. Inspect actual geometry, select source units (mm/cm/in), confirm the current dimensions and permission to use/share the model. Changing units clears size confirmation.
5. Save, select a farm, and add a brief. The static preview stores up to five files in tab memory and marks requests as sample activity. Choose Riverside Rapid Prints to inspect that tab's sample farm inbox. Reloading the page clears files, requests and estimates.
6. The farm views the actual shared model and gives a whole-job production amount, fulfillment amount, lead time and scope. The buyer sees the separate nonbinding estimate. No checkout, manufacturing, seller message or payment follows automatically.
7. The buyer can revoke future access. Revocation cannot erase files someone already downloaded. Preparing a print request is an optional separate handoff into existing sample pricing; it preserves the file and source-unit provenance.

STL represents geometry without textures, colors or animation, and has no unit metadata. Farm review must establish dimensions, intended use, fit, repair needs, strength, supports and appropriate material/machine settings. The viewer and Meshy output do not guarantee manufacturability.

## Research and adopted tools

All links below are official Meshy resources reviewed for this implementation. Tool availability, plans and credits should be checked in the buyer's Meshy account; the app does not hardcode pricing promises.

| Tool | How it helps |
| --- | --- |
| [Image to 3D](https://www.meshy.ai/features/image-to-3d) | Photo/sketch geometry; [multi-view guidance](https://www.meshy.ai/tutorials/multi-view-image-to-3d) covers views of one object. |
| [Text to 3D](https://www.meshy.ai/features/text-to-3d) | Prompt-based concept creation; still requires dimensional and farm review. |
| [File converter](https://www.meshy.ai/3d-tools/file-converter) | Supported model formats to STL. Meshy describes single-file use as local browser processing without login. |
| [Polygon reducer](https://www.meshy.ai/3d-tools/polygon-reducer) | Reduces heavy meshes for bounded import; reduction can change detail. Separate from the credit-consuming server Remesh feature. |
| [STL repair](https://www.meshy.ai/3d-tools/stl-repair) | Model analysis and optional repair; check charges in the buyer's account. [Help](https://help.meshy.ai/en/articles/15813389-how-to-check-and-fix-your-model-s-printability) distinguishes mesh analysis from wall thickness, overhang and scale review. |

The [integration catalog](https://www.meshy.ai/integrations) lists 18 creative-tool connections: eight printing tools, five modeling tools, one simulation platform and four game tools. We expose all eight printing guides: [Bambu Studio](https://www.meshy.ai/integrations/bambu-studio), [OrcaSlicer](https://www.meshy.ai/integrations/orcaslicer), [Cura](https://www.meshy.ai/integrations/cura), [Creality Print](https://www.meshy.ai/integrations/creality-print), [Elegoo Slicer](https://www.meshy.ai/integrations/elegoo-slicer), [Lychee Slicer](https://www.meshy.ai/integrations/lychee-slicer), [Flash Studio](https://www.meshy.ai/integrations/flash-studio), and [Snapmaker Orca](https://www.meshy.ai/integrations/snapmaker-orca). Their guides launch an installed slicer from Meshy's Print menu and require a qualifying plan. This is a local software handoff, not remote farm dispatch.

[Blender](https://www.meshy.ai/integrations/blender) is linked for advanced preparation: cleanup, thickness/overhang checks, orientation, scale and STL export, subject to current plugin/version/plan requirements. The remaining catalog entries are ZBrush, 3ds Max, Maya, ComfyUI, Omniverse/Isaac Sim, Unity, Unreal Engine, Godot and Roblox Studio. The full directory remains accessible rather than adding unrelated game and animation controls to the buyer flow.

Meshy also offers [MCP](https://www.meshy.ai/mcp), [CLI](https://www.meshy.ai/cli), [agent Skills](https://github.com/meshy-dev/meshy-3d-agent), and a [REST API](https://docs.meshy.ai/en/api). The installed CLI now documents browser OAuth and device-code login. Public API/MCP paths use credentials. We found no documented third-party web-client registration or embeddable portal contract. No CLI/plugin/agent server was installed or invoked, and no account keys are collected. These developer tools are not a substitute for buyer-owned website billing.

Meshy's [export restrictions](https://help.meshy.ai/en/articles/10421033-why-can-t-i-download-my-model) depend on account/model/plan. Its [public sharing guide](https://help.meshy.ai/en/articles/11854507-how-to-share-model-url) requires Community publication and a paid recipient plan for download; this app therefore uses an explicitly imported file and selected-farm access instead of requiring publication. Buyers must review current [terms](https://www.meshy.ai/terms-of-use), input rights and privacy before uploading to Meshy. No categorical licensing guarantee is made.

## Prepared connected service

Poly Pod Pro stores no Meshy API key server-side and never pays for credits. Generation is available two ways: (a) the classic portal — create on Meshy's website and import the STL; and (b) optional **native Bring-Your-Own-Key (BYOK)** generation in the Creation Studio, described below. There is still no platform-funded generation or mock/simulated result.

## Optional native generation (Bring Your Own Key)

The Creation Studio can generate a printable STL from a text prompt or a local image without leaving `#/create`. It is strictly buyer-owned and off by default until the user supplies their own credentials.

- **Credentials stay in the browser.** The user enters their own Meshy API key and a proxy URL in a settings panel; both are saved only in `localStorage` (`ppp.meshy.apiKey`, `ppp.meshy.proxyUrl`). They are never sent to Poly Pod Pro and never embedded in the static build.
- **A user-deployed proxy is required.** Browsers cannot call `api.meshy.ai` directly (CORS), and the key must not sit in a static site, so requests go through `serverless-proxy.js` (a Cloudflare Worker the user deploys). The proxy reads the `X-User-Meshy-Key` header and forwards it to Meshy as `Authorization: Bearer <key>`, so Meshy bills the user's account. It allow-lists only the text-to-3d and image-to-3d endpoints and restricts result downloads to Meshy hosts; set its `ALLOWED_ORIGIN` env var to the site origin.
- **Local image handling.** For Image-to-3D, the reference image is read in the browser and converted to a Base64 data URI, passed as `image_url` — no external image hosting needed. Images are capped (PNG/JPG/WebP, 8 MB).
- **Workflow.** Text-to-3D `POST /openapi/v2/text-to-3d` (`{ mode:"preview", prompt, art_style:"realistic", target_formats:["stl"] }`); Image-to-3D `POST /openapi/v1/image-to-3d` (`{ image_url, target_formats:["stl"] }`). The frontend polls `GET .../{task_id}` every few seconds, showing a progress bar, until `SUCCEEDED`.
- **Handoff.** On success the STL from `model_urls.stl` is downloaded through the proxy and loaded into the existing viewer as a normal imported file, so the same unit confirmation, bounding-box/dimension review, save, and farm-quote steps apply. A generated mesh is not printable or quoted until the user confirms units and a farm reviews it.

The unused legacy simulated Meshy service was previously replaced with a portal configuration export; BYOK generation adds a real, user-funded path on top of that portal.

- Static default: `VITE_API_ENABLED=false`; no creation API calls, uploads or persistent storage.
- Connected deployment: existing hosted identity/session/database setup, `server/creations.sql` after `server/schema.sql` (apply both with `node server/migrate.mjs --with-creations`), same-origin API routing, and `CREATION_SHARING_ENABLED=true`. Build with `VITE_API_ENABLED=true` only on that host. Missing identity or schema keeps writes closed. Server startup does not run migrations.
- Session and verified active account checks protect all private routes. Mutations require matching Origin and CSRF token. Identity comes from the server session, never client role or farm identifiers alone.
- Strict base64 and complete ASCII/binary STL validation, finite bounded coordinates, SHA-256 integrity, immutable model bytes/source units, private PostgreSQL bytea storage. Upload JSON is bounded at 14 MB for the 10 MB STL envelope.
- Five imports per UTC day and 100 total models per buyer, enforced under one user transaction lock. Up to ten active farm shares per creation; only approved US farms may receive/access them.
- Buyers can view their own shares; farm membership and active sharing govern model/inbox access. A farm does not receive other farms' offers. Revoke and authorized reads remain available with new writes disabled.
- Revision checks reject an estimate from an outdated brief or revoked/regranted request. Amounts use integer cents; these records never enter payable quote/order tables.
- API responses prohibit caching; model downloads recheck access and stored integrity. Frontend download reads enforce a 10 MB bound.

Prepared routes: public `GET /api/creation-status`; authenticated `GET/POST /api/creations`, `GET /api/creations/:id`, `GET /api/creations/:id/model`, `POST /api/creations/:id/shares`, `GET /api/creation-farms`, `GET /api/creation-inbox`, `POST /api/creation-shares/:id/quote`, and `DELETE /api/creation-shares/:id`.

The provider dependency installation remains declined. No migration, actual PostgreSQL concurrency, hosted authentication, live upload, Meshy payment or referral credit award was exercised. Native HTTP/service tests use doubles. Before connected launch: provision approved services, verify database isolation/races with real sessions, set backup/retention/deletion processes, budget storage, add operational limits and pagination for large farm inboxes, and run staging authorization/outage tests. Private sharing readiness does not enable paid orders.
