import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Heart, MapPin, Search, SlidersHorizontal } from "lucide-react";
import PrinterCard from "../../components/PrinterCard";
import PrinterMapView from "../../components/PrinterMapView";
import RoleToggle from "../../components/RoleToggle";
import { useApp } from "../../context/AppContext";

export default function HomeFeed() {
  const navigate = useNavigate();
  const { printers, favorites } = useApp();
  const [query, setQuery] = useState("");
  const [view, setView] = useState("list"); // 'list' | 'map'
  const [favoritesOnly, setFavoritesOnly] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = printers;
    if (favoritesOnly) list = list.filter((p) => favorites.has(p.id));
    if (q) {
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.materials.some((m) => m.toLowerCase().includes(q))
      );
    }
    return list;
  }, [printers, query, favoritesOnly, favorites]);

  return (
    <div className="flex flex-1 flex-col">
      <header className="bg-navy px-4 pb-5 pt-5 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-white/60">Printing near</p>
            <div className="flex items-center gap-1 text-sm font-semibold">
              <MapPin size={14} className="text-accent" />
              Downtown, Springfield
            </div>
          </div>
          <RoleToggle />
        </div>

        <div className="mt-4 flex items-center gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-full bg-white px-4 py-2.5">
            <Search size={17} className="text-navy/40" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search shops or materials"
              className="flex-1 text-sm text-navy outline-none placeholder:text-navy/35"
            />
            <SlidersHorizontal size={17} className="text-navy/40" />
          </div>
          <button
            type="button"
            onClick={() => setFavoritesOnly((v) => !v)}
            className={`flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full ${
              favoritesOnly ? "bg-accent text-white" : "bg-white/10 text-white/70"
            }`}
            aria-label="Show favorites only"
            aria-pressed={favoritesOnly}
          >
            <Heart size={18} className={favoritesOnly ? "fill-white" : ""} />
          </button>
        </div>
      </header>

      <button
        type="button"
        onClick={() => navigate("/request")}
        className="mx-4 -mt-2.5 mb-1 flex items-center justify-center gap-2 rounded-2xl bg-accent py-3.5 text-sm font-semibold text-white shadow-lg shadow-accent/30 active:scale-[0.98]"
      >
        Upload a part &amp; get quotes
      </button>

      <div className="flex-1 space-y-3 px-4 py-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-navy/40">
            {filtered.length} printers {favoritesOnly ? "favorited" : "nearby"}
          </p>
          <div className="flex rounded-full bg-navy/5 p-0.5">
            {["list", "map"].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={`rounded-full px-3 py-1 text-xs font-semibold capitalize transition-colors ${
                  view === v ? "bg-white text-navy shadow-sm" : "text-navy/40"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        {view === "map" ? (
          <>
            <PrinterMapView printers={filtered} />
            <p className="text-center text-xs text-navy/40">
              Tap a pin to see shop details and its service radius.
            </p>
          </>
        ) : (
          filtered.map((printer) => (
            <PrinterCard
              key={printer.id}
              printer={printer}
              onClick={() => navigate(`/shop/${printer.id}`)}
            />
          ))
        )}
        {filtered.length === 0 && (
          <p className="py-10 text-center text-sm text-navy/40">
            {favoritesOnly ? "No favorites yet — tap the heart on a shop to save it." : `No printers match "${query}"`}
          </p>
        )}
      </div>
    </div>
  );
}
