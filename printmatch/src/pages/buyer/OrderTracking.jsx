import { useState } from "react";
import ScreenHeader from "../../components/ScreenHeader";
import ProgressStepper from "../../components/ProgressStepper";
import ChatThread from "../../components/ChatThread";
import StatusBadge from "../../components/StatusBadge";
import { printers } from "../../data/mockData";
import { useApp } from "../../context/AppContext";

export default function OrderTracking() {
  const { order } = useApp();
  const printer = printers.find((p) => p.id === order.printerId) ?? printers[0];
  const [messages, setMessages] = useState(order.messages);

  const handleSend = (text) => {
    setMessages((prev) => [
      ...prev,
      {
        id: `local-${Date.now()}`,
        senderRole: "buyer",
        text,
        timestamp: new Date().toISOString(),
      },
    ]);
  };

  return (
    <div className="flex flex-1 flex-col">
      <ScreenHeader
        title={printer.name}
        subtitle="Your order"
        right={<StatusBadge status={order.status} />}
      />

      <div className="space-y-5 bg-white px-4 py-5">
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
      </div>

      <div className="min-h-0 flex-1 bg-gray-50">
        <ChatThread messages={messages} currentRole="buyer" onSend={handleSend} />
      </div>
    </div>
  );
}
