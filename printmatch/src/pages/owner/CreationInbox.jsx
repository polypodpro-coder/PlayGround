import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Box, FileText, Inbox, RefreshCw } from "lucide-react";
import ModelPreviewer from "../../components/ModelPreviewer";
import { isCurrentModelInfo } from "../../lib/stlUnits";
import { useCreations } from "../../context/CreationContext";
import MeshyTools from "../../components/MeshyTools";
import { useApp } from "../../context/AppContext";

const money = (cents) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
const dateLabel = (value) => Number.isNaN(new Date(value).getTime()) ? "" : new Date(value).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

function offerFields(offer) {
  return { production: Number.isSafeInteger(offer?.productionCents) ? (offer.productionCents / 100).toFixed(2) : "", fulfillment: Number.isSafeInteger(offer?.fulfillmentCents) ? (offer.fulfillmentCents / 100).toFixed(2) : "0.00", leadDays: String(offer?.leadDays ?? 3), notes: offer?.notes ?? "" };
}
function centsFromText(value, label, minimum, maximum) {
  const text = value.trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) throw new Error(`${label} must be a dollar amount with at most two decimal places.`);
  const [whole, fraction = ""] = text.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents) || cents < minimum || cents > maximum) throw new Error(`${label} must be between ${money(minimum)} and ${money(maximum)}.`);
  return cents;
}

function RequestReview({ record, mode, sharingEnabled, loadModel, respondToRequest }) {
  const creation = record.creation;
  const [file, setFile] = useState(null), [modelInfo, setModelInfo] = useState(null), [fileLoading, setFileLoading] = useState(true), [fileError, setFileError] = useState(""), [attempt, setAttempt] = useState(0);
  const [formRequestVersion, setFormRequestVersion] = useState(record.requestVersion);
  const [form, setForm] = useState(() => offerFields(record.offer)), [reviewed, setReviewed] = useState(false), [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(""), [message, setMessage] = useState("");
  const lock = useRef(false);
  const writeAvailable = (mode === "preview" || mode === "connected") && sharingEnabled;
  const currentInfo = !!file && isCurrentModelInfo(modelInfo, { file, sourceUnits: creation.sourceUnits });
  const formVersionValid = Number.isSafeInteger(formRequestVersion) && formRequestVersion >= 1;
  const requestChanged = record.requestVersion !== formRequestVersion;
  const baseline = offerFields(record.offer);
  const dirty = !record.offer || Object.keys(form).some((key) => form[key] !== baseline[key]);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const model = await loadModel(creation.id);
        if (!(model instanceof File)) throw new Error("The shared STL is unavailable.");
        if (active) { setFile(model); setFileLoading(false); setFileError(""); }
      } catch (failure) {
        if (active) { setFileError(failure.message || "The shared model could not be loaded."); setFileLoading(false); }
      }
    }
    load();
    return () => { active = false; };
  }, [creation.id, loadModel, attempt]);

  function updateField(key, value) {
    setForm((previous) => ({ ...previous, [key]: value })); setError(""); setMessage("");
  }
  function resetToCurrentRequest() {
    setForm(offerFields(record.offer));
    setFormRequestVersion(record.requestVersion);
    setReviewed(false);
    setError("");
    setMessage("Current request loaded into the form. Unsaved edits were discarded; review it again before responding.");
  }
  function retryModel() { setFile(null); setModelInfo(null); setReviewed(false); setFileLoading(true); setFileError(""); setAttempt((value) => value + 1); }
  async function respond(event) {
    event.preventDefault();
    if (lock.current) return;
    setError(""); setMessage("");
    if (!writeAvailable) { setError("Creation responses are paused. You can still review existing requests."); return; }
    if (!formVersionValid) { setError("The request version is unavailable. Refresh the inbox and reload the current request."); return; }
    if (requestChanged) { setError("This request changed after the form was opened. Reload the current request before responding."); return; }
    if (!currentInfo || !reviewed) { setError("Load and review the current model and confirm the request details first."); return; }
    let offer;
    try {
      const productionCents = centsFromText(form.production, "Whole-job production", 1, 10000000);
      const fulfillmentCents = centsFromText(form.fulfillment, "Fulfillment", 0, 100000);
      if (!/^\d+$/.test(form.leadDays.trim())) throw new Error("Production time must be 1–90 whole business days.");
      const leadDays = Number(form.leadDays);
      if (!Number.isInteger(leadDays) || leadDays < 1 || leadDays > 90) throw new Error("Production time must be 1–90 whole business days.");
      if (form.notes.length > 2000) throw new Error("Keep estimate notes within 2,000 characters.");
      offer = { requestVersion: formRequestVersion, productionCents, fulfillmentCents, leadDays, notes: form.notes.trim() };
    } catch (failure) { setError(failure.message); return; }
    lock.current = true; setSubmitting(true);
    try {
      await respondToRequest(record.id, offer);
      setForm(offerFields(offer));
      setMessage(mode === "preview" ? "Sample estimate saved in this tab. No buyer was contacted." : "Your nonbinding estimate was sent to the buyer. It is not a payable quote or print authorization.");
    } catch (failure) { setError(failure.message || "The estimate could not be saved. Your edits are still here."); }
    finally { lock.current = false; setSubmitting(false); }
  }

  return <div className="stack min-w-0">
    <section className="panel stack">
      <div><span className="badge">{mode === "preview" ? "Sample farm request" : "Shared creation request"}</span><h2 className="mt-3 break-words text-2xl font-semibold">{creation.title}</h2><p className="mt-2 text-sm leading-6 text-navy/65">From {record.buyerLabel} · For {record.sellerName}<br />{dateLabel(record.createdAt)}</p></div>
      <p className="break-words text-sm text-navy/65">{creation.fileName} · {(creation.byteLength / 1024).toFixed(1)} KB · source units: {creation.sourceUnits}</p>
      <details className="text-sm text-navy/65"><summary className="cursor-pointer font-medium">View file fingerprint (SHA-256)</summary><code className="mt-2 block break-all text-xs">{creation.sha256}</code></details>
      <div className="rounded-xl bg-navy/5 p-4"><h3 className="font-semibold">Buyer's request notes</h3><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-navy/75">{record.notes || "No notes were included. Intended use, quantity, material, finishing, and delivery still need agreement."}</p></div>
      {fileLoading && <p role="status" className="notice">Loading the shared model for review…</p>}
      {fileError && <div role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800"><p>{fileError}</p><button type="button" className="button button-secondary mt-3" onClick={retryModel}><RefreshCw size={16} /> Retry model</button></div>}
      {file && <ModelPreviewer file={file} sourceUnits={creation.sourceUnits} title={creation.title} onModelInfo={setModelInfo} />}
      {currentInfo && <p className="text-sm leading-6 text-navy/65">Model dimensions: <strong>{["x", "y", "z"].map((axis) => Number(modelInfo.dimensions[axis].toPrecision(6))).join(" × ")} mm</strong>. The viewer does not approve printability, strength, or fit.</p>}
    </section>
    <form onSubmit={respond} noValidate className="panel stack">
      <div><p className="eyebrow">FARM RESPONSE</p><h2 className="section-heading mt-2">{record.offer ? "Update a nonbinding estimate" : "Prepare a nonbinding estimate"}</h2><p className="text-sm leading-6 text-navy/65">Price the entire scope described in your notes. Final material, quantity, specifications, tax, delivery, and terms still require agreement.</p></div>
      {(requestChanged || !formVersionValid) && <div role="status" className="notice"><p>{requestChanged ? "This request changed after your form was opened. Reload the current request to review its latest details. This will discard unsaved estimate edits." : "The request version is unavailable. Refresh the inbox before loading the current request."}</p><button type="button" className="button button-secondary mt-3" disabled={submitting || !Number.isSafeInteger(record.requestVersion) || record.requestVersion < 1} onClick={resetToCurrentRequest}><RefreshCw size={16} /> Reload current request</button></div>}
      {record.offer && <span className="badge w-fit">{dirty ? "Unsaved estimate changes" : "Current estimate shown below"}</span>}
      <div className="form-grid">
        <label className="field"><span>Whole-job production (USD)</span><input type="text" inputMode="decimal" maxLength={14} required value={form.production} disabled={!writeAvailable || submitting} onChange={(event) => updateField("production", event.target.value)} placeholder="45.00" /></label>
        <label className="field"><span>Fulfillment estimate (USD)</span><input type="text" inputMode="decimal" maxLength={12} required value={form.fulfillment} disabled={!writeAvailable || submitting} onChange={(event) => updateField("fulfillment", event.target.value)} placeholder="0.00" /></label>
      </div>
      <label className="field"><span>Production time (business days)</span><input type="text" inputMode="numeric" maxLength={2} required value={form.leadDays} disabled={!writeAvailable || submitting} onChange={(event) => updateField("leadDays", event.target.value)} /></label>
      <label className="field"><span>Scope, quantity, material, and estimate notes</span><textarea rows={4} maxLength={2000} value={form.notes} disabled={!writeAvailable || submitting} onChange={(event) => updateField("notes", event.target.value)} placeholder="Describe what the price covers, assumptions, finishing, intended use, and any information still needed." /></label>
      <label className="flex items-start gap-3 text-sm leading-6 text-navy/75"><input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-accent" checked={reviewed && currentInfo} disabled={!currentInfo || !writeAvailable || submitting} onChange={(event) => setReviewed(event.target.checked)} /><span>I reviewed the current model and request. This estimate still needs final specifications and agreement before any paid work.</span></label>
      {!writeAvailable && <p className="notice">Creation responses are paused or require sign-in. Existing files and estimates can be reviewed when available.</p>}
      {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
      {message && <p role="status" className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900">{message}</p>}
      <div className="flex flex-wrap gap-3"><button type="submit" disabled={!writeAvailable || submitting || !formVersionValid || requestChanged || !currentInfo || !reviewed || (!!record.offer && !dirty)} className="button"><FileText size={17} /> {submitting ? "Saving estimate…" : mode === "preview" ? "Save sample estimate" : "Send nonbinding estimate"}</button>{record.offer && dirty && <button type="button" className="button button-secondary" disabled={submitting} onClick={resetToCurrentRequest}>Restore saved estimate</button>}</div>
      <p className="text-sm leading-6 text-navy/60">{mode === "preview" ? "This saves only in the current preview tab. Refreshing clears these requests and estimates." : "This shares an estimate with the requesting buyer."} No payment is collected and no manufacturing is authorized.</p>
    </form>
    {record.offer && <section className="panel stack" aria-label="Current saved nonbinding estimate"><div><span className="badge">Nonbinding estimate · not payable</span><h2 className="mt-3 text-xl font-semibold">Current saved response</h2></div>{dirty && <p className="notice">This is the saved response. The form above contains unsaved changes.</p>}<dl className="space-y-3 text-sm"><div className="flex justify-between gap-3"><dt>Whole-job production</dt><dd className="font-semibold">{money(record.offer.productionCents)}</dd></div><div className="flex justify-between gap-3"><dt>Fulfillment</dt><dd className="font-semibold">{money(record.offer.fulfillmentCents)}</dd></div><div className="flex justify-between gap-3 border-t border-navy/10 pt-3"><dt>Estimate before tax</dt><dd className="font-semibold">{money(record.offer.productionCents + record.offer.fulfillmentCents)}</dd></div><div className="flex justify-between gap-3"><dt>Production time</dt><dd>{record.offer.leadDays} business days</dd></div></dl>{record.offer.notes && <p className="whitespace-pre-wrap break-words text-sm leading-6 text-navy/75">{record.offer.notes}</p>}</section>}
  </div>;
}

export default function CreationInbox() {
  const { mode, sharingEnabled, loading, error, inbox, loadModel, respondToRequest, refresh, clearError } = useCreations();
  const { myShop } = useApp();
  const [selectedId, setSelectedId] = useState("");
  const [localError, setLocalError] = useState("");
  const selected = inbox.find((record) => record.id === selectedId) ?? inbox[0] ?? null;
  const available = mode === "preview" || mode === "connected";
  async function refreshInbox() {
    setLocalError(""); clearError();
    try { await refresh(); } catch (failure) { setLocalError(failure.message || "The creation inbox could not be refreshed."); }
  }
  return <div className="app-page stack">
    <header><p className="eyebrow">PRINT FARM / CREATION INBOX</p><h1 className="page-heading">Review the model. Clarify the quote.</h1><p className="body-copy">Review shared creations and respond with a nonbinding estimate before a buyer considers paid work.</p></header>
    <div className="notice" role="status">{mode === "preview" ? `Preview inbox for ${myShop.name}. Only requests shared with this sample farm appear here. Files and estimates stay in this tab and reset on refresh.` : mode === "connected" ? "This inbox contains creation requests shared with farms your account can access. A response is a nonbinding estimate, not a payable quote." : mode === "signed-out" ? "Sign in to access creation requests shared with your farm." : "Creation services are unavailable. Requests and responses cannot be refreshed right now."}</div>
    {!available && <Link className="button button-secondary w-fit" to="/account">Account and sign-in <ArrowRight size={17} /></Link>}
    {available && !sharingEnabled && <p className="notice">Creation writes are paused. You may review available requests, but responses cannot be saved until the service is enabled.</p>}
    {(localError || error) && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{localError || error}</p>}
    <div className="section-row"><h2 className="section-heading">Creation requests ({inbox.length})</h2><button type="button" className="button button-secondary" disabled={loading} onClick={refreshInbox}><RefreshCw size={17} /> {loading ? "Refreshing…" : "Refresh inbox"}</button></div>
    {!loading && inbox.length === 0 && <div className="empty-state"><Inbox size={34} className="mx-auto mb-4" /><h3 className="text-lg font-semibold">No creation requests here yet.</h3><p className="mt-2 text-sm leading-6">{mode === "preview" ? `In the creation studio, save an actual STL and choose ${myShop.name} when adding it to the sample inbox.` : "Requests will appear when a buyer shares a creation with a farm your account manages."}</p></div>}
    {inbox.length > 0 && <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1.5fr)]"><nav className="panel space-y-3" aria-label="Choose a creation request">{inbox.map((record) => <button type="button" key={record.id} onClick={() => setSelectedId(record.id)} aria-pressed={selected?.id === record.id} className={`block w-full rounded-xl border p-4 text-left ${selected?.id === record.id ? "border-accent bg-accent/5" : "border-navy/15"}`}><Box size={21} className="mb-3 text-accent" /><span className="block break-words font-semibold">{record.creation.title}</span><span className="mt-2 block text-sm text-navy/65">{record.buyerLabel}</span><span className="mt-1 block text-sm text-navy/60">{dateLabel(record.createdAt)}</span><span className="badge mt-3">{record.offer ? "Estimate saved" : "Awaiting review"}</span></button>)}</nav>{selected && available && <RequestReview key={selected.id} record={selected} mode={mode} sharingEnabled={sharingEnabled === true} loadModel={loadModel} respondToRequest={respondToRequest} />}</div>}
    <MeshyTools farm />
  </div>;
}




