import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, Search, SlidersHorizontal } from "lucide-react";
import PrinterCard from "../../components/PrinterCard";
import RoleToggle from "../../components/RoleToggle";
import { printers } from "../../data/mockData";

export default function HomeFeed() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return printers;
    return printers.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.materials.some((m) => m.toLowerCase().includes(q))
    );
  }, [query]);

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

        <div className="mt-4 flex items-center gap-2 rounded-full bg-white px-4 py-2.5">
          <Search size={17} className="text-navy/40" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search shops or materials"
            className="flex-1 text-sm text-navy outline-none placeholder:text-navy/35"
          />
          <SlidersHorizontal size={17} className="text-navy/40" />
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
        <p className="text-xs font-semibold uppercase tracking-wide text-navy/40">
          {filtered.length} printers nearby
        </p>
        {filtered.map((printer) => (
          <PrinterCard
            key={printer.id}
            printer={printer}
            onClick={() => navigate("/request")}
          />
        ))}
        {filtered.length === 0 && (
          <p className="py-10 text-center text-sm text-navy/40">
            No printers match "{query}"
          </p>
        )}
      </div>
    </div>
  );
}
