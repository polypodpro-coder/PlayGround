import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Box, Search } from "lucide-react";
import { jobs } from "../../data/mockData";
import { useFarmQuotes } from "../../context/FarmQuoteContext";

export default function Requests() {
  const { drafts } = useFarmQuotes();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [material, setMaterial] = useState("All materials");
  const materials = ["All materials", ...new Set(jobs.map((job) => job.material))];
  const savedCount = jobs.filter((job) => drafts[job.id]).length;
  const visible = useMemo(() => jobs.filter((job) => {
    const matchesMaterial = material === "All materials" || job.material === material;
    const matchesStatus = status === "all" || (status === "saved" ? !!drafts[job.id] : !drafts[job.id]);
    return matchesMaterial && matchesStatus && `${job.fileName} ${job.buyerName} ${job.material}`.toLowerCase().includes(query.trim().toLowerCase());
  }), [query, material, status, drafts]);

  return (
    <div className="app-page stack">
      <header>
        <p className="eyebrow">PRINT FARM / REQUESTS</p>
        <h1 className="page-heading">Good work begins with a clear brief.</h1>
        <p>Review the part, confirm the requirements, and prepare a thoughtful quote.</p>
      </header>
      <section className="panel stack">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="section-heading"><h2>Incoming requests <span className="text-navy/45">({jobs.length})</span></h2><p className="mt-1 text-sm text-navy/60">Sample requests and saved drafts. Drafts remain in memory as you navigate and reset on refresh.</p></div>
          <div className="relative w-full sm:w-80"><Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-navy/45" /><label htmlFor="request-search" className="sr-only">Search sample requests</label><input id="request-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search parts or buyers" className="field w-full" style={{ paddingLeft: 40 }} /></div>
        </div>
        <div className="flex flex-wrap gap-2" aria-label="Filter by material">{materials.map((item) => <button type="button" key={item} aria-pressed={material === item} onClick={() => setMaterial(item)} className={`chip ${material === item ? "chip-active" : ""}`}>{item}</button>)}</div>
        <div className="flex flex-wrap gap-2" aria-label="Filter by draft status">{[{ id: "all", label: "All requests" }, { id: "needed", label: `Needs draft (${jobs.length - savedCount})` }, { id: "saved", label: `Saved drafts (${savedCount})` }].map((item) => <button type="button" key={item.id} aria-pressed={status === item.id} onClick={() => setStatus(item.id)} className={`chip ${status === item.id ? "chip-active" : ""}`}>{item.label}</button>)}</div>
        <div className="grid gap-4 lg:grid-cols-2">
          {visible.map((job) => (
            <Link key={job.id} to={`/owner/requests/${job.id}`} className="group rounded-2xl border border-navy/10 p-5 transition-colors hover:border-accent/50 hover:bg-orange-50/40">
              <div className="flex items-center justify-between gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-xl bg-navy/5 text-accent"><Box size={24} /></div><span className="badge">{drafts[job.id] ? `Sample · Draft revision ${drafts[job.id].revision}` : "Sample · Needs quote"}</span></div>
              <h3 className="mt-5 break-words text-lg font-semibold text-navy group-hover:text-accent">{job.fileName}</h3>
              <p className="mt-1 text-sm text-navy/60">Request from {job.buyerName}</p>
              <div className="my-4 flex flex-wrap gap-2"><span className="chip">{job.material}</span><span className="chip">{job.color}</span><span className="chip">Qty {job.quantity}</span></div>
              <p className="text-sm leading-6 text-navy/70">{job.buyerNotes}</p>
              {drafts[job.id] && <div className="mt-4 rounded-xl bg-navy/5 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm"><span className="font-medium text-navy">Saved subtotal before tax</span><strong className="text-lg text-navy">{new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(drafts[job.id].subtotalCents / 100)}</strong></div>
                <p className="mt-2 text-sm text-navy/65">Whole job + shipping · saved <time dateTime={new Date(drafts[job.id].savedAt).toISOString()}>{new Date(drafts[job.id].savedAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</time></p>
              </div>}
              <div className="mt-5 flex items-center justify-between gap-3 border-t border-navy/10 pt-4 text-sm"><span className="text-navy/60">{job.dimensions.x} × {job.dimensions.y} × {job.dimensions.z} mm</span><span className="inline-flex items-center gap-2 font-semibold text-accent">{drafts[job.id] ? "Edit draft" : "Review"} <ArrowRight size={17} /></span></div>
            </Link>
          ))}
        </div>
        {visible.length === 0 && <div className="empty-state"><Search size={30} className="mx-auto mb-3 text-navy/35" /><h3 className="font-semibold">No matching requests</h3><p className="mt-2">Try another material, draft status, or a shorter search.</p><button type="button" className="button button-secondary mt-4" onClick={() => { setQuery(""); setMaterial("All materials"); setStatus("all"); }}>Clear filters</button></div>}
      </section>
    </div>
  );
}





