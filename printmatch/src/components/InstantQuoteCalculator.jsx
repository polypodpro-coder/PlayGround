import { useMemo } from "react";
import { Calculator, Tag, ShieldCheck, Zap } from "lucide-react";
import { MATERIAL_MULTIPLIERS, POST_PROCESSING_ADDONS } from "../data/mockData";

export default function InstantQuoteCalculator({
  grams = 40,
  material = "PETG",
  selectedAddons = [],
  quantity = 1,
}) {
  const calculation = useMemo(() => {
    const matInfo = MATERIAL_MULTIPLIERS[material] || {
      multiplier: 1.0,
      rate: 0.08,
      category: "Standard",
      desc: "Standard FDM material",
    };

    const validGrams = Math.max(5, grams || 35);
    const baseMaterialCost = validGrams * matInfo.rate;

    let addonCost = 0;
    const activeAddonDetails = [];
    selectedAddons.forEach((id) => {
      const addon = POST_PROCESSING_ADDONS.find((a) => a.id === id);
      if (addon) {
        addonCost += addon.cost;
        activeAddonDetails.push(addon);
      }
    });

    const subtotalPerUnit = baseMaterialCost + addonCost;
    const total = subtotalPerUnit * quantity;
    const lowEstimate = Math.max(7, total * 0.9);
    const highEstimate = Math.max(10, total * 1.25);

    return {
      matInfo,
      validGrams,
      baseMaterialCost,
      addonCost,
      activeAddonDetails,
      total,
      lowEstimate,
      highEstimate,
    };
  }, [grams, material, selectedAddons, quantity]);

  return (
    <div className="rounded-2xl border-2 border-accent/25 bg-surface p-4 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent text-white shadow-xs">
            <Calculator size={16} />
          </div>
          <div>
            <h4 className="text-xs font-bold text-navy">Instant Quote Estimate</h4>
            <p className="text-[10px] text-navy/50">Dynamic multi-variable pricing model</p>
          </div>
        </div>

        <div className="text-right">
          <span className="text-base font-extrabold text-accent">
            ${calculation.lowEstimate.toFixed(2)} - ${calculation.highEstimate.toFixed(2)}
          </span>
          <span className="block text-[9px] text-navy/50 font-medium">Final pricing confirmed by shop</span>
        </div>
      </div>

      {/* Itemized Calculation Breakdown */}
      <div className="rounded-xl bg-white p-3 border border-gray-100 text-xs space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-navy">Base Material:</span>
            <span className="text-navy/70">{material}</span>
            <span
              className={`rounded px-1.5 py-0.2 text-[9px] font-bold ${
                calculation.matInfo.category === "Standard"
                  ? "bg-blue-100 text-blue-700"
                  : "bg-purple-100 text-purple-700"
              }`}
            >
              {calculation.matInfo.multiplier.toFixed(2)}x {calculation.matInfo.category}
            </span>
          </div>
          <span className="font-medium text-navy">
            ~{calculation.validGrams}g &times; ${calculation.matInfo.rate.toFixed(3)}/g = $
            {calculation.baseMaterialCost.toFixed(2)}
          </span>
        </div>

        {calculation.activeAddonDetails.length > 0 && (
          <div className="border-t border-gray-100 pt-1.5 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-navy/40 block">
              Active Post-Processing Add-ons:
            </span>
            {calculation.activeAddonDetails.map((addon) => (
              <div key={addon.id} className="flex justify-between text-[11px] text-navy/80">
                <span>&bull; {addon.name}</span>
                <span className="font-medium">+${addon.cost.toFixed(2)}</span>
              </div>
            ))}
          </div>
        )}

        <div className="border-t border-gray-100 pt-2 flex items-center justify-between font-bold text-xs text-navy">
          <span className="flex items-center gap-1">
            <Zap size={12} className="text-accent" /> Estimated Target Per Unit
          </span>
          <span className="text-accent font-extrabold text-sm">
            ${calculation.total.toFixed(2)}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1.5 text-[10px] text-green-700 bg-green-50 px-2.5 py-1.5 rounded-lg border border-green-200">
        <ShieldCheck size={13} className="shrink-0" />
        <span>100% Escrow Protection &bull; Zero charge until quality tolerances verified</span>
      </div>
    </div>
  );
}
