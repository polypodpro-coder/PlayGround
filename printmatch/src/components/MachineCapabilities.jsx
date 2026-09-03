import { useState } from "react";
import { Cpu, Maximize2, Layers, Check, ChevronDown, ChevronUp } from "lucide-react";
import { FLEET_MACHINES } from "../data/mockData";

export default function MachineCapabilities({ selectedMachineId, onSelectMachine }) {
  const [expandedId, setExpandedId] = useState(FLEET_MACHINES[0].id);

  const toggleExpand = (id) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-navy flex items-center gap-1.5">
            <Cpu size={16} className="text-accent" /> Fleet Machine Capabilities
          </h3>
          <p className="text-xs text-navy/50">
            Precision engineering fleet calibrated for rapid turnarounds
          </p>
        </div>
      </div>

      <div className="space-y-2.5">
        {FLEET_MACHINES.map((m) => {
          const isExpanded = expandedId === m.id;
          const isSelected = selectedMachineId === m.id;

          return (
            <div
              key={m.id}
              className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                isSelected
                  ? "border-accent bg-accent/5 ring-1 ring-accent"
                  : "border-gray-200 bg-surface hover:border-gray-300"
              }`}
            >
              <div
                className="p-3.5 flex items-center justify-between cursor-pointer select-none"
                onClick={() => toggleExpand(m.id)}
              >
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-navy text-white text-xs font-bold shadow-xs">
                    {m.name.includes("Bambu") ? "BL" : "PR"}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h4 className="text-xs font-bold text-navy">{m.name}</h4>
                      <span className="rounded bg-navy/10 px-1.5 py-0.2 text-[9px] font-bold text-navy">
                        {m.badge}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-navy/60 mt-0.5">
                      <span className="flex items-center gap-1 font-mono font-semibold text-accent">
                        <Maximize2 size={11} /> {m.buildVolume.x} &times; {m.buildVolume.y} &times; {m.buildVolume.z} {m.buildVolume.unit}
                      </span>
                      <span>&bull;</span>
                      <span>{m.maxTemp}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {onSelectMachine && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectMachine(m.id);
                      }}
                      className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
                        isSelected
                          ? "bg-accent text-white"
                          : "bg-navy/10 text-navy hover:bg-navy/20"
                      }`}
                    >
                      {isSelected ? "Selected" : "Select"}
                    </button>
                  )}
                  <button
                    type="button"
                    aria-label={isExpanded ? "Collapse machine details" : "Expand machine details"}
                    className="h-7 w-7 rounded-full bg-navy/5 flex items-center justify-center text-navy/60 hover:bg-navy/10"
                  >
                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div className="border-t border-gray-100 bg-white/70 p-3 text-xs space-y-2">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-navy/40 block mb-1">
                      Key Hardware Capabilities
                    </span>
                    <ul className="space-y-1 text-navy/80">
                      {m.features.map((feat, idx) => (
                        <li key={idx} className="flex items-start gap-1.5 text-[11px]">
                          <Check size={12} className="text-green-600 shrink-0 mt-0.5" />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="pt-1 flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] text-navy/40 font-semibold flex items-center gap-1">
                      <Layers size={10} /> Compatible:
                    </span>
                    {m.materials.map((mat) => (
                      <span
                        key={mat}
                        className="rounded-md bg-navy/5 px-2 py-0.5 text-[10px] font-medium text-navy/70"
                      >
                        {mat}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
