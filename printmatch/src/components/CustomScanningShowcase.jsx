import { useState } from "react";
import { Scan, Sparkles, CheckCircle2, ArrowRight, Layers, Shield, Wrench, Eye } from "lucide-react";

export default function CustomScanningShowcase({ onRequestScan }) {
  const [activeCategory, setActiveCategory] = useState("automotive");
  const [viewMode, setViewMode] = useState("reconstruction"); // 'original' | 'reconstruction'

  const categories = {
    trim: {
      id: "trim",
      tabTitle: "Broken Trim",
      title: "Broken Trim & Architectural Molding",
      subtitle: "Non-Destructive Contactless Metrology",
      sampleName: "1960s Historic Cypress Window Trim Profile",
      originalImage: "https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=600&q=80",
      reconstructedImage: "https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=600&q=80",
      problem: "Original woodwork shattered from storm damage; supplier closed 40 years ago.",
      solution: "Contactless optical photogrammetry captured fragmentary curvature; CAD synthesized contiguous extrusion profile with reinforced fastener bosses.",
      materialUsed: "PETG / ASA Weather-Resistant",
      accuracy: "±0.04mm",
      turnaround: "24-48 Hours",
      tags: ["Architectural Restoration", "Marine Moldings", "Cabinetry Bezels"],
    },
    hardware: {
      id: "hardware",
      tabTitle: "Vintage Hardware",
      title: "Vintage & Obsolete Mechanical Hardware",
      subtitle: "Dimensional Reverse-Engineering",
      sampleName: "Antique Brass Casement Window Sash Latch",
      originalImage: "https://images.unsplash.com/photo-1584992236310-6edddc08acff?auto=format&fit=crop&w=600&q=80",
      reconstructedImage: "https://images.unsplash.com/photo-1581092335397-9583fe92d232?auto=format&fit=crop&w=600&q=80",
      problem: "Cast iron latch snapped at pivot axis; custom replacement quote from machine shop was $340.",
      solution: "Scanned mating halves, restored sheared internal pivot pin geometry in CAD, printed in carbon-fiber reinforced PETG for $24.50.",
      materialUsed: "PETG-CF / Polycarbonate",
      accuracy: "±0.05mm",
      turnaround: "Same-Day Ready",
      tags: ["Door Mechanisms", "Heirloom Hardware", "Industrial Cams"],
    },
    automotive: {
      id: "automotive",
      tabTitle: "Discontinued Auto",
      title: "Discontinued Automotive & Marine Parts",
      subtitle: "High-Temp Under-Hood & Interior Replication",
      sampleName: "Classic Dash AC Vent Louver & Snap Bezel",
      originalImage: "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=600&q=80",
      reconstructedImage: "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=600&q=80",
      problem: "Sun-baked brittle plastic tabs snapped; OEM replacement discontinued by manufacturer in 1998.",
      solution: "Scanned intact vent half and mirrored in CAD with +0.8mm thickened snap-clips. Printed in heat-deflection Polycarbonate (110°C rating).",
      materialUsed: "Polycarbonate / ABS-ESD",
      accuracy: "±0.03mm",
      turnaround: "Same-Day Fabrication",
      tags: ["Dash Louvers", "Bezel Retainers", "Engine Bay Grommets"],
    },
  };

  const current = categories[activeCategory];

  return (
    <section
      className="relative overflow-hidden rounded-3xl border-2 border-accent/30 bg-gradient-to-br from-[#fdf6f0] via-surface to-[#e7eff8] p-4 shadow-sm"
      aria-label="Custom 3D Scanning and Reverse Engineering Showcase"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
              <Sparkles size={10} /> Precision Metrology
            </span>
            <span className="text-[10px] font-semibold text-navy/60">Acadiana Farm Hub</span>
          </div>
          <h2 className="mt-1 text-base font-bold text-navy">Custom 3D Scanning &amp; Replication</h2>
          <p className="text-xs text-navy/70 leading-snug">
            Replicate obsolete, broken, or discontinued components with zero CAD drawings required.
          </p>
        </div>
      </div>

      {/* Category Pills Tabs */}
      <div
        role="tablist"
        aria-label="3D scanning replication categories"
        className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar"
      >
        {Object.values(categories).map((cat) => {
          const isActive = cat.id === activeCategory;
          return (
            <button
              key={cat.id}
              role="tab"
              type="button"
              id={`tab-${cat.id}`}
              aria-selected={isActive}
              aria-controls={`panel-${cat.id}`}
              onClick={() => setActiveCategory(cat.id)}
              className={`btn-chip shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                isActive
                  ? "bg-navy text-white shadow-xs"
                  : "bg-white/80 text-navy/70 hover:bg-white active:scale-95"
              }`}
            >
              {cat.tabTitle}
            </button>
          );
        })}
      </div>

      {/* Visual Comparison Stage */}
      <div
        id={`panel-${current.id}`}
        role="tabpanel"
        aria-labelledby={`tab-${current.id}`}
        className="mt-3 rounded-2xl bg-white p-3.5 shadow-xs border border-navy/10 space-y-3"
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold text-navy">{current.title}</h3>
            <p className="text-[10px] text-navy/50">{current.sampleName}</p>
          </div>

          {/* Before/After Toggle */}
          <div className="flex rounded-lg bg-navy/5 p-0.5 text-[10px] font-semibold">
            <button
              type="button"
              onClick={() => setViewMode("original")}
              aria-pressed={viewMode === "original"}
              className={`rounded-md px-2 py-1 transition-all ${
                viewMode === "original" ? "bg-white text-navy shadow-xs font-bold" : "text-navy/60 hover:text-navy"
              }`}
            >
              Damaged Part
            </button>
            <button
              type="button"
              onClick={() => setViewMode("reconstruction")}
              aria-pressed={viewMode === "reconstruction"}
              className={`rounded-md px-2 py-1 transition-all ${
                viewMode === "reconstruction" ? "bg-accent text-white shadow-xs font-bold" : "text-navy/60 hover:text-navy"
              }`}
            >
              3D CAD Scan
            </button>
          </div>
        </div>

        {/* Visual Inspection Preview with Laser Grid overlay */}
        <div className="relative h-44 w-full overflow-hidden rounded-xl bg-navy-dark">
          <img
            src={viewMode === "original" ? current.originalImage : current.reconstructedImage}
            alt={viewMode === "original" ? `Original damaged ${current.sampleName}` : `Scanned 3D model of ${current.sampleName}`}
            className="h-full w-full object-cover transition-opacity duration-300"
          />

          {/* Scanner Wireframe / Laser Line Simulation */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-navy/80 via-transparent to-transparent" />

          {viewMode === "reconstruction" && (
            <div className="pointer-events-none absolute inset-0 border border-accent/40 bg-accent/5">
              <div className="absolute inset-x-0 h-0.5 bg-accent shadow-[0_0_8px_#e8752d] animate-scan-laser" />
            </div>
          )}

          {/* Badges on image */}
          <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
            <span className="rounded-md bg-black/75 px-2 py-0.5 text-[9px] font-bold text-white backdrop-blur">
              {viewMode === "original" ? "Original Physical Object" : "Metrology Solid CAD"}
            </span>
          </div>

          <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between text-[10px] text-white">
            <span className="font-mono bg-navy/80 px-2 py-0.5 rounded backdrop-blur font-semibold">
              Accuracy: {current.accuracy}
            </span>
            <span className="bg-accent/90 px-2 py-0.5 rounded font-bold backdrop-blur">
              {current.turnaround}
            </span>
          </div>
        </div>

        {/* Problem vs Solution Narrative */}
        <div className="grid grid-cols-1 gap-2 text-xs">
          <div className="rounded-xl bg-red-50/60 p-2.5 border border-red-100">
            <span className="font-bold text-red-900 text-[10px] uppercase tracking-wider block">
              Obsolescence Challenge
            </span>
            <p className="text-red-950/80 mt-0.5 leading-snug">{current.problem}</p>
          </div>

          <div className="rounded-xl bg-green-50/60 p-2.5 border border-green-100">
            <span className="font-bold text-green-900 text-[10px] uppercase tracking-wider block">
              3D Scanning &amp; Poly Pod Solution
            </span>
            <p className="text-green-950/80 mt-0.5 leading-snug">{current.solution}</p>
          </div>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1 pt-1">
          {current.tags.map((tag, idx) => (
            <span
              key={idx}
              className="rounded-md bg-navy/5 px-2 py-0.5 text-[10px] font-medium text-navy/70"
            >
              {tag}
            </span>
          ))}
        </div>

        {/* Action Button */}
        <button
          type="button"
          onClick={() => onRequestScan && onRequestScan(current.id)}
          aria-label={`Submit broken part for ${current.title} scanning quote`}
          className="btn-primary w-full py-3 text-xs flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <Scan size={15} />
          <span>Upload Photos of Broken Part for Scanning Quote</span>
        </button>
      </div>
    </section>
  );
}
