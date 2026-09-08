import { useEffect, useRef, useState } from "react";
import { ExternalLink, KeyRound, X } from "lucide-react";
import { DEFAULT_MESHY_PROXY_URL, MESHY_DASHBOARD_URL, readMeshySettings, saveMeshySettings, clearMeshySettings, safeProxyUrl, isPlausibleApiKey } from "../lib/meshySettings";
import { checkMeshyConnection, checkMeshyProxy } from "../services/meshyService";

export default function MeshyKeyModal({ onClose, onSaved }) {
  const [initial] = useState(readMeshySettings);
  const [apiKey, setApiKey] = useState(initial.apiKey);
  const [proxyUrl, setProxyUrl] = useState(initial.proxyUrl);
  const [reveal, setReveal] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const dialogRef = useRef(null);
  const firstFieldRef = useRef(null);
  const requestRef = useRef(null);

  useEffect(() => {
    const previousFocus = document.activeElement;
    firstFieldRef.current?.focus();
    const onKey = (event) => {
      if (event.key === "Escape") onClose?.();
      if (event.key !== "Tab") return;
      const fields = [...dialogRef.current.querySelectorAll('button, input, a[href], summary')].filter(el => !el.disabled && el.getClientRects().length);
      const first = fields[0];
      const last = fields.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      requestRef.current?.abort();
      window.removeEventListener("keydown", onKey);
      previousFocus?.focus();
    };
  }, [onClose]);

  function changed(setter, value) { setter(value); setError(""); setMessage(""); }

  async function check(saveAfter) {
    if (requestRef.current) return;
    setError(""); setMessage("");
    const normalizedProxy = safeProxyUrl(proxyUrl);
    if (!normalizedProxy) { setError("Use an HTTPS service URL without a query, #fragment, or embedded login. You can restore the Poly Pod Pro service below."); return; }
    if (saveAfter && !isPlausibleApiKey(apiKey)) { setError("Enter the API key from your Meshy dashboard. Paste only the key, without spaces or a Bearer prefix."); return; }
    const controller = new AbortController();
    requestRef.current = controller;
    setBusy(true);
    try {
      if (saveAfter) {
        await checkMeshyConnection({ proxyUrl: normalizedProxy, apiKey, signal: controller.signal });
        if (!saveMeshySettings({ apiKey, proxyUrl: normalizedProxy })) throw new Error("The connection works, but this browser blocked saving settings. Allow site storage and try again.");
        onSaved?.(readMeshySettings());
      } else {
        await checkMeshyProxy({ proxyUrl: normalizedProxy, signal: controller.signal });
        setMessage("Service reachable from this browser. No API key was sent and no model was generated. Connect your account below to check your key.");
      }
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure.message || "Connection check failed. Please try again.");
    } finally {
      if (!controller.signal.aborted) setBusy(false);
      requestRef.current = null;
    }
  }

  function clear() {
    clearMeshySettings();
    setApiKey(""); setProxyUrl(DEFAULT_MESHY_PROXY_URL); setError("");
    setMessage("Cleared from this browser.");
    onSaved?.(readMeshySettings());
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-navy/40" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="meshy-settings-title" className="flex h-full w-full max-w-md flex-col gap-5 overflow-y-auto bg-surface p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2"><KeyRound size={20} className="text-accent" /><h2 id="meshy-settings-title" className="text-lg font-semibold">Connect your Meshy account</h2></div>
          <button type="button" className="chip" aria-label="Close settings" onClick={() => onClose?.()}><X size={18} /></button>
        </div>
        <p className="text-sm leading-6 text-navy/70">Use your own Meshy API key and API credits. The connection service is already set up; you do not need to deploy anything.</p>
        <div className="rounded-xl border border-navy/10 bg-navy/[.025] p-4 text-sm">
          <p className="font-semibold">{proxyUrl === DEFAULT_MESHY_PROXY_URL ? "Poly Pod Pro connection service" : "Custom connection service"}</p>
          <p className="mt-1 break-all text-xs text-navy/65">{safeProxyUrl(proxyUrl) ? new URL(proxyUrl).hostname : "Check the service URL below"}</p>
          <button type="button" className="mt-3 button button-secondary" disabled={busy} onClick={() => check(false)}>{busy ? "Checking…" : "Check service"}</button>
        </div>
        <form onSubmit={(event) => { event.preventDefault(); check(true); }} className="stack">
          <label className="field"><span>Meshy API key</span><input ref={firstFieldRef} type={reveal ? "text" : "password"} value={apiKey} disabled={busy} onChange={(e) => changed(setApiKey, e.target.value)} autoComplete="off" spellCheck={false} placeholder="Paste your Meshy API key" /></label>
          <label className="flex items-center gap-2 text-sm text-navy/70"><input type="checkbox" className="h-4 w-4 accent-accent" checked={reveal} onChange={(e) => setReveal(e.target.checked)} /> Show key</label>
          <a href={MESHY_DASHBOARD_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm font-semibold text-accent">Get your API key from Meshy <ExternalLink size={15} /></a>
          <p className="text-xs leading-5 text-navy/65">Your key is saved in this browser and sent through the selected service to Meshy. The service operator can receive it. Only use a service you trust, and clear your key on shared computers.</p>
          <details open={initial.proxyUrl !== DEFAULT_MESHY_PROXY_URL} className="rounded-xl border border-navy/10 p-4">
            <summary className="cursor-pointer text-sm font-semibold">Advanced: custom proxy</summary>
            <label className="field mt-4"><span>Proxy URL (Cloudflare Worker)</span><input type="url" value={proxyUrl} disabled={busy} onChange={(e) => changed(setProxyUrl, e.target.value)} autoComplete="off" spellCheck={false} /></label>
            <button type="button" className="mt-3 text-sm font-semibold text-accent underline" disabled={busy} onClick={() => changed(setProxyUrl, DEFAULT_MESHY_PROXY_URL)}>Use Poly Pod Pro service</button>
          </details>
          {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
          {message && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">{message}</p>}
          <div className="mt-2 flex flex-wrap gap-3">
            <button type="submit" className="button" disabled={busy}>{busy ? "Checking…" : "Check connection & save"}</button>
            <button type="button" className="button button-secondary" disabled={busy} onClick={clear}>Clear key</button>
          </div>
          <p className="text-xs leading-5 text-navy/55">Checking the connection reads your Meshy task list. It does not start a generation. Generating models uses your account's API credits.</p>
        </form>
      </div>
    </div>
  );
}
