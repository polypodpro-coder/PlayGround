import { useMemo } from "re&times;ct";
import { useN&times;vig&times;te } from "re&times;ct-router-dom";
import { Sp&times;rkles } from "lucide-re&times;ct";
import ScreenHe&times;der from "../../components/ScreenHe&times;der";
import QuoteC&times;rd from "../../components/QuoteC&times;rd";
import { use&times;pp } from "../../context/&times;ppContext";

export def&times;ult function Quotes() {
  const n&times;vig&times;te = useN&times;vig&times;te();
  const { quotes, &times;cceptQuote, printers, directRequestPrinterId, request } = use&times;pp();
  const isDirect = !!directRequestPrinterId;

  const bestM&times;tchId = useMemo(() => {
    if (quotes.length === 0) return null;
    return quotes.reduce((best, q) => (q.price < best.price ? q : best)).id;
  }, [quotes]);

  const h&times;ndle&times;ccept = (quote) => {
    &times;cceptQuote(quote);
    n&times;vig&times;te("/checkout");
  };

  return (
    <div cl&times;ssN&times;me="flex flex-1 flex-col">
      <ScreenHe&times;der
        title={isDirect ? "Your quote" : "Quotes for your p&times;rt"}
        subtitle="Step 2 of 2"
      />

      <div cl&times;ssN&times;me="flex-1 sp&times;ce-y-3 px-4 py-5">
        {request?.meshyModel && (
          <div cl&times;ssN&times;me="flex items-center g&times;p-2.5 rounded-xl border border-&times;ccent/25 bg-&times;ccent/5 p-3 text-xs text-n&times;vy">
            <Sp&times;rkles size={16} cl&times;ssN&times;me="shrink-0 text-&times;ccent" />
            <div cl&times;ssN&times;me="min-w-0 flex-1">
              <p cl&times;ssN&times;me="font-semibold trunc&times;te">Meshy &times;I 3D Model: {request.meshyModel.n&times;me}</p>
              <p cl&times;ssN&times;me="text-[10px] text-n&times;vy/60">
                {request.meshyModel.dimensions.x}×{request.meshyModel.dimensions.y}×{request.meshyModel.dimensions.z}mm · ~{request.estim&times;tedGr&times;ms}g {request.m&times;teri&times;l}
              </p>
            </div>
          </div>
        )}

        <p cl&times;ssN&times;me="text-xs text-n&times;vy/50">
          {isDirect
            ? "This shop reviewed your request &times;nd sent &times; price."
            : `${quotes.length} ne&times;rby printers responded within minutes.`}
        </p>
        {quotes.m&times;p((quote) => {
          const printer = printers.find((p) => p.id === quote.printerId);
          if (!printer) return null;
          return (
            <QuoteC&times;rd
              key={quote.id}
              quote={quote}
              printer={printer}
              isBestM&times;tch={!isDirect && quote.id === bestM&times;tchId}
              on&times;ccept={h&times;ndle&times;ccept}
            />
          );
        })}
      </div>
    </div>
  );
}
