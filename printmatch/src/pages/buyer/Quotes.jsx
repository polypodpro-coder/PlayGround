import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, Clock, File, MapPin, SlidersHorizontal } from "lucide-react";
import { fulfillmentLabel } from "../../lib/fulfillment";
import ShopLogo from "../../components/ShopLogo";
import { useApp } from "../../context/AppContext";
import { FLEET_MACHINES, POST_PROCESSING_ADDONS } from "../../data/mockData";

export default function Quotes() {
  const navigate = useNavigate();
  const { quotes, acceptQuote, printers, request } = useApp();
  const [sort, setSort] = useState("price");
  const available = useMemo(() => quotes.filter((quote) => {
    const farm = printers.find((p) => p.id === quote.printerId);
    return farm && !farm.shopPaused && farm.status !== "offline" && farm.materials.includes(request?.material);
  }).sort((a, b) => sort === "time" ? a.etaHours - b.etaHours : a.comparisonTotalCents - b.comparisonTotalCents), [quotes, printers, sort, request]);
  const machine = FLEET_MACHINES.find((m) => m.id === request?.selectedMachineId);
  const addons = (request?.selectedAddons || []).map((id) => POST_PROCESSING_ADDONS.find((a) => a.id === id)).filter(Boolean);
  if (!request) return <div className="app-page"><div className="empty-state"><File size={36} /><h1 className="page-heading">Start with your part.</h1><p>Configure a request to compare example print-farm quotes.</p><button type="button" className="button" onClick={() => navigate("/request")}>Configure a request <ArrowRight size={17} /></button></div></div>;
  const lowest = available.length ? Math.min(...available.map((q) => q.comparisonTotalCents)) : null;
  return <div className="app-page">
    <button className="button-secondary mb-5" type="button" onClick={() => navigate("/request")}><ArrowLeft size={16} /> Edit request</button>
    <header className="page-intro"><div><p className="eyebrow">02 / Compare the options</p><h1 className="page-heading">Your part. Your farm.</h1><p className="body-copy">Compare example pricing and timing, with the details in one place.</p></div><span className="badge">Sample quotes</span></header>
    <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1.6fr)_minmax(260px,1fr)]">
      <section className="stack">
        <div className="flex flex-wrap items-end justify-between gap-4"><p className="text-sm text-navy/65">{available.length} example {available.length === 1 ? "option" : "options"}{request.directRequestPrinterId ? " from your selected farm" : " for your material"}</p><label className="flex items-center gap-2 text-sm"><SlidersHorizontal size={16} /><span className="sr-only">Sort quotes</span><select className="rounded-lg border border-navy/15 bg-white px-3 py-2" value={sort} onChange={(e) => setSort(e.target.value)}><option value="price">Lowest subtotal incl. fulfillment</option><option value="time">Shortest example lead time</option></select></label></div>
        {available.map((quote) => {
          const farm = printers.find((p) => p.id === quote.printerId);
          return <article key={quote.id} className="panel relative overflow-hidden">
            {quote.comparisonTotalCents === lowest && <div className="mb-5 inline-flex items-center gap-1.5 rounded-full bg-[#eaf5f0] px-3 py-1 text-xs font-semibold text-[#27664d]"><Check size={13} /> Lowest example subtotal</div>}
            <div className="flex flex-wrap items-start justify-between gap-5"><div className="flex items-center gap-3"><ShopLogo src={farm.logoUrl} alt="" /><div><h2 className="text-lg font-bold">{farm.name}</h2><p className="mt-1 flex items-center gap-1 text-xs text-navy/60"><MapPin size={12} /> Example US print farm</p></div></div><div><p className="text-3xl font-bold tracking-tight">{quote.fulfillmentPreference === "any" ? "From " : ""}${(quote.comparisonTotalCents / 100).toFixed(2)}</p><p className="mt-1 text-xs text-navy/55">{request.quantity || 1} {(request.quantity || 1) === 1 ? "piece" : "pieces"} · incl. fulfillment example</p></div></div>
            <div className="my-5 grid gap-3 rounded-xl bg-navy/[.035] p-4 sm:grid-cols-2"><div><p className="text-xs text-navy/55">Material & color</p><p className="mt-1 text-sm font-semibold">{quote.material} · {quote.color || "To be agreed"}</p></div><div><p className="text-xs text-navy/55">Example production time</p><p className="mt-1 flex items-center gap-1.5 text-sm font-semibold"><Clock size={14} /> {quote.etaHours < 24 ? `${quote.etaHours} hours` : `${Math.ceil(quote.etaHours / 24)} days`}</p></div></div>
            <div className="mb-5 text-sm leading-relaxed text-navy/65"><p>Fabrication ${quote.price.toFixed(2)} + {quote.fulfillmentPreference === "any" ? "your choice of fulfillment" : fulfillmentLabel(quote.fulfillmentPreference)}. Before tax and optional tip.</p><ul className="mt-2 flex flex-wrap gap-2" aria-label="Example fulfillment charges">{quote.fulfillmentOptions.filter(option => quote.fulfillmentPreference === "any" || option.id === quote.fulfillmentPreference).map(option => <li className="badge" key={option.id}>{option.label} · ${(option.feeCents / 100).toFixed(2)} / order</li>)}</ul><p className="mt-2 text-xs">Production time excludes transit and any pickup or drop-off arrangements.</p></div><div className="flex flex-wrap items-center justify-between gap-4"><button type="button" className="text-sm font-semibold text-navy underline underline-offset-4" onClick={() => navigate(`/shop/${farm.id}`)}>Explore example farm</button><button type="button" className="button" onClick={() => { acceptQuote(quote); navigate("/checkout"); }}>Review sample order <ArrowRight size={16} /></button></div>
          </article>;
        })}
        {!available.length && <div className="empty-state"><SlidersHorizontal size={34} /><h2 className="section-heading">No example farms match yet.</h2><p>Check the material, model size, and fulfillment method, or choose a different example farm. For STL files, confirm the source units before changing the size.</p><button type="button" className="button-secondary" onClick={() => navigate("/request")}>Adjust the request</button></div>}
      </section>
      <aside className="stack lg:sticky lg:top-24"><section className="panel"><p className="eyebrow">Request summary</p><h2 className="mb-5 mt-2 break-words text-xl font-bold">{request.fileName}</h2><dl className="space-y-4 text-sm"><div><dt className="text-navy/55">Material / quantity</dt><dd className="mt-1 font-semibold">{request.material} / {request.quantity || 1} {(request.quantity || 1) === 1 ? "piece" : "pieces"}</dd></div><div><dt className="text-navy/55">Preferred equipment</dt><dd className="mt-1 font-semibold">{machine?.name || "Farm recommendation"}</dd></div><div><dt className="text-navy/55">Finishing</dt><dd className="mt-1 font-semibold">{addons.length ? addons.map((a) => a.name).join(", ") : "No add-ons selected"}</dd></div>{request.dimensions && <div><dt className="text-navy/55">Model dimensions (mm)</dt><dd className="mt-1 font-semibold">{[request.dimensions.x,request.dimensions.y,request.dimensions.z].map(value=>Number(value).toFixed(1)).join(" × ")}</dd><p className="mt-2 text-xs text-navy/60">Farms with smaller listed build areas are excluded. Space for supports and printability still need farm review.</p></div>}<div><dt className="text-navy/55">Fulfillment preference</dt><dd className="mt-1 font-semibold">{!request.fulfillmentPreference || request.fulfillmentPreference === "any" ? "Compare all offered methods" : fulfillmentLabel(request.fulfillmentPreference)}</dd></div><div><dt className="text-navy/55">Weight assumption</dt><dd className="mt-1 font-semibold">{request.estimatedGrams} g per piece</dd></div>{request.neededBy && <div><dt className="text-navy/55">Target date</dt><dd className="mt-1 font-semibold">{request.neededBy}</dd></div>}</dl><button type="button" className="button-secondary mt-6 w-full" onClick={() => navigate("/request")}>Edit specifications</button></section>
        <div className="rounded-2xl bg-navy p-6 text-white"><h3 className="mb-3 text-lg font-semibold">What a real quote will include</h3><ul className="space-y-3 text-sm leading-relaxed text-white/70"><li>Seller identity and an approved file revision.</li><li>Agreed material, finish, tolerances, quantity, and delivery.</li><li>Shipping, applicable taxes, refund terms, and the complete price before payment.</li></ul><p className="mt-5 border-t border-white/15 pt-4 text-xs leading-relaxed text-white/60">These examples are calculated locally. No farm has reviewed this request; prices and lead times are not offers.</p></div>
      </aside>
    </div>
  </div>;
}





