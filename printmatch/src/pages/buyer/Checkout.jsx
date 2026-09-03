import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { CreditCard, MapPin, Package, Plus, Sparkles, Store, ShieldCheck, CheckCircle2 } from "lucide-react";
import ScreenHeader from "../../components/ScreenHeader";
import { useApp } from "../../context/AppContext";
import { FLEET_MACHINES, POST_PROCESSING_ADDONS } from "../../data/mockData";

const DELIVERY_METHODS = [
  { id: "pickup", label: "Pick up from local shop hub", icon: Store, fee: 0 },
  { id: "ship", label: "Local courier dispatch", icon: Package, fee: 4.99 },
];
const TIP_PRESETS = [0, 10, 15, 20];
const SERVICE_FEE = 2.5;

export default function Checkout() {
  const navigate = useNavigate();
  const {
    selectedQuote,
    placeOrder,
    printers,
    paymentMethods,
    addresses,
    currentUser,
    selectedMaterial,
    selectedMachineId,
    selectedAddons,
  } = useApp();

  const [method, setMethod] = useState(paymentMethods[0]?.id);
  const [delivery, setDelivery] = useState("pickup");
  const [addressId, setAddressId] = useState(addresses[0]?.id);
  const [tipPercent, setTipPercent] = useState(15);
  const [useCredit, setUseCredit] = useState(true);

  const quote = selectedQuote ?? {
    printerId: printers[0].id,
    price: 18.5,
    material: selectedMaterial || "PETG",
    color: "Black",
    machineId: selectedMachineId || "bambu-x1c",
    addons: selectedAddons || [],
  };

  const printer = printers.find((p) => p.id === quote.printerId) ?? printers[0];
  const activeMachine = FLEET_MACHINES.find((m) => m.id === (quote.machineId || selectedMachineId)) || FLEET_MACHINES[0];

  const activeAddonsList = useMemo(() => {
    const ids = quote.addons?.length ? quote.addons : selectedAddons;
    return (ids || [])
      .map((id) => POST_PROCESSING_ADDONS.find((a) => a.id === id))
      .filter(Boolean);
  }, [quote.addons, selectedAddons]);

  const serviceFee = SERVICE_FEE;
  const shippingFee = DELIVERY_METHODS.find((d) => d.id === delivery)?.fee ?? 0;
  const tip = Math.round(quote.price * (tipPercent / 100) * 100) / 100;
  const subtotal = quote.price + tip + serviceFee + shippingFee;
  const availableCredit = currentUser?.credits ?? 0;
  const creditsUsed = useCredit ? Math.min(availableCredit, subtotal) : 0;
  const total = Math.max(0, subtotal - creditsUsed);
  const shipAddress = addresses.find((a) => a.id === addressId);

  const handlePlaceOrder = () => {
    const orderId = placeOrder({
      deliveryMethod: delivery,
      shippingFee,
      serviceFee,
      tip,
      creditsUsed,
      shipAddress: delivery === "ship" ? shipAddress : null,
      machineId: activeMachine.id,
      addons: activeAddonsList.map((a) => a.id),
    });
    navigate(`/orders/${orderId}`);
  };

  return (
    <div className="flex flex-1 flex-col">
      <ScreenHeader title="Secure Checkout" onBack={() => navigate("/quotes")} />

      <div className="flex-1 space-y-5 px-4 py-5">
        {/* Escrow Guarantee Callout */}
        <div className="rounded-2xl border border-green-600/20 bg-green-50/70 p-3.5 text-xs text-navy flex items-start gap-2.5">
          <CheckCircle2 size={18} className="text-green-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-green-950">Poly POD Escrow Protection</p>
            <p className="mt-0.5 text-green-900/80 leading-snug text-[11px]">
              Your payment is held safely in escrow until you receive and verify dimensional tolerances (±0.15mm).
            </p>
          </div>
        </div>

        {/* Order Summary */}
        <div className="rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-black/5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-navy">Order summary</h2>
            <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-bold text-accent">
              {quote.material}
            </span>
          </div>

          <p className="mt-1 text-xs text-navy/60">
            {printer.name} &bull; {activeMachine.name}
          </p>

          {activeAddonsList.length > 0 && (
            <div className="mt-2 text-[11px] text-navy/70 border-t border-dashed border-navy/10 pt-2 space-y-0.5">
              <span className="font-semibold text-navy/80 block">Included Add-ons:</span>
              {activeAddonsList.map((addon) => (
                <div key={addon.id} className="flex justify-between">
                  <span>&bull; {addon.name}</span>
                  <span className="font-medium">+${addon.cost.toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between text-navy/70">
              <span>Print fabrication cost</span>
              <span>${quote.price.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-navy/70">
              <span>Escrow &amp; Slicer service fee</span>
              <span>${serviceFee.toFixed(2)}</span>
            </div>
            {shippingFee > 0 && (
              <div className="flex justify-between text-navy/70">
                <span>Fulfillment dispatch</span>
                <span>${shippingFee.toFixed(2)}</span>
              </div>
            )}
            {tip > 0 && (
              <div className="flex justify-between text-navy/70">
                <span>Tip to shop owner</span>
                <span>${tip.toFixed(2)}</span>
              </div>
            )}
            {creditsUsed > 0 && (
              <div className="flex justify-between text-accent font-semibold">
                <span>Poly POD credit</span>
                <span>-${creditsUsed.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-dashed border-navy/10 pt-2 text-base font-bold text-navy">
              <span>Total Due</span>
              <span className="text-accent">${total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {availableCredit > 0 && (
          <button
            type="button"
            onClick={() => setUseCredit((v) => !v)}
            className="flex w-full items-center gap-3 rounded-2xl bg-accent/5 px-4 py-3 text-left transition hover:bg-accent/10 active:scale-[0.99] cursor-pointer"
          >
            <Sparkles size={18} className="shrink-0 text-accent" />
            <span className="flex-1 text-sm font-medium text-navy">
              Use ${availableCredit.toFixed(2)} Poly POD credit
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
                className={`flex-1 rounded-xl border py-2.5 text-sm font-semibold transition-colors cursor-pointer ${
                  tipPercent === pct
                    ? "border-accent bg-accent text-white shadow-xs"
                    : "border-black/5 bg-surface text-navy/70 hover:bg-navy/5"
                }`}
              >
                {pct === 0 ? "No tip" : `${pct}%`}
              </button>
            ))}
          </div>
        </div>

        <div>
          <h2 className="mb-2 text-sm font-semibold text-navy">Fulfillment method</h2>
          <div className="space-y-2">
            {DELIVERY_METHODS.map(({ id, label, icon: Icon, fee }) => (
              <button
                key={id}
                type="button"
                onClick={() => setDelivery(id)}
                className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors cursor-pointer ${
                  delivery === id
                    ? "border-accent bg-accent/5 text-navy ring-1 ring-accent"
                    : "border-black/5 bg-surface text-navy/70 hover:border-navy/20"
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
            <h2 className="mb-2 text-sm font-semibold text-navy">Ship to address</h2>
            {addresses.length === 0 ? (
              <button
                type="button"
                onClick={() => navigate("/account")}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-navy/20 py-3 text-xs font-semibold text-navy/60 cursor-pointer hover:border-accent"
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
                    className={`flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left transition-colors cursor-pointer ${
                      addressId === addr.id
                        ? "border-accent bg-accent/5 ring-1 ring-accent"
                        : "border-black/5 bg-surface hover:border-navy/20"
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
                className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors cursor-pointer ${
                  method === id
                    ? "border-accent bg-accent/5 text-navy ring-1 ring-accent"
                    : "border-black/5 bg-surface text-navy/70 hover:border-navy/20"
                }`}
              >
                <CreditCard size={18} className={method === id ? "text-accent" : "text-navy/40"} />
                <span>{label}</span>
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
          className="btn-primary w-full py-4 text-sm font-semibold text-white shadow-lg shadow-accent/30 active:scale-[0.98] cursor-pointer"
        >
          Authorize Escrow &bull; ${total.toFixed(2)}
        </button>
      </div>
    </div>
  );
}
