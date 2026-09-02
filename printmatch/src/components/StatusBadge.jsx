const STYLES = {
  available: "bg-emerald-100 text-emerald-700",
  printing: "bg-orange-100 text-orange-700",
  ready: "bg-blue-100 text-blue-700",
  offline: "bg-gray-200 text-gray-500",
  queued: "bg-gray-200 text-gray-600",
  pending: "bg-amber-100 text-amber-700",
  completed: "bg-emerald-100 text-emerald-700",
  paused: "bg-amber-100 text-amber-700",
};

const LABELS = {
  available: "Available",
  printing: "Printing",
  ready: "Ready",
  offline: "Offline",
  queued: "Queued",
  pending: "Pending",
  completed: "Completed",
  paused: "Paused",
};

export default function StatusBadge({ status, label }) {
  const style = STYLES[status] ?? "bg-gray-200 text-gray-600";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${style}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label ?? LABELS[status] ?? status}
    </span>
  );
}
