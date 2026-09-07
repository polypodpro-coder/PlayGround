import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Box, Calculator, Check, FileText, RotateCcw, Trash2 } from "lucide-react";
import { jobs } from "../../data/mockData";
import { useApp } from "../../context/AppContext";
import { useFarmQuotes } from "../../context/FarmQuoteContext";
import { farmQuoteFields, farmQuoteMatchesRequest, hasUnsavedFarmQuoteChanges } from "../../lib/farmQuoteDrafts";

const money = (value) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);

function QuoteWorkspace({ job }) {
  const { myShop } = useApp();
  const { drafts, saveDraft: saveQuoteDraft, clearDraft } = useFarmQuotes();
  const draft = drafts[job.id] ?? null;
  const [form, setForm] = useState(() => farmQuoteFields(draft, job));
  const { price, shipping, turnaround, notes, reviewed } = form;
  const [grams, setGrams] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const dirty = hasUnsavedFarmQuoteChanges(job, form, draft);
  const requestChanged = draft && !farmQuoteMatchesRequest(draft, job);
  const updateField = (field, value) => {
    setForm((previous) => ({ ...previous, [field]: value }));
    setError("");
    setNotice("");
  };
  const restoreSaved = () => {
    setForm(farmQuoteFields(draft, job));
    setError("");
    setNotice("Saved draft restored. Unsaved edits were discarded.");
  };
  const clearSaved = () => {
    clearDraft(job.id);
    setForm(farmQuoteFields());
    setError("");
    setNotice("Sample draft cleared. Nothing was sent or removed from a real account.");
  };
  const materialCost = useMemo(() => {
    const weight = Number(grams);
    const rate = myShop.pricingRates?.[job.material];
    return Number.isFinite(weight) && weight > 0 && Number.isFinite(rate) ? weight * job.quantity * rate : null;
  }, [grams, job, myShop.pricingRates]);

  const saveDraft = (event) => {
    event.preventDefault();
    try {
      saveQuoteDraft(job, form);
      setError("");
      setNotice("Sample draft saved for this browser session. No quote was sent.");
    } catch (failure) {
      setError(failure.message || "This sample draft could not be saved.");
      setNotice("");
    }
  };

  return (
    <div className="app-page stack">
      <Link to="/owner/requests" className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-navy/65"><ArrowLeft size={17} /> All requests</Link>
      <header>
        <p className="eyebrow">PRINT FARM / QUOTE WORKSPACE</p>
        <h1 className="page-heading">A clear quote. A confident start.</h1>
        <p>Explore the sample brief from {job.buyerName}. Saved drafts stay with you as you explore this preview and reset on refresh.</p>
      </header>
      <div className="grid items-start gap-6 xl:grid-cols-[1fr_1.1fr]">
        <div className="stack">
          <section className="panel">
            <div className="flex items-center gap-4"><div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-navy/5 text-accent"><Box size={28} /></div><div className="min-w-0"><span className="badge">Sample request</span><h2 className="mt-2 break-words text-xl font-semibold text-navy">{job.fileName}</h2></div></div>
            <p className="mt-4 text-sm text-navy/60">{job.fileType === "stl" ? "Example model specification" : "Example reference image"} · File not attached to this sample</p>
            <dl className="mt-6 grid grid-cols-2 gap-x-4 gap-y-5 text-sm">
              {[["Material", job.material], ["Color", job.color], ["Dimensions", `${job.dimensions.x} × ${job.dimensions.y} × ${job.dimensions.z} mm`], ["Quantity", `${job.quantity} ${job.quantity === 1 ? "part" : "parts"}`]].map(([label, value]) => <div key={label}><dt className="text-navy/60">{label}</dt><dd className="mt-1 font-semibold text-navy">{value}</dd></div>)}
            </dl>
          </section>
          <section className="panel"><div className="section-heading"><h2>The buyer's brief</h2></div><p className="mt-4 text-base leading-7 text-navy/75">{job.buyerNotes}</p><div className="mt-5 rounded-xl bg-navy/5 p-4 text-sm leading-6 text-navy/70">Initial catalog: decorative and non-safety-critical prototypes. Intended use, tolerances, and file suitability need seller review before a real quote is accepted.</div></section>
          <section className="panel">
            <div className="section-heading"><h2 className="flex items-center gap-2"><Calculator size={20} className="text-accent" /> Material cost helper</h2></div>
            <p className="mt-3 text-sm leading-6 text-navy/65">Use a slicer estimate for one part. This only calculates material from your sample rate; labor, waste, finishing, fees, and shipping are additional.</p>
            <label htmlFor="part-grams" className="mt-4 block text-sm font-medium text-navy">Estimated grams per part</label>
            <input id="part-grams" type="number" min="0.1" max="100000" step="0.1" value={grams} onChange={(event) => setGrams(event.target.value)} placeholder="For example, 45" className="field mt-2 w-full" />
            {materialCost !== null && <p className="mt-3 text-sm text-navy/75">Material-only estimate for {job.quantity} {job.quantity === 1 ? "part" : "parts"}: <strong>{money(materialCost)}</strong>.</p>}
            {myShop.pricingRates?.[job.material] == null && <p className="mt-3 text-sm text-navy/60">No sample rate is set for {job.material}. Enter your production price directly.</p>}
          </section>
        </div>
        <div className="stack">
          <form onSubmit={saveDraft} className="panel stack">
            <div className="section-heading"><p className="eyebrow">YOUR PROPOSAL</p><h2>{draft ? "Edit your sample quote" : "Build a sample quote"}</h2></div>
            <div className="flex flex-wrap items-center gap-3"><span className="badge">{draft ? dirty ? "Unsaved changes" : `Saved · revision ${draft.revision}` : "Not saved yet"}</span><p className="text-sm text-navy/65">Production pricing covers the whole job: {job.quantity} {job.quantity === 1 ? "part" : "parts"}.</p></div>
            {requestChanged && <p className="rounded-xl bg-orange-50 p-4 text-sm leading-6 text-navy/75">The sample brief differs from the saved specification. Review the current details and confirm them before saving a new revision.</p>}
            {notice && <p role="status" className="rounded-xl bg-navy/5 p-4 text-sm leading-6 text-navy/75">{notice}</p>}
            <div className="form-grid">
              <div><label htmlFor="quote-price" className="block text-sm font-medium text-navy">Whole-job production price (USD)</label><input id="quote-price" required type="number" min="0.01" max="10000" step="0.01" value={price} onChange={(event) => updateField("price", event.target.value)} placeholder="24.00" className="field mt-2 w-full" /></div>
              <div><label htmlFor="quote-shipping" className="block text-sm font-medium text-navy">Shipping (USD)</label><input id="quote-shipping" required type="number" min="0" max="1000" step="0.01" value={shipping} onChange={(event) => updateField("shipping", event.target.value)} className="field mt-2 w-full" /></div>
            </div>
            <div><label htmlFor="quote-days" className="block text-sm font-medium text-navy">Production time (business days)</label><input id="quote-days" required type="number" min="1" max="90" step="1" value={turnaround} onChange={(event) => updateField("turnaround", event.target.value)} className="field mt-2 w-full" /><p className="mt-2 text-sm text-navy/60">After file approval and confirmed payment. Shipping time is separate.</p></div>
            <div><label htmlFor="quote-notes" className="block text-sm font-medium text-navy">Scope and finishing notes</label><textarea id="quote-notes" rows={4} maxLength={1000} value={notes} onChange={(event) => updateField("notes", event.target.value)} placeholder="Describe the finish, assumptions, and anything the buyer should confirm. Use sample information." className="field mt-2 w-full resize-y" /></div>
            <label className="flex items-start gap-3 text-sm leading-6 text-navy/75"><input type="checkbox" required checked={reviewed} onChange={(event) => updateField("reviewed", event.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-accent" /><span>I reviewed the sample intended use, material, quantity, and dimensions.</span></label>
            <div className="rounded-xl bg-orange-50 p-4 text-sm leading-6 text-navy/75">Build processing costs into your price. Final fees and tax treatment require provider configuration; this sample does not calculate net earnings or sales tax.</div>
            {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
            <button type="submit" disabled={!!draft && !dirty} className="button w-full"><FileText size={18} /> {draft ? "Save draft changes" : "Save sample draft"}</button>
            {draft && <div className="flex flex-wrap gap-3">{dirty && <button type="button" onClick={restoreSaved} className="button button-secondary"><RotateCcw size={17} /> Restore saved draft</button>}<button type="button" onClick={clearSaved} className="button button-secondary"><Trash2 size={17} /> Clear saved draft and form</button></div>}
            <p className="text-center text-sm leading-6 text-navy/60">Save before leaving to keep your edits. Drafts stay in this preview's memory until refresh; nothing is stored on disk or sent.</p>
          </form>
          {draft && <section className="panel" aria-label="Saved sample proposal" aria-live="polite">
            <span className="badge"><Check size={15} /> Sample · saved revision {draft.revision}</span>
            <h2 className="mt-4 text-xl font-semibold text-navy">Your saved proposal</h2>
            <p className="mt-2 text-sm text-navy/60">Saved <time dateTime={new Date(draft.savedAt).toISOString()}>{new Date(draft.savedAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</time></p>
            {dirty && <p className="mt-4 rounded-xl bg-orange-50 p-4 text-sm leading-6 text-navy/75"><strong>Unsaved changes above.</strong> This summary shows saved revision {draft.revision}. Save your edits to update it.</p>}
            <dl className="mt-5 space-y-3 text-sm">
              <div className="flex justify-between gap-4"><dt>Production · all {draft.specification.quantity} {draft.specification.quantity === 1 ? "part" : "parts"}</dt><dd>{money(draft.productionCents / 100)}</dd></div>
              <div className="flex justify-between gap-4"><dt>Shipping</dt><dd>{money(draft.shippingCents / 100)}</dd></div>
              <div className="flex justify-between gap-4 border-t border-navy/10 pt-3 font-semibold"><dt>Subtotal before tax</dt><dd>{money(draft.subtotalCents / 100)}</dd></div>
              <div className="flex justify-between gap-4"><dt>Production estimate</dt><dd>{draft.turnaroundDays} business days</dd></div>
            </dl>
            {draft.notes && <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-6 text-navy/70">{draft.notes}</p>}
            <Link to="/owner/requests" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-accent">View saved drafts in requests <ArrowRight size={16} /></Link>
          </section>}
        </div>
      </div>
    </div>
  );
}

export default function JobDetail() {
  const { jobId } = useParams();
  const job = jobs.find((item) => item.id === jobId);
  if (!job) return <div className="app-page"><div className="empty-state"><h1 className="text-2xl font-semibold">Request not found</h1><p className="mt-3">This sample request is no longer available.</p><Link to="/owner/requests" className="button mt-5">Back to requests</Link></div></div>;
  return <QuoteWorkspace key={job.id} job={job} />;
}




