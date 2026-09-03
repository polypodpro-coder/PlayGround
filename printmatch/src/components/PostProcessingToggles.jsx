import { Wrench, Scissors, Check, Info } from "lucide-react";
import { POST_PROCESSING_ADDONS } from "../data/mockData";

export default function PostProcessingToggles({ selectedAddons = [], onToggleAddon }) {
  const isSelected = (id) => selectedAddons.includes(id);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-navy flex items-center gap-1.5">
            <Wrench size={16} className="text-accent" /> Post-Processing &amp; Hardware Add-ons
          </h3>
          <p className="text-xs text-navy/50">
            Optional mechanical finishing and assembly services
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {POST_PROCESSING_ADDONS.map((addon) => {
          const active = isSelected(addon.id);
          const icon =
            addon.id === "splitAndBond" ? (
              <Scissors size={16} className={active ? "text-accent" : "text-navy/50"} />
            ) : (
              <Wrench size={16} className={active ? "text-accent" : "text-navy/50"} />
            );

          return (
            <div
              key={addon.id}
              onClick={() => onToggleAddon(addon.id)}
              className={`rounded-2xl border p-3.5 cursor-pointer transition-all duration-200 select-none flex items-start justify-between gap-3 ${
                active
                  ? "border-accent bg-accent/5 ring-1 ring-accent"
                  : "border-gray-200 bg-surface hover:border-gray-300"
              }`}
            >
              <div className="flex items-start gap-3 min-w-0">
                <div
                  className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition ${
                    active ? "bg-accent/15 text-accent" : "bg-navy/5 text-navy/60"
                  }`}
                >
                  {icon}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-bold text-navy">{addon.name}</h4>
                    <span className="rounded bg-accent/10 px-1.5 py-0.2 text-[10px] font-bold text-accent">
                      +${addon.cost.toFixed(2)}
                    </span>
                  </div>
                  <p className="text-[11px] text-navy/65 mt-0.5 leading-snug">
                    {addon.desc}
                  </p>
                </div>
              </div>

              <button
                type="button"
                aria-pressed={active}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleAddon(addon.id);
                }}
                className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition ${
                  active
                    ? "border-accent bg-accent text-white shadow-xs"
                    : "border-gray-300 bg-white"
                }`}
              >
                {active && <Check size={13} strokeWidth={3} />}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
