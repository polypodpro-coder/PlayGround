import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Heart, MapPin, Search, SlidersHorizontal, Sparkles, X } from "lucide-react";
import PrinterCard from "../../components/PrinterCard";
import PrinterMapView from "../../components/PrinterMapView";
import RoleToggle from "../../components/RoleToggle";
import MaterialChipSelector from "../../components/MaterialChipSelector";
import ServicesSection from "../../components/ServicesSection";
import CustomScanningShowcase from "../../components/CustomScanningShowcase";
import { useApp } from "../../context/AppContext";
import { featuredDesigns } from "../../data/mockData";

const SORT_OPTIONS = [
  { id: "distance", label: "Nearest" },
  { id: "rating", label: "Top rated" },
  { id: "turnaround", label: "Fastest" },
];

const QUICK_FILTERS = [
  "PLA",
  "PETG",
  "TPU",
  "Polycarbonate",
  "ABS-ESD",
  "Commercial/Bulk",
  "Reverse Engineering",
];

const TURNAROUND_HOURS = { "Same day": 8, "24hr": 24, "48hr": 48 };

export default function HomeFeed() {
  const navigate = useNavigate();
  const { printers, favorites, setDirectRequestPrinterId, setSelectedDesign, showToast } = useApp();
  const [query, setQuery] = useState("");
  const [view, setView] = useState("list"); // 'list' | 'map'
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [materialFilter, setMaterialFilter] = useState([]);
  const [activePill, setActivePill] = useState(null);
  const [sortBy, setSortBy] = useState("distance");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = printers;
    if (favoritesOnly) list = list.filter((p) => favorites.has(p.id));
    if (materialFilter.length > 0) {
      list = list.filter((p) => materialFilter.every((m) => p.materials.includes(m)));
    }
    if (activePill) {
      const pLower = activePill.toLowerCase();
      list = list.filter(
        (p) =>
          p.materials.some((m) => m.toLowerCase().includes(pLower)) ||
          p.name.toLowerCase().includes(pLower) ||
          p.bio?.toLowerCase().includes(pLower) ||
          (pLower.includes("commercial") || pLower.includes("reverse"))
      );
    }
    if (q) {
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.materials.some((m) => m.toLowerCase().includes(q)) ||
          p.city?.toLowerCase().includes(q)
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
  }, [printers, query, favoritesOnly, favorites, materialFilter, activePill, sortBy]);

  const activeFilterCount = materialFilter.length + (activePill ? 1 : 0) + (sortBy !== "distance" ? 1 : 0);

  const handlePillClick = (pill) => {
    setActivePill((curr) => (curr === pill ? null : pill));
  };

  const handleServiceSelect = (serviceId) => {
    setDirectRequestPrinterId(null);
    setSelectedDesign(null);
    navigate("/request");
    if (showToast) {
      showToast(
        serviceId === "scan"
          ? "Upload photos or dimensions of your physical part for 3D scanning"
          : "Select your required material and build tolerances",
        "info"
      );
    }
  };

  return (
    <div className="flex flex-1 flex-col">
      <header className="bg-navy px-4 pb-4 pt-5 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-white/60">Manufacturing near</p>
            <div className="flex items-center gap-1.5 text-sm font-bold">
              <MapPin size={15} className="text-accent shrink-0" />
              <span>New Iberia, LA &bull; Acadiana Hub</span>
            </div>
          </div>
          <RoleToggle />
        </div>

        {/* Search Bar */}
        <div className="mt-4 flex items-center gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-full bg-surface px-4 py-2.5 shadow-inner">
            <Search size={17} className="text-navy/40 shrink-0" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search Acadiana shops or materials"
              aria-label="Search print shops or materials in the Acadiana area"
              className="flex-1 text-sm text-navy outline-none placeholder:text-navy/40"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search query"
                className="text-navy/40 hover:text-navy"
              >
                <X size={15} />
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowFilters((v) => !v)}
              className="relative p-1 text-navy/40 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-full"
              aria-label="Toggle filters and sorting options"
              aria-pressed={showFilters}
            >
              <SlidersHorizontal
                size={17}
                className={showFilters ? "text-accent" : "text-navy/40"}
              />
              {activeFilterCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-accent text-[8px] font-bold text-white">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>

          <button
            type="button"
            onClick={() => setFavoritesOnly((v) => !v)}
            className={`flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full transition-all duration-150 hover:brightness-110 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
              favoritesOnly ? "bg-accent text-white shadow-md shadow-accent/25" : "bg-white/10 text-white/75 hover:bg-white/15"
            }`}
            aria-label={favoritesOnly ? "Show all print shops" : "Show favorited print shops only"}
            aria-pressed={favoritesOnly}
          >
            <Heart size={18} className={favoritesOnly ? "fill-white" : ""} />
          </button>
        </div>

        {/* Quick Filter Horizontal Scrolling Row */}
        <div
          role="region"
          aria-label="Quick material and service filters"
          className="mt-3 -mx-4 flex gap-1.5 overflow-x-auto px-4 no-scrollbar pb-0.5"
        >
          {QUICK_FILTERS.map((pill) => {
            const isActive = activePill === pill;
            return (
              <button
                key={pill}
                type="button"
                onClick={() => handlePillClick(pill)}
                aria-pressed={isActive}
                className={`btn-chip shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                  isActive
                    ? "bg-accent text-white shadow-xs border border-accent"
                    : "bg-white/10 text-white/90 border border-white/20 hover:bg-white/20 active:scale-95"
                }`}
              >
                {pill}
              </button>
            );
          })}
        </div>

        {/* Filter Drawer */}
        {showFilters && (
          <div className="mt-3 space-y-3 rounded-2xl bg-white/10 p-3.5 backdrop-blur-xs">
            <div>
              <p className="mb-1.5 text-xs font-semibold text-white/75">Material Filter</p>
              <MaterialChipSelector
                selected={materialFilter}
                onChange={setMaterialFilter}
                multi
              />
            </div>
            <div>
              <p className="mb-1.5 text-xs font-semibold text-white/75">Sort by</p>
              <div className="flex flex-wrap gap-1.5">
                {SORT_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSortBy(opt.id)}
                    aria-pressed={sortBy === opt.id}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-all duration-150 hover:brightness-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                      sortBy === opt.id
                        ? "border-accent bg-accent text-white"
                        : "border-white/20 text-white/80 hover:bg-white/10"
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

      {/* Primary Hero CTA */}
      <button
        type="button"
        onClick={() => {
          setDirectRequestPrinterId(null);
          setSelectedDesign(null);
          navigate("/request");
        }}
        aria-label="Upload a part, 3D CAD file, or reference photo to start quoting"
        className="mx-4 -mt-2.5 mb-2 flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-accent to-accent-light py-3.5 text-sm font-bold text-white shadow-lg shadow-accent/30 transition-all duration-150 hover:brightness-105 hover:shadow-xl active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <Sparkles size={17} />
        <span>Upload a part, 3D file, or reference photo</span>
      </button>

      <div className="flex-1 space-y-5 px-4 py-3">
        {/* Track 1: Regional Services Section */}
        <ServicesSection onSelectService={handleServiceSelect} />

        {/* Track 1: Custom 3D Scanning & Replication Component */}
        <CustomScanningShowcase onRequestScan={handleServiceSelect} />

        {/* Featured Community Designs */}
        <section aria-label="Featured Community 3D Models">
          <div className="mb-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-navy">Featured Designs</h2>
              <span className="rounded-full bg-navy/10 px-2 py-0.2 text-[10px] font-bold uppercase tracking-wide text-navy/60">
                Verified CAD
              </span>
            </div>
          </div>

          <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
            {featuredDesigns.map((design) => (
              <button
                key={design.id}
                type="button"
                onClick={() => navigate(`/design/${design.id}`)}
                aria-label={`Inspect ${design.name} 3D design specifications`}
                className="w-32 shrink-0 overflow-hidden rounded-2xl bg-surface text-left shadow-sm ring-1 ring-black/5 transition-all duration-150 hover:ring-accent/40 hover:shadow-md active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <img src={design.imageUrl} alt={design.name} className="h-24 w-full object-cover" />
                <div className="p-2.5">
                  <p className="truncate text-xs font-bold text-navy">{design.name}</p>
                  <p className="truncate text-[10px] text-navy/50">{design.category}</p>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* Local Print Shops List / Map */}
        <section aria-label="Acadiana Local Print Shops">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-bold text-navy">Nearby Acadiana Print Shops</h2>
              <p className="text-[10px] text-navy/50">
                {filtered.length} verified printers {favoritesOnly ? "favorited" : "in your local area"}
              </p>
            </div>
            <div className="flex rounded-full bg-navy/10 p-0.5">
              {["list", "map"].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  aria-pressed={view === v}
                  aria-label={`Switch to ${v} view`}
                  className={`rounded-full px-3 py-1 text-xs font-bold capitalize transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                    view === v ? "bg-white text-navy shadow-xs" : "text-navy/60 hover:text-navy"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          {view === "map" ? (
            <div className="space-y-2">
              <PrinterMapView printers={filtered} />
              <p className="text-center text-xs text-navy/50">
                Tap a marker to view shop profile, equipment fleet, and delivery radius.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((printer) => (
                <PrinterCard
                  key={printer.id}
                  printer={printer}
                  onClick={() => navigate(`/shop/${printer.id}`)}
                />
              ))}
            </div>
          )}

          {filtered.length === 0 && (
            <div className="rounded-2xl border border-dashed border-navy/20 bg-surface p-8 text-center">
              <p className="text-sm font-bold text-navy">
                {favoritesOnly
                  ? "No favorited shops yet."
                  : activePill || materialFilter.length > 0
                  ? `No print shops matching active filters.`
                  : `No printers found matching "${query}"`}
              </p>
              <p className="mt-1 text-xs text-navy/50">
                Try clearing filters or selecting another plastic material.
              </p>
              {(activePill || materialFilter.length > 0 || query) && (
                <button
                  type="button"
                  onClick={() => {
                    setActivePill(null);
                    setMaterialFilter([]);
                    setQuery("");
                  }}
                  className="btn-outline mt-3 py-1.5 px-3.5 text-xs font-semibold"
                >
                  Clear all filters
                </button>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
