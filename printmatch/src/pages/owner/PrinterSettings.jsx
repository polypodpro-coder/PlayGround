import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ImagePlus, MapPin, Pause, Play, Printer, RotateCcw, Upload, X } from "lucide-react";
import ShopLogo from "../../components/ShopLogo";
import ServiceAreaMap from "../../components/ServiceAreaMap";
import { ownerPrinters as initialPrinters } from "../../data/mockData";
import { useApp } from "../../context/AppContext";
import { FULFILLMENT_METHODS, getFulfillmentOptions } from "../../lib/fulfillment";

const SAMPLE_CITIES = [
  { name: "Springfield, IL", location: [39.786, -89.644] },
  { name: "Chicago, IL", location: [41.8781, -87.6298] },
  { name: "Austin, TX", location: [30.2672, -97.7431] },
  { name: "Denver, CO", location: [39.7392, -104.9903] },
];
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function fulfillmentDraftFromFarm(farm) {
  return Object.fromEntries(FULFILLMENT_METHODS.map(({ id }) => {
    const option = farm.fulfillmentOptions?.[id];
    const cents = Number.isSafeInteger(option?.feeCents) && option.feeCents >= 0 && option.feeCents <= 100000 ? option.feeCents : 0;
    return [id, { enabled: option?.enabled === true, fee: (cents / 100).toFixed(2) }];
  }));
}

function SampleFulfillmentSettings({ farm, updateFarm }) {
  const [draft, setDraft] = useState(() => fulfillmentDraftFromFarm(farm));
  const [error, setError] = useState("");
  const [savedMessage, setSavedMessage] = useState("");
  const savedValues = fulfillmentDraftFromFarm(farm);
  const dirty = FULFILLMENT_METHODS.some(({ id }) => draft[id].enabled !== savedValues[id].enabled || draft[id].fee !== savedValues[id].fee);
  const enabledCount = FULFILLMENT_METHODS.filter(({ id }) => draft[id].enabled).length;
  const savedCount = getFulfillmentOptions(farm).length;

  const updateDraft = (id, patch) => {
    setDraft((previous) => ({ ...previous, [id]: { ...previous[id], ...patch } }));
    setError("");
    setSavedMessage("");
  };
  const restoreSaved = () => {
    setDraft(fulfillmentDraftFromFarm(farm));
    setError("");
    setSavedMessage("Saved sample fulfillment choices restored.");
  };
  const save = (event) => {
    event.preventDefault();
    const options = {};
    for (const { id, label } of FULFILLMENT_METHODS) {
      const raw = draft[id].fee.trim();
      if (!/^\d+(?:\.\d{1,2})?$/.test(raw)) {
        setError(`${label}: enter a fee with at most two decimal places, such as 0.00 or 5.25.`);
        setSavedMessage("");
        return;
      }
      const [whole, fraction = ""] = raw.split(".");
      const feeCents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
      if (!Number.isSafeInteger(feeCents) || feeCents < 0 || feeCents > 100000) {
        setError(`${label}: the sample fee must be between $0.00 and $1,000.00.`);
        setSavedMessage("");
        return;
      }
      options[id] = { enabled: draft[id].enabled, feeCents };
    }
    updateFarm({ fulfillmentOptions: options });
    setDraft(fulfillmentDraftFromFarm({ fulfillmentOptions: options }));
    setError("");
    setSavedMessage(enabledCount ? "Sample fulfillment saved for this browser session. Buyers will see these choices and example fees." : "Sample fulfillment saved with all methods disabled. This farm will not appear in sample quotes.");
  };

  return (
    <form onSubmit={save} className="panel stack" noValidate>
      <div className="section-heading"><h2>Sample pickup, drop-off &amp; shipping</h2><p className="mt-2 text-sm leading-6 text-navy/60">Choose which methods your sample farm offers and set the buyer-facing fee per order.</p></div>
      <div className="flex flex-wrap items-center gap-3"><span className="badge">{dirty ? "Unsaved choices" : "Saved sample terms"}</span><span className="text-sm text-navy/60">{savedCount} saved {savedCount === 1 ? "method" : "methods"} enabled</span></div>
      <div className="space-y-4">
        {FULFILLMENT_METHODS.map(({ id, label, detail }) => (
          <fieldset key={id} className="rounded-xl border border-navy/10 p-4">
            <label className="flex items-center gap-3 text-sm font-semibold text-navy"><input type="checkbox" checked={draft[id].enabled} onChange={(event) => updateDraft(id, { enabled: event.target.checked })} className="h-4 w-4 shrink-0 accent-accent" /><span>Offer {label}</span></label>
            <p className="mt-2 text-sm leading-6 text-navy/65">{detail}</p>
            <label htmlFor={`fulfillment-fee-${id}`} className="mt-4 block text-sm font-medium text-navy">{label} sample fee (USD)</label>
            <input id={`fulfillment-fee-${id}`} type="text" inputMode="decimal" maxLength={12} autoComplete="off" value={draft[id].fee} onChange={(event) => updateDraft(id, { fee: event.target.value })} aria-invalid={!!error && error.startsWith(label + ":")} aria-describedby={error && error.startsWith(label + ":") ? "fulfillment-save-error" : undefined} className="field mt-2 w-full" placeholder="0.00" />
            <p className="mt-2 text-sm text-navy/60">{draft[id].enabled ? dirty ? "Selected in this form. Save to apply changes." : "Offered in this sample farm's saved terms." : "Not offered when saved disabled. The fee is retained for later use."}</p>
          </fieldset>
        ))}
      </div>
      {enabledCount === 0 && <p role="status" className="rounded-xl bg-orange-50 p-4 text-sm leading-6 text-navy/75">No methods are selected. Saving all methods disabled removes this farm from sample quotes until a method is enabled again.</p>}
      {error && <p id="fulfillment-save-error" role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
      {savedMessage && <p role="status" className="rounded-xl bg-navy/5 p-4 text-sm leading-6 text-navy/75">{savedMessage}</p>}
      <div className="flex flex-wrap gap-3"><button type="submit" disabled={!dirty} className="button">Save sample fulfillment</button>{dirty && <button type="button" onClick={restoreSaved} className="button button-secondary"><RotateCcw size={16} /> Restore saved choices</button>}</div>
      <p className="text-sm leading-6 text-navy/65">Saved choices apply as you move through this preview and reset on refresh. The farm must confirm actual availability, the meeting or delivery address, timing, and final fees before a real order. No addresses are collected here.</p>
    </form>
  );
}

export default function PrinterSettings() {
  const { myShop, updateMyShop } = useApp();
  const [printers, setPrinters] = useState(initialPrinters);
  const [showMap, setShowMap] = useState(false);
  const [notice, setNotice] = useState("");
  const [uploadError, setUploadError] = useState("");
  const logoInput = useRef(null);
  const portfolioInput = useRef(null);

  const readImage = (event, kind) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    setUploadError("");
    if (!file) return;
    if (!IMAGE_TYPES.has(file.type) || file.size > 2 * 1024 * 1024) {
      setUploadError("Choose a PNG, JPEG, or WebP image no larger than 2 MB.");
      return;
    }
    if (kind === "portfolio" && (myShop.portfolio?.length ?? 0) >= 6) {
      setUploadError("This preview supports up to six portfolio images. Remove one before adding another.");
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => setUploadError("This image could not be opened. Try another file.");
    reader.onload = () => {
      if (kind === "logo") updateMyShop({ logoUrl: reader.result });
      else updateMyShop({ portfolio: [...(myShop.portfolio ?? []), { id: `sample-photo-${crypto.randomUUID()}`, imageUrl: reader.result, caption: file.name.slice(0, 90) }] });
      setNotice("Sample image added to this preview. It has not been uploaded.");
    };
    reader.readAsDataURL(file);
  };

  const updateRate = (material, value) => {
    const rate = Number(value);
    if (!Number.isFinite(rate) || rate < 0 || rate > 1000) return;
    updateMyShop({ pricingRates: { ...myShop.pricingRates, [material]: rate } });
  };

  return (
    <div className="app-page stack">
      <header><p className="eyebrow">PRINT FARM / SETTINGS</p><h1 className="page-heading">Make room for your best work.</h1><p>Explore your farm profile, service area, material rates, and fleet controls.</p></header>
      <div className="rounded-xl border border-orange-200 bg-orange-50 px-5 py-4 text-sm leading-6 text-navy/75"><strong>Preview settings.</strong> Farm edits apply to this browser tab and reset on refresh. Device status changes reset when you leave this page. Use sample information.</div>
      {notice && <div role="status" className="flex items-center justify-between gap-4 rounded-xl bg-emerald-50 px-5 py-4 text-sm text-emerald-900"><p>{notice}</p><button type="button" onClick={() => setNotice("")} aria-label="Dismiss notification" className="rounded-lg p-2"><X size={18} /></button></div>}
      {uploadError && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{uploadError}</p>}
      <div className="grid items-start gap-6 xl:grid-cols-[1.1fr_1fr]">
        <div className="stack">
          <section className="panel stack">
            <div className="section-heading"><h2>Your sample storefront</h2><p className="mt-2 text-sm text-navy/60">Help buyers understand your capabilities and style.</p></div>
            <div className="flex flex-wrap items-center gap-5">
              <ShopLogo src={myShop.logoUrl} alt="Sample farm logo" size="lg" />
              <div className="flex flex-wrap gap-2"><button type="button" className="button button-secondary" onClick={() => logoInput.current?.click()}><Upload size={17} /> Choose sample logo</button>{myShop.logoUrl && <button type="button" className="button button-secondary" onClick={() => updateMyShop({ logoUrl: null })}>Remove</button>}</div>
              <input ref={logoInput} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" aria-label="Choose a sample farm logo" onChange={(event) => readImage(event, "logo")} />
            </div>
            <div><label htmlFor="shop-name" className="block text-sm font-medium text-navy">Sample farm name</label><input id="shop-name" value={myShop.name} maxLength={70} onChange={(event) => updateMyShop({ name: event.target.value })} className="field mt-2 w-full" /></div>
            <div><label htmlFor="shop-bio" className="block text-sm font-medium text-navy">About the farm</label><textarea id="shop-bio" rows={4} maxLength={700} value={myShop.bio ?? ""} onChange={(event) => updateMyShop({ bio: event.target.value })} className="field mt-2 w-full resize-y" placeholder="Describe a sample setup, materials, and finishing options." /></div>
            <p className="text-sm text-navy/60">Images stay in memory. PNG, JPEG, or WebP · 2 MB maximum.</p>
          </section>
          <section className="panel">
            <div className="section-heading flex flex-wrap items-center justify-between gap-3"><div><h2>Work worth showing</h2><p className="mt-2 text-sm text-navy/60">Sample portfolio · up to six images</p></div><button type="button" disabled={(myShop.portfolio?.length ?? 0) >= 6} className="button button-secondary" onClick={() => portfolioInput.current?.click()}><ImagePlus size={18} /> Add image</button></div>
            <input ref={portfolioInput} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" aria-label="Choose a sample portfolio image" onChange={(event) => readImage(event, "portfolio")} />
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {(myShop.portfolio ?? []).map((photo) => <figure key={photo.id} className="min-w-0"><div className="relative aspect-square overflow-hidden rounded-xl bg-navy/5"><img src={photo.imageUrl} alt={photo.caption} className="h-full w-full object-cover" /><button type="button" aria-label={`Remove ${photo.caption}`} onClick={() => updateMyShop({ portfolio: myShop.portfolio.filter((item) => item.id !== photo.id) })} className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-lg bg-navy/85 text-white"><X size={18} /></button></div><figcaption className="mt-2 break-words text-sm text-navy/65">{photo.caption}</figcaption></figure>)}
            </div>
            {(myShop.portfolio?.length ?? 0) === 0 && <p className="empty-state mt-5">Add a sample image to preview your portfolio.</p>}
          </section>
          <SampleFulfillmentSettings key={myShop.id} farm={myShop} updateFarm={updateMyShop} />
          <section className="panel stack">
            <div className="section-heading"><h2>Sample service area</h2><p className="mt-2 text-sm leading-6 text-navy/60">Try a US city and local delivery radius. This does not publish a real business address.</p></div>
            <div className="flex flex-wrap gap-2">{SAMPLE_CITIES.map((city) => <button type="button" key={city.name} className="chip" onClick={() => updateMyShop({ location: city.location })}><MapPin size={15} /> {city.name}</button>)}</div>
            <div><label htmlFor="service-radius" className="flex items-center justify-between gap-3 text-sm font-medium text-navy"><span>Local service radius</span><span>{myShop.serviceRadiusMi} miles</span></label><input id="service-radius" type="range" min="1" max="25" value={myShop.serviceRadiusMi} onChange={(event) => updateMyShop({ serviceRadiusMi: Number(event.target.value) })} className="mt-4 w-full accent-accent" /><div className="mt-1 flex justify-between text-sm text-navy/60"><span>1 mile</span><span>25 miles</span></div></div>
            <button type="button" className="button button-secondary" onClick={() => setShowMap((value) => !value)} aria-expanded={showMap}><MapPin size={18} /> {showMap ? "Hide service map" : "Open service map"}</button>
            {showMap && <ServiceAreaMap key={myShop.location.join(",")} center={myShop.location} radiusMi={myShop.serviceRadiusMi} onCenterChange={(location) => updateMyShop({ location })} />}
            <p className="text-sm leading-6 text-navy/60">Opening the map loads OpenStreetMap tiles. Use the sample pin to explore coverage.</p>
          </section>
        </div>
        <div className="stack">
          <section className="panel">
            <div className="section-heading"><h2>Material rates</h2><p className="mt-2 text-sm leading-6 text-navy/60">Sample material costs inform the quote helper. Include labor, waste, finishing, and processing costs when pricing a job.</p></div>
            <div className="mt-5 space-y-4">{myShop.materials.map((material) => <div key={material} className="flex items-center justify-between gap-4"><label htmlFor={`rate-${material}`} className="text-sm font-semibold text-navy">{material}</label><div className="flex items-center gap-2"><span className="text-sm text-navy/60">$</span><input id={`rate-${material}`} aria-label={`${material} dollars per gram`} type="number" min="0" max="1000" step="0.01" value={myShop.pricingRates?.[material] ?? 0} onChange={(event) => updateRate(material, event.target.value)} className="field text-right" style={{ width: "7rem" }} /><span className="text-sm text-navy/60">/ g</span></div></div>)}</div>
          </section>
          <section className="panel">
            <div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="text-xl font-semibold text-navy">Farm availability</h2><p className="mt-2 text-sm text-navy/60">{myShop.shopPaused ? "Sample shop is paused" : "Sample shop accepts requests"}</p></div><button type="button" className="button button-secondary" aria-pressed={myShop.shopPaused} onClick={() => updateMyShop({ shopPaused: !myShop.shopPaused, pausedUntil: null })}>{myShop.shopPaused ? <Play size={17} /> : <Pause size={17} />}{myShop.shopPaused ? "Resume preview" : "Pause preview"}</button></div>
            {myShop.shopPaused && <div className="mt-5"><label htmlFor="pause-until" className="block text-sm font-medium text-navy">Sample return date (optional)</label><input id="pause-until" type="date" min={new Date().toLocaleDateString("en-CA")} value={myShop.pausedUntil ?? ""} onChange={(event) => updateMyShop({ pausedUntil: event.target.value })} className="field mt-2 w-full" /></div>}
            <p className="mt-4 text-sm leading-6 text-navy/60">This changes the sample farm display only. It does not control a live queue.</p>
          </section>
          <section className="panel">
            <div className="section-heading flex flex-wrap items-center justify-between gap-3"><h2>Fleet controls</h2><button type="button" className="inline-flex items-center gap-2 text-sm font-semibold text-navy/65" onClick={() => setPrinters(initialPrinters)}><RotateCcw size={15} /> Reset sample</button></div>
            <p className="mt-3 text-sm leading-6 text-navy/60">Explore manual statuses. These controls are page-local and are not connected to any printer.</p>
            <div className="mt-5 divide-y divide-navy/10">{printers.map((printer) => <div key={printer.id} className="py-4 first:pt-0 last:pb-0"><div className="flex items-center gap-3"><Printer size={21} className="text-accent" /><div><h3 className="font-semibold text-navy">{printer.name}</h3><p className="mt-1 text-sm text-navy/60">{printer.materials.join(" · ")}</p></div></div><label htmlFor={`printer-status-${printer.id}`} className="sr-only">{printer.name} sample status</label><select id={`printer-status-${printer.id}`} value={printer.status} onChange={(event) => setPrinters((previous) => previous.map((item) => item.id === printer.id ? { ...item, status: event.target.value } : item))} className="field mt-3 w-full"><option value="available">Available</option><option value="printing">Printing</option><option value="offline">Offline</option></select></div>)}</div>
          </section>
          <section className="rounded-2xl bg-navy p-6 text-white"><span className="text-sm font-semibold text-orange-300">HOSTED SELLER SETUP</span><h2 className="mt-3 text-2xl font-semibold">Your real farm starts with your account.</h2><p className="mt-3 text-sm leading-6 text-white/75">Business identity, bank details, and seller verification will be handled through provider-hosted onboarding once connected.</p><Link to="/account" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-white">Check account readiness <ArrowRight size={16} /></Link></section>
        </div>
      </div>
    </div>
  );
}





