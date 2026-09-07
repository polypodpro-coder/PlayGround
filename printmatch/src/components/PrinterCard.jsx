import { Link } from "react-router-dom";
import { Heart, MapPin, Map, Star, Timer } from "lucide-react";
import StatusBadge from "./StatusBadge";
import ShopLogo from "./ShopLogo";
import { useApp } from "../context/AppContext";

export default function PrinterCard({ printer, onClick }) {
  const { favorites, toggleFavorite } = useApp();
  const { id, name, distanceMi, serviceRadiusMi, buildVolume, materials, turnaroundLabel, status, shopPaused, rating, logoUrl } = printer;
  const isFavorite = favorites.has(id);
  const hasRadius = Number.isFinite(serviceRadiusMi) && serviceRadiusMi > 0;

  return <article className="w-full rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-black/5">
    <button type="button" onClick={onClick} className="block w-full text-left" aria-label={`View ${name}, example print farm`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <ShopLogo src={logoUrl} alt="" size="lg" />
          <div className="min-w-0"><h3 className="text-base font-semibold text-navy">{name}</h3><p className="mt-1 flex flex-wrap items-center gap-1 text-xs text-navy/60"><MapPin size={13} /><span>{distanceMi} mi · sample distance</span><span aria-hidden="true" className="mx-1">·</span><Star size={13} className="text-accent" /><span>{rating} · sample rating</span></p></div>
        </div>
        <span className="flex items-center gap-1.5 text-xs text-navy/60">Sample<StatusBadge status={shopPaused ? "paused" : status} /></span>
      </div>
      <p className="mt-3 text-xs text-navy/60">Build area {buildVolume.x} × {buildVolume.y} × {buildVolume.z} mm</p>
      <div className="mt-3 flex flex-wrap gap-1.5">{materials.map((material) => <span key={material} className="rounded-full bg-navy/5 px-2 py-1 text-xs font-medium text-navy/70">{material}</span>)}</div>
      <div className="mt-4 rounded-xl bg-navy/5 p-3"><p className="text-sm font-semibold text-navy">{hasRadius ? `${serviceRadiusMi}-mile example service-area radius` : 'Service area to be confirmed'}</p><p className="mt-1 text-xs leading-relaxed text-navy/65">Confirm pickup or local drop-off for your address, schedule, and any charges with the farm.</p></div>
      <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-accent"><Timer size={14} />{turnaroundLabel} · example turnaround</p>
    </button>
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-navy/10 pt-3">
      <Link to={`/?view=map&farm=${encodeURIComponent(id)}`} className="button-secondary" aria-label={`View ${name} service area on the sample map`}><Map size={16} /> View service area</Link>
      <button type="button" onClick={() => toggleFavorite(id)} className="icon-button" aria-label={`${isFavorite ? 'Unsave' : 'Save'} ${name}`} aria-pressed={isFavorite}><Heart size={17} className={isFavorite ? "fill-accent text-accent" : "text-navy/60"} /></button>
    </div>
  </article>;
}
