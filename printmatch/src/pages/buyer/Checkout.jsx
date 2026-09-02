import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CreditCard, Wallet } from "lucide-react";
import ScreenHeader from "../../components/ScreenHeader";
import { order as mockOrder } from "../../data/mockData";
import { useApp } from "../../context/AppContext";

const PAYMENT_METHODS = [
  { id: "visa", label: "Visa •••• 4242", icon: CreditCard },
  { id: "wallet", label: "PrintMatch Wallet ($42.10)", icon: Wallet },
];

export default function Checkout() {
  const navigate = useNavigate();
  const { selectedQuote, placeOrder, printers } = useApp();
  const [method, setMethod] = useState("visa");

  const quote = selectedQuote ?? {
    printerId: printers[0].id,
    price: 18.5,
    material: "PETG",
    color: "Black",
  };
  const printer = printers.find((p) => p.id === quote.printerId) ?? printers[0];
  const serviceFee = mockOrder.serviceFee;
  const total = quote.price + serviceFee;

  const handlePlaceOrder = () => {
    placeOrder();
    navigate("/orders");
  };

  return (
    <div className="flex flex-1 flex-col">
      <ScreenHeader title="Checkout" />

      <div className="flex-1 space-y-5 px-4 py-5">
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
          <h2 className="text-sm font-semibold text-navy">Order summary</h2>
          <p className="mt-1 text-xs text-navy/50">
            {printer.name} · {quote.material} · {quote.color}
          </p>

          <div className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between text-navy/70">
              <span>Print cost</span>
              <span>${quote.price.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-navy/70">
              <span>Service fee</span>
              <span>${serviceFee.toFixed(2)}</span>
            </div>
            <div className="flex justify-between border-t border-dashed border-navy/10 pt-2 text-base font-bold text-navy">
              <span>Total</span>
              <span>${total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div>
          <h2 className="mb-2 text-sm font-semibold text-navy">Payment method</h2>
          <div className="space-y-2">
            {PAYMENT_METHODS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setMethod(id)}
                className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors ${
                  method === id
                    ? "border-accent bg-accent/5 text-navy"
                    : "border-black/5 bg-white text-navy/70"
                }`}
              >
                <Icon size={18} className={method === id ? "text-accent" : "text-navy/40"} />
                {label}
                <span
                  className={`ml-auto h-4 w-4 rounded-full border-2 ${
                    method === id ? "border-accent bg-accent" : "border-navy/20"
                  }`}
                />
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-black/5 bg-white px-4 py-3.5">
        <button
          type="button"
          onClick={handlePlaceOrder}
          className="w-full rounded-2xl bg-accent py-3.5 text-sm font-semibold text-white shadow-lg shadow-accent/30 active:scale-[0.98]"
        >
          Place order · ${total.toFixed(2)}
        </button>
      </div>
    </div>
  );
}
