import { useNavigate, useParams } from "react-router-dom";
import { Heart, MapPin, Star, Timer } from "lucide-react";
import ScreenHeader from "../../components/ScreenHeader";
import ShopLogo from "../../components/ShopLogo";
import StatusBadge from "../../components/StatusBadge";
import { useApp } from "../../context/AppContext";

function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function ShopProfile() {
  const { printerId } = useParams();
  const navigate = useNavigate();
  const { printers, favorites, toggleFavorite } = useApp();

  const printer = printers.find((p) => p.id === printerId);
  const isFavorite = favorites.has(printerId);

  if (!printer) {
    return (
      <div className="flex flex-1 flex-col">
        <ScreenHeader title="Shop not found" onBack={() => navigate("/")} />
        <p className="p-4 text-sm text-navy/50">This shop is no longer listed.</p>
      </div>
    );
  }

  const {
    name,
    ownerName,
    distanceMi,
    rating,
    completedJobs,
    status,
    shopPaused,
    pausedUntil,
    materials,
    buildVolume,
    turnaroundLabel,
    portfolio = [],
    reviews = [],
    logoUrl,
  } = printer;

  return (
    <div className="flex flex-1 flex-col">
      <ScreenHeader
        title={name}
        subtitle={`Run by ${ownerName}`}
        right={
          <button
            type="button"
            onClick={() => toggleFavorite(printer.id)}
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-white/10"
            aria-label={isFavorite ? "Remove from favorites" : "Save to favorites"}
          >
            <Heart size={19} className={isFavorite ? "fill-accent text-accent" : "text-white/70"} />
          </button>
        }
      />

      <div className="flex-1 space-y-5 px-4 py-5">
        <div className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
          <ShopLogo src={logoUrl} alt={`${name} logo`} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1 text-xs text-navy/50">
              <MapPin size={13} />
              <span>{distanceMi} mi away</span>
              <span className="mx-1">·</span>
              <Star size={13} className="fill-accent text-accent" />
              <span>
                {rating} ({completedJobs} jobs)
              </span>
            </div>
            <div className="mt-1.5 flex items-center gap-1.5">
              <StatusBadge status={shopPaused ? "paused" : status} />
              {shopPaused && pausedUntil && (
                <span className="text-xs text-navy/40">until {formatDate(pausedUntil)}</span>
              )}
            </div>
          </div>
        </div>

        <div>
          <h2 className="mb-2 text-sm font-semibold text-navy">Materials</h2>
          <div className="flex flex-wrap gap-1.5">
            {materials.map((m) => (
              <span
                key={m}
                className="rounded-full bg-navy/5 px-2.5 py-1 text-xs font-medium text-navy/70"
              >
                {m}
              </span>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-white p-3.5 shadow-sm ring-1 ring-black/5">
            <p className="text-xs text-navy/50">Build volume</p>
            <p className="mt-0.5 text-sm font-semibold text-navy">
              {buildVolume.x}×{buildVolume.y}×{buildVolume.z}mm
            </p>
          </div>
          <div className="rounded-2xl bg-white p-3.5 shadow-sm ring-1 ring-black/5">
            <p className="flex items-center gap-1 text-xs text-navy/50">
              <Timer size={12} /> Turnaround
            </p>
            <p className="mt-0.5 text-sm font-semibold text-accent">{turnaroundLabel}</p>
          </div>
        </div>

        {portfolio.length > 0 && (
          <div>
            <h2 className="mb-2 text-sm font-semibold text-navy">Portfolio</h2>
            <div className="grid grid-cols-2 gap-2.5">
              {portfolio.map((item) => (
                <div key={item.id} className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-black/5">
                  <img src={item.imageUrl} alt={item.caption} className="h-28 w-full object-cover" />
                  <p className="px-2 py-1.5 text-[11px] leading-tight text-navy/60">{item.caption}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {reviews.length > 0 && (
          <div>
            <h2 className="mb-2 text-sm font-semibold text-navy">Reviews</h2>
            <div className="space-y-2.5">
              {reviews.map((review) => (
                <div key={review.id} className="rounded-2xl bg-white p-3.5 shadow-sm ring-1 ring-black/5">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-navy">{review.buyerName}</p>
                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: 5 }, (_, i) => (
                        <Star
                          key={i}
                          size={12}
                          className={i < review.rating ? "fill-accent text-accent" : "text-navy/15"}
                        />
                      ))}
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-navy/60">{review.text}</p>
                  <p className="mt-1.5 text-[11px] text-navy/35">{formatDate(review.date)}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-black/5 bg-white px-4 py-3.5">
        <button
          type="button"
          onClick={() => navigate("/request")}
          disabled={shopPaused}
          className="w-full rounded-2xl bg-accent py-3.5 text-sm font-semibold text-white shadow-lg shadow-accent/30 active:scale-[0.98] disabled:opacity-40 disabled:shadow-none"
        >
          {shopPaused ? "Currently paused" : "Request a quote"}
        </button>
      </div>
    </div>
  );
}
