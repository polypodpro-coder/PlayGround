# Platform research and selected improvements

Reviewed September 7, 2026. Goal: a US marketplace where independent print farms sell to buyers, with useful local coverage, clear costs, and provider-hosted accounts/payments. Sources below are official platform documentation. Adaptations are our product judgments, not claims that another platform's policies apply to Poly Pod Pro.

| Platform model | What the source shows | Benefit for Poly Pod Pro |
| --- | --- | --- |
| [Treatstock: independent manufacturing services](https://www.treatstock.com/help/article/214-how-do-i-add-a-3d-printer) | Providers configure equipment, stocked materials/colors, minimum order charges, and pickup/shipping options. Its onboarding includes a quality test. | Explicit farm capabilities and fulfillment options; later, an evidence-based farm onboarding process. A radius alone must not imply that pickup or delivery is offered. |
| [Craftcloud: manufacturing quote comparison](https://craftcloud3d.com/) | Buyers configure parts and compare supplier quotes. Craftcloud describes itself as the contractual partner. | Use the clear comparison pattern. Our independent-seller model remains the selected business direction; adopting the comparison interface does not mean adopting Craftcloud's contractual role or guarantees. |
| [Xometry: configurable manufacturing quotes](https://www.xometry.com/how-xometry-works/) | Its quote workflow exposes process, material, finish, quantity, configuration notes, and design-for-manufacturing feedback. | Keep a structured brief and a farm review step. Our existing geometry limits/build-envelope checks are only preliminary screening; they do not provide Xometry-style automated manufacturability analysis. |
| [Sharetribe: seller-controlled delivery](https://www.sharetribe.com/help/en/articles/8912056-how-shipping-delivery-works) | Sellers choose shipping, pickup, or both and set shipping charges; buyers supply shipping addresses during checkout. | Capture fulfillment preference before comparing quotes and show per-order example charges. Collect addresses only when the real authorized transaction needs them. |
| [Sharetribe: marketplace commissions](https://www.sharetribe.com/help/en/articles/8413880-how-to-set-your-marketplace-commission-rates) | A marketplace can allocate commissions to sellers, buyers, or both. Zero commission still leaves processing costs. | Keep fee allocation explicit. Retain the proposed seller-paid processing direction and no approved marketplace commission; do not promise zero platform operating costs. |
| [Airbnb: contact disclosure after confirmation](https://www.airbnb.com/help/article/4116) | Confirmed guests receive contact information, the full address, and arrival instructions. | A future pickup workflow can disclose private meeting details only to authorized order participants. Public farm coverage should remain separate from private home or pickup addresses. |

## Selected implementation in this pass

1. **Farm-controlled fulfillment.** Sample farms explicitly offer pickup, local drop-off, and/or US shipping, with their own illustrative charge per order. Farm settings can save or disable each method. An unconfigured method is unavailable, rather than assumed free or supported.
2. **Earlier buyer choice.** Discovery filters by offered method; cards, profiles, and map details show methods and charges. The request records a fulfillment preference, and quote matching respects it.
3. **Comparable costs.** Quote sorting and the visible example subtotal include fabrication plus fulfillment. “From” applies when comparing all methods. Tax and optional tips are excluded and labeled; production time is separate from transit or handoff timing.
4. **Consistent accepted terms.** Quote snapshots include fulfillment methods, charges, and the service area. Changing those terms invalidates an older selection. Sample checkout uses the selected farm's options, and order totals are computed from the current accepted quote. Local drop-off gets its own order label and fee.

These are preview behaviors. Drop-off eligibility is not calculated from the map, and no home address, carrier booking, seller contact, payment, or real manufacturing request is collected or sent. All sample settings and orders reset on refresh. No new provider dependencies or paid services are added.

## Keep for later, in priority order

- **Farm onboarding with evidence:** verified seller identity through the provider, equipment/material declarations, sample print review, and documented handling of failed checks. Only show trust badges backed by actual evidence.
- **Pre-production approval:** a private file revision, agreed dimensions/material/finish, seller review, and buyer acceptance before a paid order is eligible for production. Store this durably with authorization and audit records.
- **Private fulfillment instructions:** restrict addresses and meeting details to authorized participants; agree timing and record handoff or shipment evidence. Build support and dispute handling alongside it.
- **Repeat orders:** reuse an approved specification, then request fresh availability and pricing. Reordering must not silently reuse an expired price or changed file.
- **Seller proceeds reporting:** distinguish gross sales, agreed charges, processor costs, refunds, and reconciled net proceeds. Actual provider records and an approved fee policy are prerequisites.

Provider setup, secure storage, account integration, and operational policies remain the launch prerequisites in [the launch plan](LAUNCH-PLAN.md). This research does not change the independent-seller decision, approve commissions, or authorize publication or live payment enablement.
