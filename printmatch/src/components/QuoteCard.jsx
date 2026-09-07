import { Award, Clock3 } from "lucide-react";

export default function QuoteCard({ quote, printer, isBestMatch, onAccept }) {
  return (
    <div
      className={`rounded-2xl bg-surface p-4 shadow-sm ring-1 transition-shadow ${
        isBestMatch ? "ring-2 ring-accent" : "ring-black/5"
      }`}
    >
      {isBestMatch && (
        <div className="mb-2 inline-flex items-center gap-1 rounded-full bg-accent/10 px-2.5 py-1 text-[11px] font-bold text-accent">
          <Award size={13} />
          BEST MATCH
        </div>
      )}

      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-base font-semibold text-navy">{printer.name}</h3>
          <p className="text-xs text-navy/50">
            {quote.material} · {quote.color} · {printer.distanceMi} mi
          </p>
        </div>
        <p className="text-lg font-bold text-navy">${quote.price.toFixed(2)}</p>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-1 text-xs text-navy/60">
          <Clock3 size={14} />
          Ready in{" "}
          {quote.etaHours < 24
            ? `${quote.etaHours}hr`
            : `${Math.round(quote.etaHours / 24)}d`}
        </div>
        <button
          type="button"
          onClick={() => onAccept(quote)}
          className={`rounded-full px-4 py-2 text-sm font-semibold text-white transition-transform active:scale-95 ${
            isBestMatch ? "bg-accent" : "bg-navy"
          }`}
        >
          Accept and pay
        </button>
      </div>
    </div>
  );
}
