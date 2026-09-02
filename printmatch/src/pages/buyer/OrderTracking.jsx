import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Star, X } from "lucide-react";
import ScreenHeader from "../../components/ScreenHeader";
import ProgressStepper from "../../components/ProgressStepper";
import ChatThread from "../../components/ChatThread";
import StatusBadge from "../../components/StatusBadge";
import { useApp } from "../../context/AppContext";

export default function OrderTracking() {
  const { orderId } = useParams();
  const { orders, updateOrder, printers, rateOrder } = useApp();
  const order = orders.find((o) => o.id === orderId) ?? orders[0];
  const printer = printers.find((p) => p.id === order.printerId) ?? printers[0];
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [ratingValue, setRatingValue] = useState(0);
  const [ratingText, setRatingText] = useState("");

  // Opening the order clears its "new" indicator in the order history list.
  useEffect(() => {
    if (order.viewed === false) updateOrder(order.id, { viewed: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order.id]);

  const handleSend = (text) => {
    updateOrder(order.id, {
      messages: [
        ...order.messages,
        {
          id: `local-${Date.now()}`,
          senderRole: "buyer",
          text,
          timestamp: new Date().toISOString(),
        },
      ],
    });
  };

  const handleCancel = () => {
    updateOrder(order.id, { status: "cancelled", etaLabel: "Cancelled" });
    setConfirmingCancel(false);
  };

  const canCancel = order.status === "queued";
  const needsRating = order.status === "completed" && order.rated === false;

  const submitRating = () => {
    if (ratingValue === 0) return;
    rateOrder(order.id, order.printerId, { rating: ratingValue, text: ratingText.trim() });
  };

  return (
    <div className="flex flex-1 flex-col">
      <ScreenHeader
        title={printer.name}
        subtitle="Your order"
        right={<StatusBadge status={order.status} />}
      />

      <div className="space-y-4 bg-white px-4 py-5">
        <ProgressStepper status={order.status} />
        <div className="flex items-center justify-between rounded-xl bg-navy/5 px-4 py-3">
          <div>
            <p className="text-xs text-navy/50">Progress</p>
            <p className="text-lg font-bold text-navy">{order.progressPct}%</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-navy/50">Estimated</p>
            <p className="text-sm font-semibold text-accent">{order.etaLabel}</p>
          </div>
        </div>

        {order.shipAddress && (
          <p className="text-xs text-navy/50">
            Shipping to <span className="font-medium text-navy">{order.shipAddress.label}</span> ·{" "}
            {order.shipAddress.line}
          </p>
        )}

        {needsRating && (
          <div className="rounded-2xl bg-navy/5 p-4">
            <h2 className="text-sm font-semibold text-navy">How was your print?</h2>
            <p className="mt-0.5 text-xs text-navy/50">Rate {printer.name} to help other buyers.</p>
            <div className="mt-2.5 flex gap-1">
              {Array.from({ length: 5 }, (_, i) => {
                const value = i + 1;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setRatingValue(value)}
                    aria-label={`Rate ${value} star${value > 1 ? "s" : ""}`}
                  >
                    <Star
                      size={26}
                      className={value <= ratingValue ? "fill-accent text-accent" : "text-navy/20"}
                    />
                  </button>
                );
              })}
            </div>
            {ratingValue > 0 && (
              <>
                <textarea
                  value={ratingText}
                  onChange={(e) => setRatingText(e.target.value)}
                  rows={2}
                  placeholder="Optional — what stood out?"
                  className="mt-3 w-full resize-none rounded-xl bg-white px-3.5 py-2.5 text-sm text-navy outline-none ring-1 ring-black/5 placeholder:text-navy/35 focus:ring-accent"
                />
                <button
                  type="button"
                  onClick={submitRating}
                  className="mt-2.5 w-full rounded-xl bg-accent py-2.5 text-sm font-semibold text-white active:scale-[0.98]"
                >
                  Submit rating
                </button>
              </>
            )}
          </div>
        )}

        {canCancel && !confirmingCancel && (
          <button
            type="button"
            onClick={() => setConfirmingCancel(true)}
            className="w-full text-center text-xs font-semibold text-red-500"
          >
            Cancel order
          </button>
        )}
        {canCancel && confirmingCancel && (
          <div className="flex items-center justify-between rounded-xl bg-red-50 px-4 py-3">
            <p className="text-xs text-red-600">Cancel this order? This can't be undone.</p>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() => setConfirmingCancel(false)}
                className="rounded-full px-3 py-1.5 text-xs font-semibold text-navy/50"
              >
                Keep it
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="flex items-center gap-1 rounded-full bg-red-500 px-3 py-1.5 text-xs font-semibold text-white"
              >
                <X size={12} /> Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 bg-gray-50">
        <ChatThread messages={order.messages} currentRole="buyer" onSend={handleSend} />
      </div>
    </div>
  );
}
