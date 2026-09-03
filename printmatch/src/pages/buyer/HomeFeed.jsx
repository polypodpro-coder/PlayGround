import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Heart, MapPin, Search, SlidersHorizontal, Sparkles } from "lucide-react";
import PrinterCard from "../../components/PrinterCard";
import PrinterMapView from "../../components/PrinterMapView";
import RoleToggle from "../../components/RoleToggle";
import MaterialChipSelector from "../../components/MaterialChipSelector";
import { useApp } from "../../context/AppContext";
import { featuredDesigns } from "../../data/mockData";

const SORT_OPTIONS = [
  { id: "distance", label: "Nearest" },
  { id: "rating", label: "Top rated" },
  { id: "turnaround", label: "Fastest" },
];

// Rough hours-equivalent for sorting by turnaround label, since it's free
// text rather than a number.
const TURNAROUND_HOURS = { "Same day": 8, "24hr": 24, "48hr": 48 };

export default function HomeFeed() {
  const navigate = useNavigate();
  const { printers, favorites, setDirectRequestPrinterId, setSelectedDesign } = useApp();
  const [query, setQuery] = useState("");
  const [view, setView] = useState("list"); // 'list' | 'map'
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [materialFilter, setMaterialFilter] = useState([]);
  const [sortBy, setSortBy] = useState("distance");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = printers;
    if (favoritesOnly) list = list.filter((p) => favorites.has(p.id));
    if (materialFilter.length > 0) {
      list = list.filter((p) => materialFilter.every((m) => p.materials.includes(m)));
    }
    if (q) {
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.materials.some((m) => m.toLowerCase().includes(q))
      );
    }
    const sorted = [...list];
    if (sortBy === "rating") {
      sorted.sort((a, b) => b.rating - a.rating);
    } else if (sortBy === "turnaround") {
      sorted.sort(
        (a, b) =>
          (TURNAROUND_HOURS[a.turnaroundLabel] ?? 99) -
          (TURNAROUND_HOURS[b.turnaroundLabel] ?? 99)
      );
    } else {
      sorted.sort((a, b) => a.distanceMi - b.distanceMi);
    }
    return sorted;
  }, [printers, query, favoritesOnly, favorites, materialFilter, sortBy]);

  const activeFilterCount = materialFilter.length + (sortBy !== "distance" ? 1 : 0);

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
          <div className="flex flex-1 items-center gap-2 rounded-full bg-surface px-4 py-2.5">
            <Search size={17} className="text-navy/40" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search shops or materials"
              className="flex-1 text-sm text-navy outline-none placeholder:text-navy/35"
            />
            <button
              type="button"
              onClick={() => setShowFilters((v) => !v)}
              className="relative"
              aria-label="Filters and sort"
              aria-pressed={showFilters}
            >
              <SlidersHorizontal
                size={17}
                className={showFilters ? "text-accent" : "text-navy/40"}
              />
              {activeFilterCount > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-accent text-[8px] font-bold text-white">
                  {activeFilterCount}
                </span>
              )}
            </button>
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

        {showFilters && (
          <div className="mt-3 space-y-3 rounded-2xl bg-white/10 p-3.5">
            <div>
              <p className="mb-1.5 text-xs font-semibold text-white/70">Materials</p>
              <MaterialChipSelector
                selected={materialFilter}
                onChange={setMaterialFilter}
                multi
              />
            </div>
            <div>
              <p className="mb-1.5 text-xs font-semibold text-white/70">Sort by</p>
              <div className="flex flex-wrap gap-1.5">
                {SORT_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSortBy(opt.id)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                      sortBy === opt.id
                        ? "border-accent bg-accent text-white"
                        : "border-white/20 text-white/70"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </header>

      <button
        type="button"
        onClick={() => {
          setDirectRequestPrinterId(null);
          setSelectedDesign(null);
          navigate("/request");
        }}
        className="mx-4 -mt-2.5 mb-1 flex items-center justify-center gap-2 rounded-2xl bg-accent py-3.5 text-sm font-semibold text-white shadow-lg shadow-accent/30 active:scale-[0.98]"
      >
        <Sparkles size={16} />
        Upload a part, 3D file, or photo
      </button>

      <div className="pt-4">
        <div className="mb-2 flex items-center gap-2 px-4">
          <h2 className="text-sm font-semibold text-navy">Featured designs</h2>
          <span className="rounded-full bg-navy/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-navy/50">
            Concept
          </span>
        </div>
        <div className="no-scrollbar flex gap-3 overflow-x-auto px-4 pb-1">
          {featuredDesigns.map((design) => (
            <button
              key={design.id}
              type="button"
              onClick={() => navigate(`/design/${design.id}`)}
              className="w-32 shrink-0 overflow-hidden rounded-2xl bg-surface text-left shadow-sm ring-1 ring-black/5 active:scale-[0.98]"
            >
              <img src={design.imageUrl} alt={design.name} className="h-24 w-full object-cover" />
              <div className="p-2">
                <p className="truncate text-xs font-semibold text-navy">{design.name}</p>
                <p className="truncate text-[10px] text-navy/40">{design.category}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

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
                  view === v ? "bg-surface text-navy shadow-sm" : "text-navy/40"
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
            {favoritesOnly
              ? "No favorites yet — tap the heart on a shop to save it."
              : materialFilter.length > 0
              ? "No printers match this material filter."
              : `No printers match "${query}"`}
          </p>
        )}
      </div>
    </div>
  );
}
