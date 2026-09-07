import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, CheckCircle2, Clock, Package, Plus, Search } from "lucide-react";
import ShopLogo from "../../components/ShopLogo";
import { useApp } from "../../context/AppContext";

const STATUS = { queued: "Queued", printing: "Printing", ready: "Ready", completed: "Completed", cancelled: "Cancelled" };
function dateLabel(iso) { const date = new Date(iso); return Number.isNaN(date.getTime()) ? "Date unavailable" : date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }); }

export default function OrderHistory() {
  const navigate = useNavigate();
  const { orders, printers } = useApp();
  const [filter, setFilter] = useState("all"), [search, setSearch] = useState("");
  const activeCount = orders.filter((order) => !["completed", "cancelled"].includes(order.status)).length;
  const completedCount = orders.filter((order) => order.status === "completed").length;
  const filtered = useMemo(() => [...orders].filter((order) => {
    const farm = printers.find((item) => item.id === order.printerId);
    const matchesStatus = filter === "all" || (filter === "active" ? !["completed", "cancelled"].includes(order.status) : order.status === filter);
    return matchesStatus && `${order.fileName || ""} ${order.id} ${farm?.name || ""} ${order.material}`.toLowerCase().includes(search.toLowerCase().trim());
  }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)), [orders, printers, filter, search]);
  return <div className="app-page">
    <header className="page-intro"><div><p className="eyebrow">The print workspace</p><h1 className="page-heading">Keep your projects moving.</h1><p className="body-copy">Follow example orders, explore conversations, and review finished samples.</p></div><button type="button" className="button" onClick={() => navigate("/request")}><Plus size={17} /> New request</button></header>
    <div className="mb-7 grid gap-3 sm:grid-cols-3">{[{ label: "Sample orders", value: orders.length, Icon: Package }, { label: "In progress · simulated", value: activeCount, Icon: Clock }, { label: "Completed · simulated", value: completedCount, Icon: CheckCircle2 }].map(({ label, value, Icon }) => <div key={label} className="panel flex items-center justify-between"><div><p className="text-sm text-navy/60">{label}</p><p className="mt-2 text-3xl font-bold">{value}</p></div><Icon size={26} className="text-accent" /></div>)}</div>
    <div className="mb-5 flex flex-wrap items-center justify-between gap-4"><div className="flex flex-wrap gap-2">{[{ id: "all", label: "All orders" }, { id: "active", label: "In progress" }, { id: "completed", label: "Completed" }, { id: "cancelled", label: "Cancelled" }].map(({ id, label }) => <button type="button" className={`chip ${filter === id ? "chip-active" : ""}`} key={id} aria-pressed={filter === id} onClick={() => setFilter(id)}>{label}</button>)}</div><label className="flex min-h-11 items-center gap-2 rounded-xl border border-navy/15 bg-white px-3"><Search size={16} className="text-navy/50" /><span className="sr-only">Search sample orders</span><input className="min-w-0 bg-transparent text-sm outline-none" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search your samples" /></label></div>
    <div className="stack">{filtered.map((order) => {
      const farm = printers.find((item) => item.id === order.printerId);
      const total = order.total ?? ((order.printCost || 0) + (order.serviceFee || 0) + (order.shippingFee || 0) + (order.tip || 0) - (order.creditsUsed || 0));
      return <article key={order.id} className="panel"><div className="flex flex-wrap items-center justify-between gap-4 border-b border-navy/10 pb-4"><div className="flex items-center gap-3">{farm && <ShopLogo src={farm.logoUrl} alt="" size="sm" />}<div><p className="font-semibold">{farm?.name || "Example farm"}</p><p className="mt-1 text-xs text-navy/55">{dateLabel(order.createdAt)} · {order.id}</p></div></div><span className="badge">Sample · {STATUS[order.status] || order.status}</span></div><div className="flex flex-wrap items-center justify-between gap-5 pt-5"><div><h2 className="break-words text-lg font-semibold">{order.fileName || `${order.material} decorative print`}</h2><p className="mt-2 text-sm text-navy/60">{order.quantity || 1} {(order.quantity || 1) === 1 ? "piece" : "pieces"} · {order.material} · {order.color || "Color to be agreed"}</p><p className="mt-2 text-xs text-navy/55">${total.toFixed(2)} sample subtotal · no payment collected</p></div><button type="button" className="button-secondary" onClick={() => navigate(`/orders/${order.id}`)}>{order.status === "completed" && !order.rated ? "View & try a review" : "Open order"}<ArrowRight size={16} /></button></div></article>;
    })}</div>
    {!filtered.length && <div className="empty-state"><Package size={34} className="mx-auto mb-4" /><h2 className="mb-2 text-xl font-bold">No sample orders match.</h2><p className="mb-5">{orders.length ? "Try another search or status filter." : "Configure a part to explore your first sample order."}</p><button type="button" className="button-secondary" onClick={() => { if (orders.length) { setSearch(""); setFilter("all"); } else navigate("/request"); }}>{orders.length ? "Clear filters" : "Start a sample request"}</button></div>}
    <p className="mt-6 text-center text-xs leading-relaxed text-navy/55">All orders on this page are examples. Preview changes are temporary and reset when the app reloads.</p>
  </div>;
}
