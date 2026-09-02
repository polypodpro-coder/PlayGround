import { useNavigate } from "react-router-dom";
import { ChevronRight, Star } from "lucide-react";
import ShopLogo from "../../components/ShopLogo";
import StatusBadge from "../../components/StatusBadge";
import { useApp } from "../../context/AppContext";

function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function OrderHistory() {
  const navigate = useNavigate();
  const { orders, printers } = useApp();

  const sorted = [...orders].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );

  return (
    <div className="flex flex-1 flex-col">
      <header className="bg-navy px-4 pb-5 pt-5 text-white">
        <h1 className="text-lg font-semibold">Your orders</h1>
        <p className="text-xs text-white/60">
          {orders.filter((o) => !["completed", "cancelled"].includes(o.status)).length} in
          progress · {orders.filter((o) => o.status === "completed").length} completed
        </p>
      </header>

      <div className="flex-1 space-y-2.5 px-4 py-4">
        {sorted.map((order) => {
          const printer = printers.find((p) => p.id === order.printerId);
          if (!printer) return null;
          const total =
            order.printCost +
            order.serviceFee +
            (order.shippingFee ?? 0) +
            (order.tip ?? 0) -
            (order.creditsUsed ?? 0);
          const isCompleted = order.status === "completed";

          return (
            <div
              key={order.id}
              className="rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-black/5"
            >
              <button
                type="button"
                onClick={() => navigate(`/orders/${order.id}`)}
                className="flex w-full items-center gap-3 text-left active:scale-[0.98]"
              >
                <div className="relative shrink-0">
                  <ShopLogo src={printer.logoUrl} alt={`${printer.name} logo`} />
                  {order.viewed === false && (
                    <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-accent ring-2 ring-white" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-navy">{printer.name}</p>
                  <p className="text-xs text-navy/50">
                    {order.material} · {order.color} · {formatDate(order.createdAt)}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <StatusBadge status={order.status} />
                  <span className="text-xs font-semibold text-navy/70">
                    ${total.toFixed(2)}
                  </span>
                </div>
                <ChevronRight size={16} className="shrink-0 text-navy/30" />
              </button>

              {isCompleted && (
                <div className="mt-3 flex gap-2">
                  {order.rated === false && (
                    <button
                      type="button"
                      onClick={() => navigate(`/orders/${order.id}`)}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-accent/10 py-2 text-xs font-semibold text-accent active:scale-[0.98]"
                    >
                      <Star size={13} /> Rate this order
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => navigate("/request")}
                    className="flex-1 rounded-full border border-navy/15 py-2 text-xs font-semibold text-navy active:scale-[0.98]"
                  >
                    Reorder
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {orders.length === 0 && (
          <p className="py-10 text-center text-sm text-navy/40">
            No orders yet — request a print to get started.
          </p>
        )}
      </div>
    </div>
  );
}
