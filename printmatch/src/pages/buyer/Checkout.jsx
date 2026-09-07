import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, CreditCard, Package, Store, Truck } from "lucide-react";
import ShopLogo from "../../components/ShopLogo";
import { useApp } from "../../context/AppContext";
import { FLEET_MACHINES, POST_PROCESSING_ADDONS } from "../../data/mockData";

export default function Checkout() {
  const navigate = useNavigate();
  const { request, selectedQuote, placeOrder, printers } = useApp();
  const [delivery, setDelivery] = useState(() => selectedQuote?.fulfillmentPreference && selectedQuote.fulfillmentPreference !== "any" ? selectedQuote.fulfillmentPreference : [...(selectedQuote?.fulfillmentOptions || [])].sort((a,b) => a.feeCents - b.feeCents)[0]?.id || ""), [tipPercent, setTipPercent] = useState(0), [confirmed, setConfirmed] = useState(false), [error, setError] = useState("");
  const submitted = useRef(false);
  const farm = printers.find((p) => p.id === selectedQuote?.printerId);
  if (!request || !selectedQuote || !farm) return <div className="app-page"><div className="empty-state"><Package size={36} /><h1 className="page-heading">Choose an example quote first.</h1><p>Your sample order starts with a configured request and a selected farm.</p><button type="button" className="button" onClick={() => navigate(request ? "/quotes" : "/request")}>Continue your request <ArrowRight size={17} /></button></div></div>;
  const quote = selectedQuote;
  const machine = FLEET_MACHINES.find((m) => m.id === quote.machineId);
  const addons = (quote.addons || []).map((id) => POST_PROCESSING_ADDONS.find((a) => a.id === id)).filter(Boolean);
  const deliveryOptions = (quote.fulfillmentOptions || []).filter(option => quote.fulfillmentPreference === "any" || option.id === quote.fulfillmentPreference);
  const selectedDelivery = deliveryOptions.find(option => option.id === delivery);
  const shippingFee = (selectedDelivery?.feeCents ?? 0) / 100;
  const priceCents = Math.round(quote.price * 100), tipCents = Math.round(priceCents * tipPercent / 100);
  const totalCents = priceCents + (selectedDelivery?.feeCents ?? 0) + tipCents;
  function createSample(event) {
    event.preventDefault();
    if (submitted.current) return;
    if (!confirmed) { setError("Confirm that this is a sample order with no payment or production."); return; }
    submitted.current = true;
    try {
      const id = placeOrder({ deliveryMethod: delivery, tipPercent, shipAddress: null, machineId: machine?.id || null, addons: addons.map((a) => a.id), quantity: request.quantity || 1, fileName: request.fileName, paymentStatus: "not_collected", isDemo: true, taxStatus: "not_calculated" });
      if (!id) throw new Error("The sample order could not be created. Please select an example quote again.");
      navigate(`/orders/${id}`);
    } catch (err) { submitted.current = false; setError(err.message || "The sample order could not be created. Please try again."); }
  }
  return <div className="app-page">
    <button type="button" className="button-secondary mb-5" onClick={() => navigate("/quotes")}><ArrowLeft size={16} /> Back to quotes</button>
    <header className="page-intro"><div><p className="eyebrow">03 / Review your request</p><h1 className="page-heading">Every detail, up front.</h1><p className="body-copy">Try the order experience. No money changes hands and no job is sent.</p></div><span className="badge">Sample checkout</span></header>
    <form onSubmit={createSample} className="grid items-start gap-7 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,1fr)]">
      <div className="stack"><section className="panel"><div className="section-row"><h2 className="section-heading">Your example farm</h2><span className="badge">Independent seller</span></div><div className="flex items-center gap-4"><ShopLogo src={farm.logoUrl} alt="" /><div><h3 className="text-xl font-bold">{farm.name}</h3><p className="mt-1 text-sm text-navy/60">Illustrative farm profile · United States</p></div></div><div className="mt-6 rounded-xl bg-navy/[.035] p-5"><p className="break-words font-semibold">{request.fileName}</p><p className="mt-2 text-sm text-navy/60">{request.quantity || 1} {(request.quantity || 1) === 1 ? "piece" : "pieces"} · {quote.material} · {quote.color || "Color to be agreed"}</p><p className="mt-2 text-sm text-navy/60">Equipment preference: {machine?.name || "Farm recommendation"}</p>{addons.length > 0 && <p className="mt-2 text-sm text-navy/60">Included finishing: {addons.map((a) => a.name).join(", ")}</p>}</div></section>
        <section className="panel"><div className="section-row"><h2 className="section-heading">Receive your print</h2></div><p className="mb-4 text-sm text-navy/60">These are the methods this sample farm offers for your request. Charges apply per order.</p><div className="grid gap-3 sm:grid-cols-2">{deliveryOptions.map(({ id, label, detail, feeCents }) => { const Icon = id === "pickup" ? Store : id === "dropoff" ? Truck : Package; return <label key={id} className={`cursor-pointer rounded-xl border p-5 ${delivery === id ? "border-accent bg-accent/5" : "border-navy/15"}`}><div className="mb-4 flex items-center justify-between"><Icon size={24} className="text-accent" /><input type="radio" name="delivery" value={id} checked={delivery === id} onChange={() => {setDelivery(id);setError("");}} className="accent-orange-600" /></div><span className="block font-semibold">{label}</span><span className="mt-1 block text-xs text-navy/60">{detail}</span><span className="mt-4 block text-sm font-medium">${(feeCents / 100).toFixed(2)} example</span></label>; })}</div><p className="mt-4 text-sm leading-relaxed text-navy/60">{delivery === "ship" ? "Transit time is separate from production time. A real quote must confirm the carrier, delivery charge, and applicable tax before payment." : delivery === "dropoff" ? `This farm lists a ${quote.serviceArea?.radiusMi ?? "sample"}-mile example service radius. Address eligibility, timing, and handoff details still need farm confirmation.` : "Confirm the pickup window and meeting location with the farm before a real order."} No address or contact details are collected in this preview.</p>{!deliveryOptions.length && <p role="alert" className="notice mt-4">This quote has no available fulfillment methods. Return to quotes.</p>}</section>
        <section className="panel"><h2 className="mb-2 text-lg font-bold">Optional tip</h2><p className="mb-4 text-sm text-navy/60">Try an optional gratuity in the sample total. It starts at zero.</p><div className="flex flex-wrap gap-2">{[0, 10, 15, 20].map((percent) => <button type="button" key={percent} className={`chip ${tipPercent === percent ? "chip-active" : ""}`} aria-pressed={tipPercent === percent} onClick={() => setTipPercent(percent)}>{percent ? `${percent}%` : "No tip"}</button>)}</div></section>
        <div className="rounded-2xl bg-navy p-6 text-white"><CreditCard size={27} className="mb-4 text-orange-300" /><h2 className="mb-2 text-xl font-semibold">Payment stays with the provider.</h2><p className="text-sm leading-relaxed text-white/70">Live checkout is not connected. At launch, supported payments are planned to use Stripe-hosted checkout. Poly Pod Pro will not ask you to type card or bank details into this app.</p></div>
      </div>
      <aside className="panel lg:sticky lg:top-24"><p className="eyebrow">Order summary</p><h2 className="mb-6 mt-2 text-2xl font-bold">Simple, visible pricing.</h2><dl className="space-y-4 text-sm"><div className="flex justify-between gap-3"><dt className="text-navy/60">Fabrication, including add-ons</dt><dd className="font-semibold">${(priceCents / 100).toFixed(2)}</dd></div><div className="flex justify-between"><dt className="text-navy/60">{selectedDelivery?.label || "Fulfillment"} example</dt><dd className="font-semibold">${shippingFee.toFixed(2)}</dd></div><div className="flex justify-between"><dt className="text-navy/60">Optional tip</dt><dd className="font-semibold">${(tipCents / 100).toFixed(2)}</dd></div><div className="flex justify-between"><dt className="text-navy/60">Buyer platform fee</dt><dd className="font-semibold">$0.00</dd></div><div className="flex justify-between"><dt className="text-navy/60">Tax</dt><dd className="text-right text-navy/60">Not calculated in preview</dd></div><div className="flex items-baseline justify-between border-t border-navy/15 pt-5"><dt className="font-semibold">Sample subtotal</dt><dd className="text-3xl font-bold">${(totalCents / 100).toFixed(2)}</dd></div></dl><p className="mt-4 text-xs leading-relaxed text-navy/60">Not a payable total. Seller processing costs are planned to come from seller proceeds. A real checkout requires approved seller pricing, tax, delivery, and terms.</p>
        <label className="my-6 flex items-start gap-3 rounded-xl bg-navy/5 p-4 text-sm leading-relaxed"><input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} required className="mt-1 h-4 w-4 shrink-0 accent-orange-600" /><span>I understand this creates a sample order only. No payment is collected and nothing will be printed or shipped.</span></label>
        {error && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}<button type="submit" className="button w-full" disabled={!selectedDelivery}>Create sample order <ArrowRight size={17} /></button><p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-navy/55"><Check size={13} /> No card. No charge. No commitment.</p>
      </aside>
    </form>
  </div>;
}



