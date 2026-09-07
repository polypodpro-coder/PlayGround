import { useEffect, useRef, useState } from "react";
import { ExternalLink, KeyRound, X } from "lucide-react";
import { MESHY_DASHBOARD_URL, readMeshySettings, saveMeshySettings, clearMeshySettings, safeProxyUrl, isPlausibleApiKey } from "../lib/meshySettings";

// Slide-out settings panel for Bring-Your-Own-Key Meshy generation.
// Mounted only while open (by the parent), so state initializes from storage.
// The key and proxy URL are stored only in this browser's localStorage.
export default function MeshyKeyModal({ onClose, onSaved }) {
  const [apiKey, setApiKey] = useState(() => readMeshySettings().apiKey);
  const [proxyUrl, setProxyUrl] = useState(() => readMeshySettings().proxyUrl);
  const [reveal, setReveal] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const dialogRef = useRef(null);
  const firstFieldRef = useRef(null);

  useEffect(() => {
    const timer = setTimeout(() => firstFieldRef.current?.focus(), 30);
    const onKey = (event) => { if (event.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    return () => { clearTimeout(timer); window.removeEventListener("keydown", onKey); };
  }, [onClose]);

  function save(event) {
    event.preventDefault();
    setError(""); setMessage("");
    if (!isPlausibleApiKey(apiKey)) { setError("Enter your Meshy API key (from the Meshy dashboard)."); return; }
    if (!safeProxyUrl(proxyUrl)) { setError("Enter a valid https proxy URL (your deployed Cloudflare Worker)."); return; }
    const ok = saveMeshySettings({ apiKey, proxyUrl });
    if (!ok) { setError("This browser blocked local storage, so the key could not be saved."); return; }
    setMessage("Saved in this browser.");
    onSaved?.(readMeshySettings());
  }

  function clear() {
    clearMeshySettings();
    setApiKey(""); setProxyUrl(""); setError("");
    setMessage("Cleared from this browser.");
    onSaved?.({ apiKey: "", proxyUrl: "" });
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-navy/40" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="meshy-settings-title" className="flex h-full w-full max-w-md flex-col gap-5 overflow-y-auto bg-surface p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2"><KeyRound size={20} className="text-accent" /><h2 id="meshy-settings-title" className="text-lg font-semibold">Meshy generation settings</h2></div>
          <button type="button" className="chip" aria-label="Close settings" onClick={() => onClose?.()}><X size={18} /></button>
        </div>

        <p className="text-sm leading-6 text-navy/70">Bring your own Meshy account. Your key is stored only in this browser and sent to Meshy through your proxy, so Meshy bills your account. Poly Pod Pro never receives your key.</p>

        <form onSubmit={save} className="stack">
          <label className="field">
            <span>Meshy API key</span>
            <input ref={firstFieldRef} type={reveal ? "text" : "password"} value={apiKey} onChange={(e) => setApiKey(e.target.value)} autoComplete="off" spellCheck={false} placeholder="msy_..." />
          </label>
          <label className="flex items-center gap-2 text-sm text-navy/70"><input type="checkbox" className="h-4 w-4 accent-accent" checked={reveal} onChange={(e) => setReveal(e.target.checked)} /> Show key</label>
          <a href={MESHY_DASHBOARD_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm font-semibold text-accent">Get your API key from the Meshy dashboard <ExternalLink size={15} /></a>

          <label className="field mt-4">
            <span>Proxy URL (Cloudflare Worker)</span>
            <input type="url" value={proxyUrl} onChange={(e) => setProxyUrl(e.target.value)} autoComplete="off" spellCheck={false} placeholder="https://your-worker.workers.dev" />
          </label>
          <p className="text-xs leading-5 text-navy/60">Deploy the included <code>serverless-proxy.js</code> as a Cloudflare Worker, then paste its URL here. The browser cannot call Meshy directly (CORS), so requests go through this proxy.</p>

          {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
          {message && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">{message}</p>}

          <div className="mt-2 flex flex-wrap gap-3">
            <button type="submit" className="button">Save settings</button>
            <button type="button" className="button button-secondary" onClick={clear}>Clear key</button>
          </div>
        </form>

        <p className="mt-auto text-xs leading-5 text-navy/55">Security tip: create a key scoped to your own account, and clear it here on shared computers. Generation, plans, and credits are governed by your Meshy account.</p>
      </div>
    </div>
  );
}
