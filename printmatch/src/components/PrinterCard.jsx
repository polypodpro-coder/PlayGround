import { MapPin, Star, Timer } from "lucide-react";
import StatusBadge from "./StatusBadge";
import ShopLogo from "./ShopLogo";

export default function PrinterCard({ printer, onClick }) {
  const { name, distanceMi, buildVolume, materials, turnaroundLabel, status, rating, logoUrl } =
    printer;

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-2xl bg-white p-4 text-left shadow-sm ring-1 ring-black/5 transition-transform active:scale-[0.98]"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-3">
          <ShopLogo src={logoUrl} alt={`${name} logo`} />
          <div>
            <h3 className="text-base font-semibold text-navy">{name}</h3>
            <div className="mt-0.5 flex items-center gap-1 text-xs text-navy/50">
              <MapPin size={13} />
              <span>{distanceMi} mi away</span>
              <span className="mx-1">·</span>
              <Star size={13} className="fill-accent text-accent" />
              <span>{rating}</span>
            </div>
          </div>
        </div>
        <StatusBadge status={status} />
      </div>

      <p className="mt-2 text-xs text-navy/60">
        Build volume {buildVolume.x}×{buildVolume.y}×{buildVolume.z}mm
      </p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {materials.map((m) => (
          <span
            key={m}
            className="rounded-full bg-navy/5 px-2 py-0.5 text-[11px] font-medium text-navy/70"
          >
            {m}
          </span>
        ))}
      </div>

      <div className="mt-3 flex items-center gap-1 text-xs font-semibold text-accent">
        <Timer size={14} />
        {turnaroundLabel}
      </div>
    </button>
  );
}
