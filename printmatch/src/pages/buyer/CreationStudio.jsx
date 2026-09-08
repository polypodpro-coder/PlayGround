import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Box, Check, Download, ExternalLink, Eye, FolderOpen, RefreshCw, UploadCloud } from "lucide-react";
import ModelPreviewer, { MAX_STL_BYTES } from "../../components/ModelPreviewer";
import { isCurrentModelInfo } from "../../lib/stlUnits";
import { useApp } from "../../context/AppContext";
import { useCreations } from "../../context/CreationContext";
import { MESHY_PORTAL } from "../../config/meshyPortal";
import MeshyTools from "../../components/MeshyTools";
import MeshyGenerator from "../../components/MeshyGenerator";

const money = (cents) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
const createdLabel = (value) => Number.isNaN(new Date(value).getTime()) ? "" : new Date(value).toLocaleDateString();
const unitsLabel = { mm: "Millimeters (mm)", cm: "Centimeters (cm)", in: "Inches (in)" };

function CreationCard({ entry, mode, farms, sampleFarmId, available, sharingAvailable, shareCreation, revokeShare, onInspect, onDownload, onPrepare, busy }) {
  const [sellerId, setSellerId] = useState("");
  const [notes, setNotes] = useState("");
  const [sharing, setSharing] = useState(false);
  const [revokingShareId, setRevokingShareId] = useState("");
  const requestBusy = sharing || !!revokingShareId;
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const lock = useRef(false);
  const alreadyShared = (entry.shares ?? []).some((share) => share.sellerId === sellerId);
  async function share(event) {
    event.preventDefault();
    if (lock.current || !sharingAvailable) return;
    if (!farms.some((farm) => farm.id === sellerId)) { setError("Choose one of the listed farms."); return; }
    if (alreadyShared) { setError("This creation already has a request with that farm. Review the request below."); return; }
    lock.current = true; setSharing(true); setError(""); setMessage("");
    try {
      await shareCreation(entry.id, { sellerId, notes: notes.trim() });
      setMessage(mode === "preview" ? "Added to this tab's sample requests. No file or message was sent." : "Shared with the selected farm for a nonbinding quote request.");
      setNotes("");
    } catch (failure) { setError(failure.message || "The quote request could not be saved. Try again."); }
    finally { lock.current = false; setSharing(false); }
  }
  async function revoke(shareId) {
    if (lock.current || busy || !available) return;
    lock.current = true; setRevokingShareId(shareId); setError(""); setMessage("");
    try {
      await revokeShare(shareId);
      setMessage(mode === "preview" ? "Sample request removed from this tab's farm inbox." : "The farm's future access was revoked. Copies it already downloaded cannot be removed.");
    } catch (failure) { setError(failure.message || "Access could not be revoked. Try again."); }
    finally { lock.current = false; setRevokingShareId(""); }
  }
  return <article className="panel stack min-w-0">
    <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><span className="badge">{mode === "preview" ? "Saved in this tab" : "Creation library"}</span><h3 className="mt-3 break-words text-xl font-semibold">{entry.title}</h3><p className="mt-2 break-words text-sm text-navy/65">{entry.fileName} · {(entry.byteLength / 1024).toFixed(1)} KB · {unitsLabel[entry.sourceUnits] ?? entry.sourceUnits}</p><p className="mt-1 text-sm text-navy/60">{createdLabel(entry.createdAt)}</p></div><Box size={24} className="text-accent" /></div>
    <details className="text-sm text-navy/65"><summary className="cursor-pointer font-medium">File fingerprint (SHA-256)</summary><code className="mt-2 block break-all text-xs">{entry.sha256}</code></details>
    <div className="flex flex-wrap gap-2"><button type="button" className="button button-secondary" disabled={busy || !available || requestBusy} onClick={() => onInspect(entry)}><Eye size={17} /> Review model</button><button type="button" className="button button-secondary" disabled={busy || !available || requestBusy} onClick={() => onDownload(entry)}><Download size={17} /> Original STL</button><button type="button" className="button button-secondary" disabled={busy || !available || requestBusy} onClick={() => onPrepare(entry)}><ArrowRight size={17} /> Prepare print request</button></div>
    <p className="text-sm leading-6 text-navy/60">The print request builder explores sample materials and pricing. It does not place a paid order.</p>
    <form onSubmit={share} className="space-y-4 border-t border-navy/10 pt-5">
      <h4 className="font-semibold">Request a farm review</h4>
      <label className="field"><span>Choose a farm</span><select required value={sellerId} disabled={!sharingAvailable || requestBusy} onChange={(event) => { setSellerId(event.target.value); setMessage(""); setError(""); }}><option value="">Select a farm</option>{farms.map((farm) => <option key={farm.id} value={farm.id}>{farm.name}{mode === "preview" && farm.id === sampleFarmId ? " · sample inbox" : ""}</option>)}</select></label>
      {mode === "preview" && <p className="text-sm leading-6 text-navy/60">Choose the farm marked “sample inbox” to review the request in this preview's farm workspace. Other farm requests remain listed here.</p>}
      <label className="field"><span>Notes for the farm (optional)</span><textarea rows={3} maxLength={2000} value={notes} disabled={!sharingAvailable || requestBusy} onChange={(event) => setNotes(event.target.value)} placeholder="Intended use, desired size, quantity, material, and questions about the design." /></label>
      <p className="text-sm leading-6 text-navy/65">{mode === "preview" ? "This adds a separate sample quote request in this tab only." : "Sharing gives only the selected farm access to this creation for review."} A request is nonbinding and does not authorize printing or payment.</p>
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {message && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">{message}</p>}
      <button type="submit" disabled={!sharingAvailable || requestBusy || !sellerId || alreadyShared} className="button">{sharing ? "Saving request…" : alreadyShared ? "Request already added" : mode === "preview" ? "Add to sample inbox" : "Share for a quote"} <ArrowRight size={17} /></button>
      {farms.length === 0 && <p className="text-sm text-navy/65">No farms are available for sharing yet.</p>}
    </form>
    {(entry.shares ?? []).length > 0 && <section className="space-y-3 border-t border-navy/10 pt-5"><h4 className="font-semibold">Farm requests</h4>{entry.shares.map((share) => <div key={share.id} className="rounded-xl bg-navy/5 p-4 text-sm"><p className="font-semibold">{share.sellerName || farms.find((farm) => farm.id === share.sellerId)?.name || "Selected farm"}</p><p className="mt-1 text-navy/65">{share.offer ? "Nonbinding estimate received" : mode === "preview" ? "Sample request · awaiting an example response" : "Quote request awaiting a response"}</p>{share.notes && <p className="mt-3 whitespace-pre-wrap break-words leading-6 text-navy/70">{share.notes}</p>}{share.offer && <div className="mt-3 space-y-2"><p>Production: <strong>{money(share.offer.productionCents)}</strong> · Fulfillment: <strong>{money(share.offer.fulfillmentCents)}</strong></p><p>Estimate before tax: <strong>{money(share.offer.productionCents + share.offer.fulfillmentCents)}</strong> · {share.offer.leadDays} business days</p>{share.offer.notes && <p className="whitespace-pre-wrap break-words leading-6 text-navy/70">{share.offer.notes}</p>}<p className="text-navy/65">Not a payable quote. Final specifications, delivery, tax, and terms still need agreement.</p></div>}<div className="mt-4 border-t border-navy/10 pt-3"><button type="button" className="button button-secondary" disabled={!available || busy || requestBusy} onClick={() => revoke(share.id)}>{revokingShareId === share.id ? "Updating access…" : mode === "preview" ? "Remove sample request" : "Revoke farm access"}</button>{mode === "connected" && <p className="mt-2 text-sm leading-6 text-navy/65">Revoking stops future access. It cannot remove copies the farm already downloaded.</p>}</div></div>)}</section>}
  </article>;
}

export default function CreationStudio() {
  const { mode, sharingEnabled, loading, error, entries, farms, saveCreation, shareCreation, revokeShare, loadModel, refresh, clearError } = useCreations();
  const { myShop, selectedMaterial, selectedMachineId, selectedAddons, setRequest, setSelectedDesign, setDirectRequestPrinterId } = useApp();
  const navigate = useNavigate();
  const [file, setFile] = useState(null), [title, setTitle] = useState(""), [sourceUnits, setSourceUnits] = useState("mm");
  const [modelInfo, setModelInfo] = useState(null), [rightsConfirmed, setRightsConfirmed] = useState(false), [dimensionsConfirmed, setDimensionsConfirmed] = useState(false);
  const [saving, setSaving] = useState(false), [activeOperation, setActiveOperation] = useState(""), [selectedSaved, setSelectedSaved] = useState(null);
  const [message, setMessage] = useState(""), [localError, setLocalError] = useState("");
  const inputRef = useRef(null), saveLock = useRef(false), actionLock = useRef(false);
  const available = mode === "preview" || mode === "connected";
  const infoCurrent = !!file && isCurrentModelInfo(modelInfo, { file, sourceUnits });
  const canSave = available && sharingEnabled === true && !loading && !saving && infoCurrent && rightsConfirmed && dimensionsConfirmed && title.trim();
  const resetImport = () => { setFile(null); setTitle(""); setModelInfo(null); setRightsConfirmed(false); setDimensionsConfirmed(false); };
  function chooseFile(files) {
    const selected = files?.[0]; if (!selected) return;
    resetImport(); setLocalError(""); setMessage(""); clearError();
    if (files.length !== 1 || !/\.stl$/i.test(selected.name) || !selected.size || selected.size > MAX_STL_BYTES) {
      setLocalError("Choose one non-empty STL file no larger than 10 MB."); return;
    }
    setSourceUnits("mm"); setFile(selected); setTitle(selected.name.replace(/\.stl$/i, "").slice(0, 100));
  }
  function applyGeneratedFile(generated) {
    resetImport(); setLocalError(""); setMessage(""); clearError();
    if (!(generated instanceof File) || !/\.stl$/i.test(generated.name) || !generated.size || generated.size > MAX_STL_BYTES) {
      setLocalError("The generated model was not a valid STL under 10 MB. Try generating again."); return;
    }
    setSourceUnits("mm"); setFile(generated); setTitle(generated.name.replace(/\.stl$/i, "").slice(0, 100) || "Meshy creation");
    setMessage("Generated model loaded. Confirm its source units and dimensions below, then save it to your library.");
  }
  async function save(event) {
    event.preventDefault();
    if (saveLock.current) return;
    if (!canSave) { setLocalError("Load a valid STL, give it a title, and confirm your rights and the current dimensions before saving."); return; }
    saveLock.current = true; setSaving(true); setLocalError(""); setMessage(""); clearError();
    try {
      const entry = await saveCreation({ file, title: title.trim(), sourceUnits });
      setMessage(mode === "preview" ? `“${entry.title}” was saved in this tab. It has not been uploaded.` : `“${entry.title}” was saved to your creation library.`);
      resetImport();
    } catch (failure) { setLocalError(failure.message || "This creation could not be saved. Your file is still selected."); }
    finally { saveLock.current = false; setSaving(false); }
  }
  async function withFile(entry, action) {
    if (actionLock.current || !available) return;
    actionLock.current = true; setActiveOperation(entry.id); setLocalError(""); setMessage(""); clearError();
    try {
      const model = selectedSaved?.entry.id === entry.id ? selectedSaved.file : await loadModel(entry.id);
      if (!(model instanceof File)) throw new Error("The model file is unavailable. Refresh the library and try again.");
      if (action === "inspect") setSelectedSaved({ entry, file: model });
      if (action === "download") {
        const url = URL.createObjectURL(model), anchor = document.createElement("a");
        anchor.href = url; anchor.download = entry.fileName; anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        setMessage("Original STL download started. Use its saved source units when reopening it.");
      }
      if (action === "prepare") {
        setSelectedDesign(null); setDirectRequestPrinterId(null);
        setRequest({ creationId: entry.id, creationSource: "meshy", localFile: model, fileName: model.name, sourceType: "local-stl", sourceUnits: entry.sourceUnits, material: selectedMaterial, selectedMachineId, selectedAddons: [...selectedAddons], quantity: 1, estimatedGrams: 40, estimateBasis: "user-supplied-example", intendedUse: "decorative", units: "mm", dimensions: null, notes: "", neededBy: "", fulfillmentPreference: "any" });
        navigate("/request");
      }
    } catch (failure) { setLocalError(failure.message || "The saved model could not be opened. Try again."); }
    finally { actionLock.current = false; setActiveOperation(""); }
  }
  async function refreshLibrary() {
    setLocalError(""); clearError();
    try { await refresh(); } catch (failure) { setLocalError(failure.message || "The library could not be refreshed."); }
  }

  return <div className="app-page stack">
    <header><p className="eyebrow">CREATION STUDIO</p><h1 className="page-heading">Create an idea. Bring back a model.</h1><p className="body-copy">Use your own Meshy account, inspect the STL here, then choose a farm for a separate quote request.</p></header>
    <div className="notice" role="status">{mode === "preview" ? "Preview mode: imported files, library entries, and sample farm requests stay in this tab's memory and reset on refresh. Meshy generation is real and uses your own API credits." : mode === "connected" ? "Connected library: saving uploads your file. Sharing grants the selected farm access for a nonbinding quote request. No payment or print order is created here." : mode === "signed-out" ? "Sign in to use the connected library and farm requests. You can still open Meshy and inspect an STL locally." : "Creation services are unavailable. You can still open Meshy and inspect an STL locally; saving and sharing are paused."}</div>
    {(mode === "signed-out" || mode === "unavailable") && <div className="flex flex-wrap gap-3"><Link className="button button-secondary" to="/account">Account and sign-in <ArrowRight size={17} /></Link><button type="button" className="button button-secondary" onClick={refreshLibrary} disabled={loading}><RefreshCw size={17} /> Retry services</button></div>}
    {available && !sharingEnabled && <p className="notice">Creation writes are paused. Existing library files can be opened, but saving and sharing are disabled until the service is enabled.</p>}
    {(localError || error) && <div role="alert" className="rounded-xl bg-red-50 p-4 text-sm leading-6 text-red-800">{localError || error}</div>}
    {message && <p role="status" className="rounded-xl bg-emerald-50 p-4 text-sm leading-6 text-emerald-900">{message}</p>}
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.4fr)]">
      <div className="stack min-w-0">
        <MeshyGenerator onGenerated={applyGeneratedFile} disabled={saving} />
        <details className="panel text-sm text-navy/70">
          <summary className="cursor-pointer font-semibold">Prefer to use Meshy's website instead?</summary>
          <p className="mt-3 leading-6">You can also create on Meshy directly with your own account, then import the exported STL on the right.</p>
          <a href={MESHY_PORTAL.workspaceUrl} target="_blank" rel="noopener noreferrer" className="mt-3 button button-secondary">Open Meshy workspace <ExternalLink size={17} /></a>
          {MESHY_PORTAL.referralUrl && <div className="mt-4 border-t border-navy/10 pt-4"><a href={MESHY_PORTAL.referralUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 font-semibold text-accent">New to Meshy? Create an account through our associate link <ExternalLink size={15} /></a><p className="mt-2 leading-6 text-navy/65">We may earn Meshy credits if you sign up through this link.</p></div>}
        </details>
      </div>
      <form onSubmit={save} className="panel stack">
        <div><p className="eyebrow">02 / IMPORT AND REVIEW</p><h2 className="section-heading mt-2">Check the model that comes back.</h2></div>
        <div className="rounded-xl border border-dashed border-navy/25 p-5 text-center"><UploadCloud size={30} className="mx-auto mb-3 text-accent" /><p className="mb-4 text-sm leading-6 text-navy/65">Choose the STL you downloaded from Meshy.<br />One file · up to 10 MB · viewed locally before save</p><button type="button" className="button button-secondary" disabled={saving} onClick={() => inputRef.current?.click()}>{file ? "Choose another STL" : "Choose an STL"}</button><input ref={inputRef} type="file" accept=".stl" className="sr-only" aria-label="Choose your Meshy STL" disabled={saving} onChange={(event) => { chooseFile(event.target.files); event.target.value = ""; }} /></div>
        {file && <>
          <p className="break-words text-sm font-medium">{file.name} · {(file.size / 1024).toFixed(1)} KB</p>
          <label className="field"><span>Creation title</span><input required maxLength={100} value={title} disabled={saving} onChange={(event) => setTitle(event.target.value)} /></label>
          <label className="field"><span>Source STL units</span><select value={sourceUnits} disabled={saving} onChange={(event) => { setSourceUnits(event.target.value); setModelInfo(null); setDimensionsConfirmed(false); }}>{Object.entries(unitsLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <p className="text-sm leading-6 text-navy/65">STL files do not record units. Choose the units used by your export and check the physical dimensions below; do not assume the default is correct.</p>
          <ModelPreviewer file={file} sourceUnits={sourceUnits} title={title || file.name} onModelInfo={setModelInfo} />
          {infoCurrent && <p className="rounded-xl bg-navy/5 p-4 text-sm leading-6">Current dimensions: <strong>{["x", "y", "z"].map((axis) => Number(modelInfo.dimensions[axis].toPrecision(6))).join(" × ")} mm</strong>. A visual review does not establish printability, strength, or fit.</p>}
          <label className="flex items-start gap-3 text-sm leading-6 text-navy/75"><input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-accent" checked={rightsConfirmed} disabled={saving} onChange={(event) => setRightsConfirmed(event.target.checked)} /><span>I have permission to use this model and share it with a farm for this purpose.</span></label>
          <label className="flex items-start gap-3 text-sm leading-6 text-navy/75"><input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-accent" checked={dimensionsConfirmed && infoCurrent} disabled={!infoCurrent || saving} onChange={(event) => setDimensionsConfirmed(event.target.checked)} /><span>I checked the selected source units and the current dimensions shown above.</span></label>
          <button className="button w-full" type="submit" disabled={!canSave}><Check size={17} /> {saving ? "Saving creation…" : mode === "preview" ? "Save in preview library" : "Save to my creation library"}</button>
          <p className="text-sm leading-6 text-navy/65">{mode === "preview" ? "This keeps the file only in the current tab. Refreshing clears it." : "Saving in connected mode uploads this STL to your library. Sharing with a farm is a separate action below."}</p>
        </>}
      </form>
    </div>
    <MeshyTools />
    <section className="stack">
      <div className="section-row"><div><p className="eyebrow">03 / CHOOSE A FARM</p><h2 className="section-heading mt-2">Your creations ({entries.length})</h2></div><button type="button" className="button button-secondary" disabled={loading || !!activeOperation} onClick={refreshLibrary}><RefreshCw size={17} /> {loading ? "Refreshing…" : "Refresh library"}</button></div>
      {selectedSaved && <div className="panel stack"><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="break-words text-lg font-semibold">{selectedSaved.entry.title}</h3><button type="button" className="button button-secondary" onClick={() => setSelectedSaved(null)}>Close model review</button></div><ModelPreviewer file={selectedSaved.file} sourceUnits={selectedSaved.entry.sourceUnits} title={selectedSaved.entry.title} /><p className="text-sm text-navy/65">This is the saved file. The viewer can export a separate STL with coordinates normalized to millimeters.</p></div>}
      {activeOperation && <p role="status" className="notice">Opening the saved model…</p>}
      {!loading && entries.length === 0 && <div className="empty-state"><FolderOpen size={32} className="mx-auto mb-4" /><h3 className="text-lg font-semibold">Your library starts with your STL.</h3><p className="mt-2 text-sm leading-6">Create in Meshy, import the exported file, then confirm its units and dimensions to save it here.</p></div>}
      <div className="grid items-start gap-5 xl:grid-cols-2">{entries.map((entry) => <CreationCard key={entry.id} entry={entry} mode={mode} farms={farms} sampleFarmId={myShop?.id} available={available && !loading} sharingAvailable={available && sharingEnabled === true && !loading} shareCreation={shareCreation} revokeShare={revokeShare} onInspect={(value) => withFile(value, "inspect")} onDownload={(value) => withFile(value, "download")} onPrepare={(value) => withFile(value, "prepare")} busy={!!activeOperation} />)}</div>
    </section>
  </div>;
}



