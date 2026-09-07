import { Link } from "react-router-dom";
import { ArrowRight, Box, CircleDollarSign, ClipboardList, Printer, Settings2 } from "lucide-react";
import ShopLogo from "../../components/ShopLogo";
import { earnings, jobs, ownerPrinters } from "../../data/mockData";
import { useApp } from "../../context/AppContext";

export default function Dashboard() {
  const { myShop } = useApp();
  const pendingJobs = jobs.filter((job) => job.status === "pending");
  const availableCount = ownerPrinters.filter((printer) => printer.status === "available").length;

  return (
    <div className="app-page stack">
      <header className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="eyebrow">PRINT FARM WORKSPACE</p>
          <h1 className="page-heading">Your next great print starts here.</h1>
          <p>Review requests, shape your quotes, and keep your farm organized.</p>
        </div>
        <Link to="/owner/settings" className="button button-secondary"><Settings2 size={18} /> Farm settings</Link>
      </header>

      <section className="panel flex flex-wrap items-center justify-between gap-5">
        <div className="flex items-center gap-4">
          <ShopLogo src={myShop.logoUrl} alt="Sample farm logo" size="lg" />
          <div>
            <span className="badge">Sample farm</span>
            <h2 className="mt-2 text-xl font-semibold text-navy">{myShop.name}</h2>
            <p className="mt-1 text-sm text-navy/60">{myShop.shopPaused ? "Preview availability: paused" : "Preview availability: accepting requests"}</p>
          </div>
        </div>
        <p className="max-w-md text-sm leading-6 text-navy/65">This workspace uses example data. No buyers are contacted, machines connected, or payments processed.</p>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Sample weekly sales", value: `$${earnings.weekTotal.toFixed(2)}`, detail: "Gross, before costs and fees", icon: CircleDollarSign },
          { label: "Requests to review", value: pendingJobs.length, detail: "Example quote opportunities", icon: ClipboardList },
          { label: "Sample completed jobs", value: earnings.jobsCompletedMonth, detail: "Illustrative monthly activity", icon: Box },
          { label: "Available machines", value: `${availableCount} / ${ownerPrinters.length}`, detail: "Sample status, no telemetry", icon: Printer },
        ].map(({ label, value, detail, icon: Icon }) => (
          <div key={label} className="panel">
            <div className="flex items-center justify-between gap-3 text-sm text-navy/65"><span>{label}</span><Icon size={19} className="text-accent" /></div>
            <p className="my-3 text-3xl font-semibold tracking-tight text-navy">{value}</p>
            <p className="text-sm text-navy/60">{detail}</p>
          </div>
        ))}
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[1.5fr_1fr]">
        <section className="panel">
          <div className="section-heading flex flex-wrap items-center justify-between gap-3">
            <div><p className="eyebrow">THE WORKBENCH</p><h2>Requests worth a closer look</h2></div>
            <Link to="/owner/requests" className="button button-secondary">All requests <ArrowRight size={17} /></Link>
          </div>
          <div className="mt-5 divide-y divide-navy/10">
            {pendingJobs.map((job) => (
              <Link key={job.id} to={`/owner/requests/${job.id}`} className="group flex items-center gap-4 py-5 first:pt-0 last:pb-0">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-navy/5 text-accent"><Box size={24} /></div>
                <div className="min-w-0 flex-1"><h3 className="break-words font-semibold text-navy group-hover:text-accent">{job.fileName}</h3><p className="mt-1 text-sm text-navy/65">{job.buyerName} · {job.material} · {job.quantity} {job.quantity === 1 ? "part" : "parts"}</p></div>
                <ArrowRight size={20} className="shrink-0 text-navy/45" />
              </Link>
            ))}
            {pendingJobs.length === 0 && <p className="empty-state">No sample requests match this workspace.</p>}
          </div>
        </section>

        <div className="stack">
          <section className="panel">
            <div className="section-heading"><p className="eyebrow">YOUR CAPACITY</p><h2>Sample fleet</h2></div>
            <div className="mt-4 divide-y divide-navy/10">
              {ownerPrinters.map((printer) => <div key={printer.id} className="flex flex-wrap items-center justify-between gap-2 py-3"><span className="text-sm font-medium text-navy">{printer.name}</span><span className="badge capitalize">{printer.status}</span></div>)}
            </div>
            <Link to="/owner/settings" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-accent">Explore fleet controls <ArrowRight size={16} /></Link>
          </section>
          <section className="rounded-2xl bg-navy p-6 text-white">
            <p className="text-sm font-semibold uppercase tracking-widest text-orange-300">Before your first live job</p>
            <h2 className="mt-3 text-2xl font-semibold">Build trust into the workflow.</h2>
            <p className="mt-3 text-sm leading-6 text-white/75">Hosted account setup, seller onboarding, and approved marketplace policies must be ready before orders open.</p>
            <Link to="/account" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-white underline underline-offset-4">Review account readiness <ArrowRight size={16} /></Link>
          </section>
        </div>
      </div>
    </div>
  );
}


