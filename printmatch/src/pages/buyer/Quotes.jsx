import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, ArrowLeft, Layers, Wrench, ShieldCheck, CheckCircle2 } from "lucide-react";
import ScreenHeader from "../../components/ScreenHeader";
import QuoteCard from "../../components/QuoteCard";
import { useApp } from "../../context/AppContext";
import { FLEET_MACHINES, POST_PROCESSING_ADDONS } from "../../data/mockData";

export default function Quotes() {
  const navigate = useNavigate();
  const {
    quotes,
    acceptQuote,
    printers,
    directRequestPrinterId,
    request,
    selectedMaterial,
    selectedMachineId,
    selectedAddons,
  } = useApp();
  const isDirect = !!directRequestPrinterId;

  const bestMatchId = useMemo(() => {
    if (quotes.length === 0) return null;
    return quotes.reduce((best, q) => (q.price < best.price ? q : best)).id;
  }, [quotes]);

  const activeMachine = useMemo(() => {
    return FLEET_MACHINES.find((m) => m.id === selectedMachineId) || FLEET_MACHINES[0];
  }, [selectedMachineId]);

  const activeAddonsList = useMemo(() => {
    return (selectedAddons || [])
      .map((id) => POST_PROCESSING_ADDONS.find((a) => a.id === id))
      .filter(Boolean);
  }, [selectedAddons]);

  const handleAccept = (quote) => {
    acceptQuote(quote);
    navigate("/checkout");
  };

  return (
    <div className="flex flex-1 flex-col">
      <ScreenHeader
        title={isDirect ? "Your Custom Quote" : "Quotes for Your Part"}
        subtitle="Step 2 of 2"
        onBack={() => navigate("/request")}
      />

      <div className="flex-1 space-y-3.5 px-4 py-4">
        {/* Specification Banner */}
        <div className="rounded-2xl border border-accent/25 bg-accent/5 p-3.5 text-xs text-navy space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-accent shrink-0" />
              <span className="font-bold">
                {request?.fileName || request?.meshyModel?.name || "Configured 3D Part"}
              </span>
            </div>
            <span className="rounded-full bg-navy/10 px-2 py-0.5 text-[10px] font-bold text-navy">
              {selectedMaterial}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px] text-navy/70 border-t border-accent/15 pt-2">
            <span className="flex items-center gap-1">
              <Layers size={12} className="text-accent" />
              <span>Target Fleet: <strong>{activeMachine.name}</strong></span>
            </span>
            {activeAddonsList.length > 0 && (
              <span className="flex items-center gap-1">
                <Wrench size={12} className="text-accent" />
                <span>Add-ons: <strong>{activeAddonsList.map((a) => a.name).join(", ")}</strong></span>
              </span>
            )}
          </div>
        </div>

        {/* Escrow Guarantee Trust Banner */}
        <div className="flex items-center gap-2.5 rounded-xl bg-green-50 p-2.5 border border-green-200 text-green-900 text-xs">
          <CheckCircle2 size={16} className="text-green-600 shrink-0" />
          <p className="leading-tight">
            <strong>Escrow Protected:</strong> Funds are locked until you inspect the printed part and verify dimensional tolerances.
          </p>
        </div>

        <p className="text-xs text-navy/60 font-medium">
          {isDirect
            ? "This shop reviewed your request and generated an instant quote."
            : `${quotes.length} Acadiana print shops ready to fabricate:`}
        </p>

        {/* Quotes List */}
        <div className="space-y-3">
          {quotes.map((quote) => {
            const printer = printers.find((p) => p.id === quote.printerId);
            if (!printer) return null;
            return (
              <QuoteCard
                key={quote.id}
                quote={quote}
                printer={printer}
                isBestMatch={!isDirect && quote.id === bestMatchId}
                onAccept={handleAccept}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
