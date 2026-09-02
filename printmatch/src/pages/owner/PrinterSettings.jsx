import { useState } from "react";
import { Printer } from "lucide-react";
import ScreenHeader from "../../components/ScreenHeader";
import StatusBadge from "../../components/StatusBadge";
import { ownerPrinters as initialPrinters } from "../../data/mockData";

const CYCLE = ["available", "printing", "offline"];

export default function PrinterSettings() {
  const [printers, setPrinters] = useState(initialPrinters);

  const cycleStatus = (id) => {
    setPrinters((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, status: CYCLE[(CYCLE.indexOf(p.status) + 1) % CYCLE.length] }
          : p
      )
    );
  };

  return (
    <div className="flex flex-1 flex-col">
      <ScreenHeader title="Printer management" subtitle="Tap status to change it" />

      <div className="flex-1 space-y-2.5 px-4 py-5">
        {printers.map((p) => (
          <div
            key={p.id}
            className="flex items-center justify-between rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-navy/5 text-navy/50">
                <Printer size={19} />
              </div>
              <div>
                <p className="text-sm font-semibold text-navy">{p.name}</p>
                <p className="text-xs text-navy/50">{p.materials.join(" · ")}</p>
              </div>
            </div>
            <button type="button" onClick={() => cycleStatus(p.id)}>
              <StatusBadge status={p.status} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
