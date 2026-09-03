import { Printer, Scan, Wrench, ShieldCheck, ArrowRight, Zap, Layers } from "lucide-react";

export default function ServicesSection({ onSelectService }) {
  const services = [
    {
      id: "fdm",
      badge: "High-Speed Fleet",
      badgeColor: "bg-blue-100 text-blue-800",
      icon: <Printer size={22} className="text-accent" />,
      title: "FDM Rapid Fabrication",
      subtitle: "Bambu Lab X1-C & Prusa XL Fleet",
      desc: "Precision layer manufacturing in engineering-grade thermoplastics: PLA, PETG, TPU 95A, ABS-ESD, and high-temp Polycarbonate.",
      metrics: [
        { label: "Turnaround", value: "Same-Day / 24h" },
        { label: "Tolerances", value: "±0.15mm" },
        { label: "Max Build", value: "360³ mm" },
      ],
      features: [
        "Multi-material & dissolvable supports",
        "Active chamber heat & vibration damping",
        "Production runs & single prototypes",
      ],
      ctaText: "Request FDM Quote",
      ctaAria: "Request an FDM 3D printing quote",
    },
    {
      id: "scan",
      badge: "Metrology & Photogrammetry",
      badgeColor: "bg-orange-100 text-orange-800",
      icon: <Scan size={22} className="text-accent" />,
      title: "Reverse-Engineering & 3D Scanning",
      subtitle: "Non-Destructive Optical Metrology",
      desc: "High-resolution photogrammetric and structured-light scanning to digitize physical objects, broken assemblies, and legacy machine components.",
      metrics: [
        { label: "Accuracy", value: "±0.05mm" },
        { label: "Deliverable", value: "STEP / STL / CAD" },
        { label: "Scanning Hub", value: "New Iberia, LA" },
      ],
      features: [
        "Broken part reconstruction & mesh healing",
        "Point-cloud to parametric B-rep solid CAD",
        "Quality inspection & nominal CAD deviation heatmaps",
      ],
      ctaText: "Request 3D Scan",
      ctaAria: "Request a high-precision 3D scan and reverse engineering quote",
    },
  ];

  return (
    <section className="space-y-3" aria-label="Poly Pod Pro Regional Services">
      <div className="flex items-center justify-between px-0.5">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-navy/50">
            Regional Capabilities &bull; Acadiana Hub
          </span>
          <h2 className="text-sm font-bold text-navy">Fabrication &amp; Scanning Services</h2>
        </div>
        <span className="rounded-full bg-accent/15 px-2.5 py-0.5 text-[10px] font-bold text-accent">
          Local Delivery
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {services.map((svc) => (
          <article
            key={svc.id}
            className="group relative overflow-hidden rounded-2xl border border-navy/10 bg-surface p-4 shadow-xs transition-all duration-200 hover:border-accent/40 hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-navy/5 transition-colors duration-200 group-hover:bg-accent/10">
                  {svc.icon}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-md px-1.5 py-0.2 text-[9px] font-bold ${svc.badgeColor}`}>
                      {svc.badge}
                    </span>
                  </div>
                  <h3 className="mt-1 text-sm font-bold text-navy">{svc.title}</h3>
                  <p className="text-[11px] font-medium text-navy/60">{svc.subtitle}</p>
                </div>
              </div>
            </div>

            <p className="mt-2.5 text-xs leading-relaxed text-navy/75">{svc.desc}</p>

            <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-white p-2.5 text-center ring-1 ring-black/5">
              {svc.metrics.map((m, i) => (
                <div key={i} className="min-w-0">
                  <span className="block text-[9px] font-semibold uppercase tracking-wider text-navy/40">
                    {m.label}
                  </span>
                  <span className="truncate text-xs font-bold text-navy">{m.value}</span>
                </div>
              ))}
            </div>

            <ul className="mt-3 space-y-1 text-[11px] text-navy/80">
              {svc.features.map((f, i) => (
                <li key={i} className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent shrink-0" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>

            <div className="mt-3.5 pt-2 border-t border-navy/5">
              <button
                type="button"
                onClick={() => onSelectService && onSelectService(svc.id)}
                aria-label={svc.ctaAria}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-navy px-4 py-2.5 text-xs font-semibold text-white shadow-xs transition-all duration-150 hover:bg-navy-light hover:shadow-sm active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <span>{svc.ctaText}</span>
                <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
