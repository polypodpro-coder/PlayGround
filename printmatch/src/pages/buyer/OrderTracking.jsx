import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { X } from "lucide-react";
import ScreenHeader from "../../components/ScreenHeader";
import ProgressStepper from "../../components/ProgressStepper";
import ChatThread from "../../components/ChatThread";
import StatusBadge from "../../components/StatusBadge";
import { useApp } from "../../context/AppContext";

export default function OrderTracking() {
  const { orderId } = useParams();
  const { orders, updateOrder, printers } = useApp();
  const order = orders.find((o) => o.id === orderId) ?? orders[0];
  const printer = printers.find((p) => p.id === order.printerId) ?? printers[0];
  const [confirmingCancel, setConfirmingCancel] = useState(false);

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
