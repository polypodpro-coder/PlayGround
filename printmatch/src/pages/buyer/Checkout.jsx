import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CreditCard, MapPin, Package, Plus, Sparkles, Store } from "lucide-react";
import ScreenHeader from "../../components/ScreenHeader";
import { useApp } from "../../context/AppContext";

const DELIVERY_METHODS = [
  { id: "pickup", label: "Pick up from shop", icon: Store, fee: 0 },
  { id: "ship", label: "Ship to me", icon: Package, fee: 5 },
];
const TIP_PRESETS = [0, 10, 15, 20];
const SERVICE_FEE = 2.5;

export default function Checkout() {
  const navigate = useNavigate();
  const { selectedQuote, placeOrder, printers, paymentMethods, addresses, currentUser } = useApp();
  const [method, setMethod] = useState(paymentMethods[0]?.id);
  const [delivery, setDelivery] = useState("pickup");
  const [addressId, setAddressId] = useState(addresses[0]?.id);
  const [tipPercent, setTipPercent] = useState(15);
  const [useCredit, setUseCredit] = useState(true);

  const quote = selectedQuote ?? {
    printerId: printers[0].id,
    price: 18.5,
    material: "PETG",
    color: "Black",
  };
  const printer = printers.find((p) => p.id === quote.printerId) ?? printers[0];
  const serviceFee = SERVICE_FEE;
  const shippingFee = DELIVERY_METHODS.find((d) => d.id === delivery)?.fee ?? 0;
  const tip = Math.round(quote.price * (tipPercent / 100) * 100) / 100;
  const subtotal = quote.price + tip + serviceFee + shippingFee;
  const availableCredit = currentUser?.credits ?? 0;
  const creditsUsed = useCredit ? Math.min(availableCredit, subtotal) : 0;
  const total = subtotal - creditsUsed;
  const shipAddress = addresses.find((a) => a.id === addressId);

  const handlePlaceOrder = () => {
    const orderId = placeOrder({
      deliveryMethod: delivery,
      shippingFee,
      serviceFee,
      tip,
      creditsUsed,
      shipAddress: delivery === "ship" ? shipAddress : null,
    });
    navigate(`/orders/${orderId}`);
  };

  return (
    <div className="flex flex-1 flex-col">
      <ScreenHeader title="Checkout" />

      <div className="flex-1 space-y-5 px-4 py-5">
        <div className="rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-black/5">
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
            {shippingFee > 0 && (
              <div className="flex justify-between text-navy/70">
                <span>Shipping</span>
                <span>${shippingFee.toFixed(2)}</span>
              </div>
            )}
            {tip > 0 && (
              <div className="flex justify-between text-navy/70">
                <span>Tip</span>
                <span>${tip.toFixed(2)}</span>
              </div>
            )}
            {creditsUsed > 0 && (
              <div className="flex justify-between text-accent">
                <span>PrintMatch credit</span>
                <span>-${creditsUsed.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-dashed border-navy/10 pt-2 text-base font-bold text-navy">
              <span>Total</span>
              <span>${total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {availableCredit > 0 && (
          <button
            type="button"
            onClick={() => setUseCredit((v) => !v)}
            className="flex w-full items-center gap-3 rounded-2xl bg-accent/5 px-4 py-3 text-left"
          >
            <Sparkles size={18} className="shrink-0 text-accent" />
            <span className="flex-1 text-sm font-medium text-navy">
              Use ${availableCredit.toFixed(2)} PrintMatch credit
            </span>
            <span
              className={`h-4 w-4 shrink-0 rounded-full border-2 ${
                useCredit ? "border-accent bg-accent" : "border-navy/20"
              }`}
            />
          </button>
        )}

        <div>
          <h2 className="mb-2 text-sm font-semibold text-navy">Tip your printer</h2>
          <div className="flex gap-2">
            {TIP_PRESETS.map((pct) => (
              <button
                key={pct}
                type="button"
                onClick={() => setTipPercent(pct)}
                className={`flex-1 rounded-xl border py-2.5 text-sm font-semibold transition-colors ${
                  tipPercent === pct
                    ? "border-accent bg-accent text-white"
                    : "border-black/5 bg-surface text-navy/70"
                }`}
              >
                {pct === 0 ? "No tip" : `${pct}%`}
              </button>
            ))}
          </div>
        </div>

        <div>
          <h2 className="mb-2 text-sm font-semibold text-navy">Delivery method</h2>
          <div className="space-y-2">
            {DELIVERY_METHODS.map(({ id, label, icon: Icon, fee }) => (
              <button
                key={id}
                type="button"
                onClick={() => setDelivery(id)}
                className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors ${
                  delivery === id
                    ? "border-accent bg-accent/5 text-navy"
                    : "border-black/5 bg-surface text-navy/70"
                }`}
              >
                <Icon size={18} className={delivery === id ? "text-accent" : "text-navy/40"} />
                <span className="flex-1">{label}</span>
                <span className="text-xs text-navy/40">{fee > 0 ? `+$${fee.toFixed(2)}` : "Free"}</span>
                <span
                  className={`h-4 w-4 shrink-0 rounded-full border-2 ${
                    delivery === id ? "border-accent bg-accent" : "border-navy/20"
                  }`}
                />
              </button>
            ))}
          </div>
        </div>

        {delivery === "ship" && (
          <div>
            <h2 className="mb-2 text-sm font-semibold text-navy">Ship to</h2>
            {addresses.length === 0 ? (
              <button
                type="button"
                onClick={() => navigate("/account")}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-navy/20 py-3 text-xs font-semibold text-navy/60"
              >
                <Plus size={13} /> Add an address in Account
              </button>
            ) : (
              <div className="space-y-2">
                {addresses.map((addr) => (
                  <button
                    key={addr.id}
                    type="button"
                    onClick={() => setAddressId(addr.id)}
                    className={`flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
                      addressId === addr.id
                        ? "border-accent bg-accent/5"
                        : "border-black/5 bg-surface"
                    }`}
                  >
                    <MapPin
                      size={16}
                      className={`mt-0.5 shrink-0 ${addressId === addr.id ? "text-accent" : "text-navy/40"}`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-navy">{addr.label}</p>
                      <p className="text-xs text-navy/50">{addr.line}</p>
                    </div>
                    <span
                      className={`mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 ${
                        addressId === addr.id ? "border-accent bg-accent" : "border-navy/20"
                      }`}
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div>
          <h2 className="mb-2 text-sm font-semibold text-navy">Payment method</h2>
          <div className="space-y-2">
            {paymentMethods.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setMethod(id)}
                className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors ${
                  method === id
                    ? "border-accent bg-accent/5 text-navy"
                    : "border-black/5 bg-surface text-navy/70"
                }`}
              >
                <CreditCard size={18} className={method === id ? "text-accent" : "text-navy/40"} />
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

      <div className="border-t border-black/5 bg-surface px-4 py-3.5">
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
