import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Box, File, Image, Layers, LockKeyhole, UploadCloud, X } from "lucide-react";
import ModelPreviewer, { MAX_STL_BYTES } from "../../components/ModelPreviewer";
import { isCurrentModelInfo, STL_UNIT_TO_MM } from "../../lib/stlUnits";
import { FULFILLMENT_METHODS, fulfillmentLabel } from "../../lib/fulfillment";
import { useApp } from "../../context/AppContext";
import { MATERIALS, MATERIAL_MULTIPLIERS, FLEET_MACHINES, POST_PROCESSING_ADDONS, featuredDesigns } from "../../data/mockData";

const SAMPLES = [
  { id: "planter", name: "Faceted vessel", desc: "A small decorative vessel", dimensions: { x: 60, y: 60, z: 70 }, grams: 40 },
  { id: "organizer", name: "Desk frame", desc: "An open rectangular frame", dimensions: { x: 80, y: 55, z: 25 }, grams: 30 },
  { id: "tile", name: "Hexagon tile", desc: "A geometric display piece", dimensions: { x: 70, y: 70, z: 5 }, grams: 20 },
];
function localDate() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }

export default function RequestUpload() {
  const navigate = useNavigate();
  const { request, setRequest, directRequestPrinterId, setDirectRequestPrinterId, selectedDesign, setSelectedDesign, printers, selectedMaterial, setSelectedMaterial, selectedMachineId, setSelectedMachineId, selectedAddons, toggleAddon } = useApp();
  const targetShop = printers.find((p) => p.id === directRequestPrinterId);
  const inputRef = useRef(null);
  const [file, setFile] = useState(selectedDesign ? null : request?.localFile || null), [photoUrl, setPhotoUrl] = useState(null), [sample, setSample] = useState(selectedDesign ? null : SAMPLES.find((item) => item.id === request?.sampleModelType) || null);
  const [catalogDesign, setCatalogDesign] = useState(selectedDesign || featuredDesigns.find((item) => item.id === request?.designId) || null);
  const [modelInfo, setModelInfo] = useState(null), [fileError, setFileError] = useState(""), [formError, setFormError] = useState("");
  const [sourceUnits, setSourceUnits] = useState(!selectedDesign && Object.hasOwn(STL_UNIT_TO_MM, request?.sourceUnits) ? request.sourceUnits : "mm");
  const [neededBy, setNeededBy] = useState(request?.neededBy || ""), [notes, setNotes] = useState(request?.notes || "");
  const [fulfillmentPreference, setFulfillmentPreference] = useState(request?.fulfillmentPreference || "any");
  const [quantity, setQuantity] = useState(request?.quantity || 1), [grams, setGrams] = useState(request?.estimatedGrams || selectedDesign?.estimatedGrams || 40);
  const [intendedUse, setIntendedUse] = useState(request?.intendedUse || "decorative"), [confirmed, setConfirmed] = useState(false), [dragging, setDragging] = useState(false);
  const isSTL = !!file && /\.stl$/i.test(file.name);
  const isPhoto = !!file && /\.(png|jpe?g|webp)$/i.test(file.name);
  const modelInfoIsCurrent = isCurrentModelInfo(modelInfo, { file: isSTL ? file : null, sourceUnits, modelType: sample?.id });
  const sourceName = file?.name || catalogDesign?.name || sample?.name;
  const selectedMachine = FLEET_MACHINES.find((m) => m.id === selectedMachineId);
  const materialCompatible = !selectedMachine || selectedMachine.materials.includes(selectedMaterial);
  const addonTotal = (selectedAddons || []).reduce((sum, id) => sum + (POST_PROCESSING_ADDONS.find((a) => a.id === id)?.cost || 0), 0) * Number(quantity || 1);
  const materialCost = Math.max(0, Number(grams)) * (MATERIAL_MULTIPLIERS[selectedMaterial]?.rate || 0.08) * Number(quantity || 1);

  useEffect(() => {
    // eslint-disable-next-line react/set-state-in-effect -- Object URLs are browser resources with paired creation and cleanup.
    if (!isPhoto) { setPhotoUrl(null); return; }
    const url = URL.createObjectURL(file); setPhotoUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file, isPhoto]);

  function clearSource() { setFile(null); setSample(null); setCatalogDesign(null); setSelectedDesign(null); setModelInfo(null); setSourceUnits("mm"); setFileError(""); if (inputRef.current) inputRef.current.value = ""; }
  function chooseUnits(value) { setModelInfo(null); setSourceUnits(value); setFormError(""); }
  function chooseFile(files) {
    const next = files?.[0]; if (!next) return;
    if (files.length > 1) { setFileError("Choose one model or reference at a time."); return; }
    if (!next.size || next.size > MAX_STL_BYTES) { setFileError("Choose a non-empty file no larger than 10 MB."); return; }
    if (!/\.(stl|obj|step|stp|3mf|png|jpe?g|webp)$/i.test(next.name)) { setFileError("Supported: STL, OBJ, STEP, 3MF, JPG, PNG, and WebP. For 3D viewing, export an STL."); return; }
    clearSource(); setFile(next);
  }
  function chooseSample(next) { clearSource(); setSample(next); setGrams(next.grams); }
  function chooseMaterial(material) {
    setSelectedMaterial(material);
    if (!selectedMachine?.materials.includes(material)) {
      const compatible = FLEET_MACHINES.find((machine) => machine.materials.includes(material));
      setSelectedMachineId(compatible?.id || "");
    }
  }
  function submit(event) {
    event.preventDefault(); setFormError("");
    if (!sourceName) { setFormError("Add a file, a reference, or a sample to continue."); return; }
    if ((isSTL || sample) && !modelInfoIsCurrent) { setFormError("Wait for the model to load with the selected units, or choose a valid STL if the viewer reports an error."); return; }
    if (!Number.isInteger(Number(quantity)) || quantity < 1 || quantity > 100 || !Number.isFinite(Number(grams)) || grams < 1 || grams > 10000) { setFormError("Enter 1–100 pieces and a sample weight between 1 and 10,000 grams."); return; }
    if (!materialCompatible) { setFormError("Choose a machine that lists this material, or let the farm choose."); return; }
    if (neededBy && neededBy < localDate()) { setFormError("Choose today or a future target date."); return; }
    if (intendedUse === "restricted" || !confirmed) { setFormError("This preview supports decorative and non-safety-critical prototype requests only. Confirm the intended use to continue."); return; }
    setRequest({
      fileName: sample ? `${sample.name}.stl` : sourceName, directRequestPrinterId, designId: catalogDesign?.id || null, localFile: file,
      sourceType: sample ? "procedural-sample" : catalogDesign ? "catalog-reference" : isPhoto ? "photo-reference" : isSTL ? "local-stl" : "cad-reference",
      ...(file && file === request?.localFile && request?.creationId ? { creationId: request.creationId, creationSource: request.creationSource } : {}),
      material: selectedMaterial, selectedMachineId, selectedAddons: [...(selectedAddons || [])],
      neededBy, notes: notes.trim(), estimatedGrams: Number(grams), estimateBasis: "user-supplied-example", quantity: Number(quantity), intendedUse, fulfillmentPreference,
      units: modelInfoIsCurrent ? "mm" : null, sourceUnits: modelInfoIsCurrent ? modelInfo.sourceUnits : null, dimensions: modelInfoIsCurrent ? { ...modelInfo.dimensions } : null, sampleModelType: sample?.id || null,
    });
    navigate("/quotes");
  }

  return <div className="app-page">
    <button type="button" className="button-secondary mb-5" onClick={() => navigate("/")}><ArrowLeft size={16} /> Marketplace</button>
    <header className="page-intro"><div><p className="eyebrow">01 / Configure your part</p><h1 className="page-heading">From your idea to a print.</h1><p className="body-copy">Bring a model or a reference. Explore materials, finishing, and example farm quotes.</p></div><span className="badge">Preview request</span></header>
    <form onSubmit={submit} className="grid items-start gap-7 lg:grid-cols-[minmax(0,1.55fr)_minmax(280px,1fr)]">
      <div className="stack min-w-0">
        <section className="panel">
          <div className="section-row"><div><p className="eyebrow">Your starting point</p><h2 className="section-heading">Choose a part</h2></div><span className="badge"><LockKeyhole size={13} /> Local only</span></div>
          <p className="mb-5 text-sm leading-relaxed text-navy/65">Files are read on this device. Nothing is uploaded or sent to a print farm in this preview.</p>
          {sourceName ? <div className="mb-5 flex items-center gap-3 rounded-xl border border-navy/10 bg-navy/5 p-4"><File size={22} className="shrink-0 text-accent" /><div className="min-w-0 flex-1"><p className="break-words font-semibold">{sourceName}</p><p className="text-xs text-navy/60">{file ? `${(file.size / 1024).toFixed(0)} KB · selected on this device` : sample ? "Procedural sample geometry" : "Catalog concept reference; no source mesh attached"}</p></div><button type="button" className="chip" onClick={clearSource} aria-label="Remove selected part"><X size={18} /></button></div> : null}
          {isSTL && <div className="mb-5 rounded-xl border border-navy/10 bg-navy/[.025] p-4"><label className="field"><span>STL source units</span><select value={sourceUnits} onChange={(event) => chooseUnits(event.target.value)} aria-describedby="stl-units-help"><option value="mm">Millimeters (mm)</option><option value="cm">Centimeters (cm)</option><option value="in">Inches (in)</option></select></label><p id="stl-units-help" className="mt-3 text-sm leading-relaxed text-navy/65">STL files do not identify their units. Millimeters is the default assumption. Select the units used when exporting from your CAD tool, then check the physical dimensions below. Exports from this viewer use mm.</p><p className="mt-2 text-xs text-navy/60">Changing units does not calculate print weight or confirm that the part is printable.</p></div>}
          {(isSTL || sample) && <ModelPreviewer file={isSTL ? file : null} sourceUnits={isSTL ? sourceUnits : "mm"} modelType={sample?.id} dimensions={sample?.dimensions} materialName={selectedMaterial} title={sourceName} onModelInfo={setModelInfo} />}
          {isPhoto && photoUrl && <div className="overflow-hidden rounded-xl border border-navy/10"><img src={photoUrl} alt="Your reference, viewed locally" className="max-h-72 w-full bg-navy/5 object-contain" onError={() => { setFile(null); setFileError("The browser could not open this image. Export a valid JPG, PNG, or WebP."); }} /><p className="p-4 text-sm text-navy/65">Photo reference only. To turn an image into a model, <Link to="/create" className="font-semibold text-accent underline">open the Meshy creation studio</Link>, then return with an STL for farm review.</p></div>}
          {file && !isPhoto && !isSTL && <div className="rounded-xl bg-navy/5 p-5 text-sm leading-relaxed text-navy/70"><Box size={24} className="mb-3 text-accent" />This CAD file is a reference for the example request. The preview does not parse OBJ, STEP, or 3MF. Export an STL to inspect the actual geometry here.</div>}
          {!sourceName && <div onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(e) => { e.preventDefault(); setDragging(false); chooseFile(e.dataTransfer.files); }} className={`rounded-2xl border-2 border-dashed px-5 py-10 text-center transition ${dragging ? "border-accent bg-accent/10" : "border-navy/20 bg-navy/[.025]"}`}>
            <UploadCloud size={36} className="mx-auto mb-4 text-accent" /><h3 className="text-xl font-semibold">Drop a model or reference</h3><p className="mb-5 mt-2 text-sm text-navy/60">STL for a 3D preview · CAD or photos as references<br />One file, up to 10 MB · up to 150,000 STL triangles</p><button className="button" type="button" onClick={() => inputRef.current?.click()}>Choose a file <ArrowRight size={16} /></button>
          </div>}
          <input ref={inputRef} type="file" accept=".stl,.obj,.step,.stp,.3mf,.png,.jpg,.jpeg,.webp" onChange={(e) => chooseFile(e.target.files)} className="sr-only" aria-label="Choose a local model or reference" />
          {fileError && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">{fileError}</p>}
          <div className="mt-5"><p className="mb-3 text-sm font-semibold">Or explore a sample</p><div className="grid gap-2 sm:grid-cols-3">{SAMPLES.map((item) => <button type="button" key={item.id} onClick={() => chooseSample(item)} aria-pressed={sample?.id === item.id} className={`rounded-xl border p-4 text-left transition hover:border-accent ${sample?.id === item.id ? "border-accent bg-accent/5" : "border-navy/10"}`}><Box size={20} className="mb-3 text-accent" /><span className="block text-sm font-semibold">{item.name}</span><span className="mt-1 block text-xs leading-relaxed text-navy/60">{item.desc}</span></button>)}</div></div>
        </section>
        <section className="panel">
          <div className="section-row"><div><p className="eyebrow">Make it yours</p><h2 className="section-heading">Material & equipment</h2></div><Layers className="text-accent" size={23} /></div>
          <fieldset><legend className="mb-3 text-sm font-semibold">Preferred material</legend><div className="flex flex-wrap gap-2">{MATERIALS.map((material) => <button type="button" key={material} className={`chip ${selectedMaterial === material ? "chip-active" : ""}`} aria-pressed={selectedMaterial === material} onClick={() => chooseMaterial(material)}>{material}</button>)}</div></fieldset>
          <p className="my-4 text-sm leading-relaxed text-navy/65">{MATERIAL_MULTIPLIERS[selectedMaterial]?.desc} Actual grade, suitability, finish, and tolerances require seller confirmation.</p>
          <label className="field"><span>Preferred equipment</span><select value={selectedMachineId || ""} onChange={(e) => setSelectedMachineId(e.target.value)}><option value="">Let the farm recommend equipment</option>{FLEET_MACHINES.map((machine) => <option key={machine.id} value={machine.id} disabled={!machine.materials.includes(selectedMaterial)}>{machine.name}{machine.materials.includes(selectedMaterial) ? "" : " · material not listed"}</option>)}</select></label>
          <p className="mt-3 text-xs leading-relaxed text-navy/60">Equipment preferences are illustrative. They do not confirm a farm’s capacity or a part’s manufacturability.</p>
          <fieldset className="mt-6"><legend className="mb-3 text-sm font-semibold">Optional finishing</legend><div className="grid gap-3">{POST_PROCESSING_ADDONS.map((addon) => <label key={addon.id} className="flex cursor-pointer items-start gap-3 rounded-xl border border-navy/10 p-4"><input className="mt-1 h-4 w-4 accent-orange-600" type="checkbox" checked={(selectedAddons || []).includes(addon.id)} onChange={() => toggleAddon(addon.id)} /><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{addon.name}</span><span className="mt-1 block text-xs text-navy/60">Scope and suitability to be agreed with the farm.</span></span><span className="text-sm font-semibold">${addon.cost.toFixed(2)}<span className="block text-xs font-normal text-navy/50">per piece · example</span></span></label>)}</div></fieldset>
        </section>
        <section className="panel">
          <div className="section-row"><div><p className="eyebrow">Define the request</p><h2 className="section-heading">Project details</h2></div></div>
          <div className="form-grid"><label className="field"><span>Quantity</span><input type="number" min="1" max="100" step="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} required /></label><label className="field"><span>Target date <span className="font-normal text-navy/50">(optional)</span></span><input type="date" min={localDate()} value={neededBy} onChange={(e) => setNeededBy(e.target.value)} /></label></div>
          <label className="field mt-5"><span>How would you like to receive it?</span><select value={fulfillmentPreference} onChange={(e) => setFulfillmentPreference(e.target.value)}><option value="any">Compare all offered methods</option>{FULFILLMENT_METHODS.map(({id,label}) => <option key={id} value={id}>{label}</option>)}</select></label>
          <p className="mt-2 text-sm leading-relaxed text-navy/60">Quotes match the methods each sample farm offers. Local pickup or drop-off still needs agreement on coverage, timing, and meeting details. No address is needed here.</p>
          <label className="field mt-5"><span>Intended use</span><select value={intendedUse} onChange={(e) => setIntendedUse(e.target.value)}><option value="decorative">Decorative object or desk accessory</option><option value="prototype">Non-safety-critical visual prototype</option><option value="restricted">Medical, food contact, children’s, load-bearing, or other safety-critical use</option></select></label>
          {intendedUse === "restricted" && <p role="alert" className="mt-3 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">This use is outside the initial marketplace scope. Choose an eligible project to continue; the preview cannot approve it.</p>}
          <label className="field mt-5"><span>Notes for the farm <span className="font-normal text-navy/50">(optional)</span></span><textarea rows={4} maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Desired color, surface finish, dimensions, and questions about the design. Use sample details here." /></label>
          <label className="mt-5 flex items-start gap-3 text-sm leading-relaxed text-navy/70"><input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-orange-600" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} required /><span>I have permission to use this design, and this is a decorative or non-safety-critical prototype request. This preview does not place a real order.</span></label>
        </section>
      </div>
      <aside className="stack lg:sticky lg:top-24">
        <section className="panel"><p className="eyebrow">Your request</p><h2 className="mb-5 mt-2 text-2xl font-bold">A clear brief. Better quotes.</h2>
          {targetShop && <div className="mb-5 rounded-xl bg-navy/5 p-4"><p className="text-xs text-navy/60">Example farm selected</p><p className="mt-1 font-semibold">{targetShop.name}</p><button type="button" className="mt-2 text-sm font-semibold text-accent underline" onClick={() => setDirectRequestPrinterId(null)}>Compare all example farms</button></div>}
          <dl className="space-y-3 text-sm"><div className="flex justify-between gap-4"><dt className="text-navy/60">Part</dt><dd className="max-w-[65%] break-words text-right font-medium">{sourceName || "Choose a part"}</dd></div><div className="flex justify-between"><dt className="text-navy/60">Material</dt><dd className="font-medium">{selectedMaterial}</dd></div><div className="flex justify-between"><dt className="text-navy/60">Quantity</dt><dd className="font-medium">{quantity || "—"}</dd></div><div className="flex justify-between"><dt className="text-navy/60">Finishing</dt><dd className="font-medium">{selectedAddons?.length || 0} selected</dd></div><div className="flex justify-between gap-4"><dt className="text-navy/60">Fulfillment</dt><dd className="text-right font-medium">{fulfillmentPreference === 'any' ? 'Compare all methods' : fulfillmentLabel(fulfillmentPreference)}</dd></div></dl>
          <div className="my-6 border-t border-navy/10 pt-5"><label className="field"><span>Example weight per piece (g)</span><input type="number" min="1" max="10000" step="1" value={grams} onChange={(e) => setGrams(e.target.value)} required /></label><p className="mt-2 text-xs leading-relaxed text-navy/60">A pricing assumption you can change, not a measured or sliced weight. Real quotes require farm review of the file and print settings.</p><p className="mt-4 text-sm text-navy/60">Illustrative material + finishing</p><p className="mt-1 text-3xl font-bold">${Number.isFinite(materialCost + addonTotal) ? (materialCost + addonTotal).toFixed(2) : "—"}</p><p className="mt-1 text-xs text-navy/55">Excludes labor, shipping, and tax. This is not a quote.</p></div>
          {formError && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{formError}</p>}
          <button className="button w-full" type="submit" disabled={intendedUse === "restricted"}>Compare example quotes <ArrowRight size={17} /></button><p className="mt-3 text-center text-xs text-navy/55">No account or payment details needed.</p>
        </section>
        <div className="rounded-2xl bg-navy p-6 text-white"><Image size={23} className="mb-4 text-orange-300" /><h3 className="mb-2 text-lg font-semibold">Starting with a photo?</h3><p className="text-sm leading-relaxed text-white/70">Create a model with your own Meshy account, then import and inspect its STL before asking a farm to quote.</p><Link to="/create" className="mt-4 inline-flex items-center gap-2 font-semibold text-orange-200">Open creation studio <ArrowRight size={16} /></Link></div>
      </aside>
    </form>
  </div>;
}






