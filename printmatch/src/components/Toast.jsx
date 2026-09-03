import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";

export default function Toast({ toast, onClose }) {
  if (!toast) return null;

  const icons = {
    error: <AlertCircle size={16} className="text-red-600 shrink-0" />,
    success: <CheckCircle2 size={16} className="text-green-600 shrink-0" />,
    info: <Info size={16} className="text-accent shrink-0" />,
  };

  const borderColors = {
    error: "border-red-200 bg-red-50 text-red-900",
    success: "border-green-200 bg-green-50 text-green-900",
    info: "border-accent/30 bg-white text-navy",
  };

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-[420px] px-4 pointer-events-none transition-all duration-300">
      <div
        className={`pointer-events-auto flex items-center justify-between gap-2.5 rounded-2xl border p-3.5 shadow-xl backdrop-blur ${
          borderColors[toast.type || "info"]
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {icons[toast.type || "info"]}
          <span className="text-xs font-semibold leading-tight truncate">
            {toast.message}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="h-6 w-6 rounded-full flex items-center justify-center text-navy/40 hover:text-navy hover:bg-black/5"
          aria-label="Close notification"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
