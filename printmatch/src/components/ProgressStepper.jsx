import { Check, Layers, Package, Timer } from "lucide-react";

const STEPS = [
  { key: "queued", label: "Queued", icon: Timer },
  { key: "printing", label: "Printing", icon: Layers },
  { key: "ready", label: "Ready", icon: Package },
];

export default function ProgressStepper({ status }) {
  // A completed order has moved past all three tracked steps.
  const activeIndex =
    status === "completed" ? STEPS.length : STEPS.findIndex((s) => s.key === status);

  return (
    <div className="flex items-center">
      {STEPS.map((step, i) => {
        const Icon = step.icon;
        const done = i < activeIndex;
        const active = i === activeIndex;
        const isLast = i === STEPS.length - 1;

        return (
          <div key={step.key} className={`flex items-center ${isLast ? "" : "flex-1"}`}>
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors ${
                  done
                    ? "bg-accent text-white"
                    : active
                    ? "bg-navy text-white"
                    : "bg-gray-200 text-gray-400"
                }`}
              >
                {done ? <Check size={16} /> : <Icon size={16} />}
              </div>
              <span
                className={`text-[11px] font-medium ${
                  active ? "text-navy" : "text-navy/40"
                }`}
              >
                {step.label}
              </span>
            </div>
            {!isLast && (
              <div
                className={`mx-1.5 mb-4 h-0.5 flex-1 rounded ${
                  done ? "bg-accent" : "bg-gray-200"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
