import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, Check, Image as ImageIcon, Settings, Sparkles, UploadCloud, WandSparkles, X } from "lucide-react";
import MeshyKeyModal from "./MeshyKeyModal";
import { readMeshySettings, isMeshyConfigured } from "../lib/meshySettings";
import { validateImageFile, readImageAsDataUri } from "../lib/meshyImage";
import { createTask, pollTask, extractStlUrl, downloadStlFile } from "../services/meshyService";

const STATUS_LABEL = {
  starting: "Sending your request to Meshy…",
  polling: "Generating your model…",
  downloading: "Downloading the finished STL…",
};

// Native Bring-Your-Own-Key Meshy generation workspace. Produces an STL File and
// hands it to the parent (onGenerated) to flow into the existing review/quote path.
export default function MeshyGenerator({ onGenerated, disabled = false }) {
  const [mode, setMode] = useState("text");
  const [prompt, setPrompt] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [imageDataUri, setImageDataUri] = useState("");
  const [imageError, setImageError] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [configured, setConfigured] = useState(() => isMeshyConfigured(readMeshySettings()));
  const [phase, setPhase] = useState("idle"); // idle | starting | polling | downloading | done | error
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef(null);
  const abortRef = useRef(null);
  const busy = phase === "starting" || phase === "polling" || phase === "downloading";
  const closeSettings = useCallback(() => setSettingsOpen(false), []);

  useEffect(() => () => abortRef.current?.abort(), []);

  function refreshConfigured(next) { setConfigured(isMeshyConfigured(next || readMeshySettings())); }

  async function chooseImage(files) {
    const file = files?.[0];
    if (!file) return;
    setImageError(""); setError("");
    const problem = validateImageFile(file);
    if (problem) { setImageError(problem); setImageFile(null); setImageDataUri(""); return; }
    try {
      const dataUri = await readImageAsDataUri(file);
      setImageFile(file); setImageDataUri(dataUri);
    } catch (failure) {
      setImageError(failure.message || "That image could not be read."); setImageFile(null); setImageDataUri("");
    }
  }

  function clearImage() { setImageFile(null); setImageDataUri(""); setImageError(""); if (inputRef.current) inputRef.current.value = ""; }

  function cancel() { abortRef.current?.abort(); }

  async function generate(event) {
    event.preventDefault();
    setError("");
    const settings = readMeshySettings();
    if (!isMeshyConfigured(settings)) { setSettingsOpen(true); setError("Connect your Meshy account to generate. The connection service is already set up."); return; }
    if (mode === "text" && !prompt.trim()) { setError("Enter a prompt describing the model you want."); return; }
    if (mode === "image" && !imageDataUri) { setError("Add a reference image to generate from."); return; }

    const controller = new AbortController();
    abortRef.current = controller;
    setPhase("starting"); setProgress(0); setStatus(STATUS_LABEL.starting);
    try {
      const kind = mode === "image" ? "image" : "text";
      const taskId = await createTask({ proxyUrl: settings.proxyUrl, apiKey: settings.apiKey, kind, prompt, imageDataUri, signal: controller.signal });
      setPhase("polling"); setStatus(STATUS_LABEL.polling);
      const task = await pollTask({
        proxyUrl: settings.proxyUrl, apiKey: settings.apiKey, kind, taskId, signal: controller.signal,
        onProgress: (value) => setProgress(value),
      });
      const stlUrl = extractStlUrl(task);
      if (!stlUrl) throw new Error("Meshy finished but did not return an STL. Try again, or check your plan's export options.");
      setPhase("downloading"); setStatus(STATUS_LABEL.downloading);
      const baseName = mode === "text" ? prompt.trim().slice(0, 40).replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "") : (imageFile?.name || "reference").replace(/\.[^.]+$/, "");
      const file = await downloadStlFile({ proxyUrl: settings.proxyUrl, stlUrl, fileName: `${baseName || "meshy-model"}.stl`, signal: controller.signal });
      setPhase("done"); setProgress(100); setStatus("");
      onGenerated?.(file, { source: kind === "image" ? "meshy-image-to-3d" : "meshy-text-to-3d", prompt: prompt.trim() });
    } catch (failure) {
      if (controller.signal.aborted) { setPhase("idle"); setStatus(""); setProgress(0); return; }
      setPhase("error"); setStatus(""); setError(failure.message || "Generation failed. Try again.");
    } finally {
      abortRef.current = null;
    }
  }

  return (
    <section className="panel stack">
      <div className="flex items-start justify-between gap-3">
        <div><p className="eyebrow">01 / CREATE WITH MESHY</p><h2 className="section-heading mt-2">Generate a model, right here.</h2></div>
        <button type="button" className="chip" aria-label="Meshy generation settings" disabled={busy} onClick={() => setSettingsOpen(true)}><Settings size={18} /></button>
      </div>
      <p className="text-sm leading-6 text-navy/65">Use your own Meshy account to turn a prompt or an image into an STL without leaving this page. Requests go through the connection service using your own API credits.</p>

      {!configured && <div className="rounded-xl bg-navy/5 p-4 text-sm leading-6"><p className="font-medium">The connection service is ready. Add your Meshy API key to start.</p><button type="button" className="mt-3 button button-secondary" onClick={() => setSettingsOpen(true)}><Settings size={16} /> Connect Meshy</button></div>}
      {configured && <p className="text-sm text-navy/65">Meshy key saved on this device. You can check the connection in settings.</p>}

      <div className="flex gap-2" role="tablist" aria-label="Generation mode">
        <button type="button" role="tab" aria-selected={mode === "text"} className={`chip ${mode === "text" ? "chip-active" : ""}`} disabled={busy} onClick={() => setMode("text")}><WandSparkles size={16} /> Text to 3D</button>
        <button type="button" role="tab" aria-selected={mode === "image"} className={`chip ${mode === "image" ? "chip-active" : ""}`} disabled={busy} onClick={() => setMode("image")}><ImageIcon size={16} /> Image to 3D</button>
      </div>

      <form onSubmit={generate} className="stack">
        {mode === "text" ? (
          <label className="field"><span>Describe your model</span><textarea rows={3} maxLength={600} value={prompt} disabled={busy} onChange={(e) => setPrompt(e.target.value)} placeholder="A faceted geometric planter with drainage holes" /></label>
        ) : (
          <div className="stack">
            {imageDataUri ? (
              <div className="flex items-center gap-3 rounded-xl border border-navy/10 bg-navy/[.025] p-3">
                <img src={imageDataUri} alt="Reference preview" className="h-16 w-16 rounded-lg object-cover" />
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{imageFile?.name}</p><p className="text-xs text-navy/60">{((imageFile?.size || 0) / 1024).toFixed(0)} KB · read locally as Base64</p></div>
                <button type="button" className="chip" aria-label="Remove image" disabled={busy} onClick={clearImage}><X size={18} /></button>
              </div>
            ) : (
              <button type="button" disabled={busy} onClick={() => inputRef.current?.click()} className="rounded-2xl border-2 border-dashed border-navy/20 bg-navy/[.025] px-5 py-8 text-center transition hover:border-accent"><UploadCloud size={30} className="mx-auto mb-3 text-accent" /><span className="block text-sm font-semibold">Choose a reference image</span><span className="mt-1 block text-xs text-navy/60">PNG, JPG, or WebP · up to 8 MB · read on this device</span></button>
            )}
            <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" aria-label="Choose a reference image" onChange={(e) => { chooseImage(e.target.files); e.target.value = ""; }} />
            {imageError && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{imageError}</p>}
          </div>
        )}

        {busy && (
          <div className="rounded-xl bg-navy/5 p-4" role="status" aria-live="polite">
            <div className="flex items-center justify-between text-sm"><span className="font-medium">{status}</span><span className="tabular-nums text-navy/60">{progress}%</span></div>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-navy/10"><div className="h-full rounded-full bg-accent transition-all duration-500" style={{ width: `${Math.max(4, progress)}%` }} /></div>
            <button type="button" className="mt-3 text-sm font-semibold text-navy/70 underline" onClick={cancel}>Stop waiting</button>
            <p className="mt-1 text-xs text-navy/60">Stopping here does not cancel a task already submitted to Meshy or refund its credits.</p>
          </div>
        )}

        {phase === "done" && <p role="status" className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900"><Check size={16} /> Model ready — review its units and dimensions on the right, then prepare a quote.</p>}
        {error && <p role="alert" className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-800"><AlertCircle size={16} className="mt-0.5 shrink-0" /> {error}</p>}

        {!busy && <button type="submit" className="button" disabled={disabled}><Sparkles size={17} /> Generate model</button>}
      </form>

      <p className="text-xs leading-5 text-navy/55">Generation uses your Meshy plan and credits. A generated mesh still needs unit confirmation and farm review before printing.</p>

      {settingsOpen && <MeshyKeyModal onClose={closeSettings} onSaved={(next) => { refreshConfigured(next); setError(""); setSettingsOpen(false); }} />}
    </section>
  );
}
