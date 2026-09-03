import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles } from "lucide-react";
import ScreenHeader from "../../components/ScreenHeader";
import QuoteCard from "../../components/QuoteCard";
import { useApp } from "../../context/AppContext";

export default function Quotes() {
  const navigate = useNavigate();
  const { quotes, acceptQuote, printers, directRequestPrinterId, request } = useApp();
  const isDirect = !!directRequestPrinterId;

  const bestMatchId = useMemo(() => {
    if (quotes.length === 0) return null;
    return quotes.reduce((best, q) => (q.price < best.price ? q : best)).id;
  }, [quotes]);

  const handleAccept = (quote) => {
    acceptQuote(quote);
    navigate("/checkout");
  };

  return (
    <div className="flex flex-1 flex-col">
      <ScreenHeader
        title={isDirect ? "Your quote" : "Quotes for your part"}
        subtitle="Step 2 of 2"
      />

      <div className="flex-1 space-y-3 px-4 py-5">
        {request?.meshyModel && (
          <div className="flex items-center gap-2.5 rounded-xl border border-accent/25 bg-accent/5 p-3 text-xs text-navy">
            <Sparkles size={16} className="shrink-0 text-accent" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold truncate">Meshy AI 3D Model: {request.meshyModel.name}</p>
              <p className="text-[10px] text-navy/60">
                {request.meshyModel.dimensions.x}×{request.meshyModel.dimensions.y}×{request.meshyModel.dimensions.z}mm · ~{request.estimatedGrams}g {request.material}
              </p>
            </div>
          </div>
        )}

        <p className="text-xs text-navy/50">
          {isDirect
            ? "This shop reviewed your request and sent a price."
            : `${quotes.length} nearby printers responded within minutes.`}
        </p>
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
  );
}
