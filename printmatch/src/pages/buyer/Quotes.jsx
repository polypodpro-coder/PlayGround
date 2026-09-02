import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import ScreenHeader from "../../components/ScreenHeader";
import QuoteCard from "../../components/QuoteCard";
import { useApp } from "../../context/AppContext";

export default function Quotes() {
  const navigate = useNavigate();
  const { quotes, acceptQuote, printers } = useApp();

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
      <ScreenHeader title="Quotes for your part" subtitle="Step 2 of 2" />

      <div className="flex-1 space-y-3 px-4 py-5">
        <p className="text-xs text-navy/50">
          {quotes.length} nearby printers responded within minutes.
        </p>
        {quotes.map((quote) => {
          const printer = printers.find((p) => p.id === quote.printerId);
          if (!printer) return null;
          return (
            <QuoteCard
              key={quote.id}
              quote={quote}
              printer={printer}
              isBestMatch={quote.id === bestMatchId}
              onAccept={handleAccept}
            />
          );
        })}
      </div>
    </div>
  );
}
