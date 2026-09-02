import { useCallback, useState } from "react";
import { MapPin, Printer } from "lucide-react";
import ScreenHeader from "../../components/ScreenHeader";
import StatusBadge from "../../components/StatusBadge";
import ServiceAreaMap from "../../components/ServiceAreaMap";
import { ownerPrinters as initialPrinters, serviceArea } from "../../data/mockData";

const CYCLE = ["available", "printing", "offline"];
const MIN_RADIUS = 1;
const MAX_RADIUS = 25;

export default function PrinterSettings() {
  const [printers, setPrinters] = useState(initialPrinters);
  const [center, setCenter] = useState(serviceArea.center);
  const [radiusMi, setRadiusMi] = useState(serviceArea.radiusMi);

  const handleCenterChange = useCallback((next) => setCenter(next), []);

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
      <ScreenHeader title="Settings" subtitle="Service area & printers" />

      <div className="flex-1 space-y-5 px-4 py-5">
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-navy">Service area</h2>
            <span className="flex items-center gap-1 text-xs font-semibold text-accent">
              <MapPin size={13} />
              {radiusMi} mi radius
            </span>
          </div>

          <ServiceAreaMap
            center={center}
            radiusMi={radiusMi}
            onCenterChange={handleCenterChange}
          />

          <p className="mt-2.5 text-xs text-navy/40">
            Drag the pin to set your shop location.
          </p>

          <div className="mt-3.5">
            <div className="mb-1.5 flex items-center justify-between text-xs font-medium text-navy/50">
              <span>{MIN_RADIUS} mi</span>
              <span>{MAX_RADIUS} mi</span>
            </div>
            <input
              type="range"
              min={MIN_RADIUS}
              max={MAX_RADIUS}
              value={radiusMi}
              onChange={(e) => setRadiusMi(Number(e.target.value))}
              className="w-full accent-accent"
              aria-label="Service radius in miles"
            />
          </div>

          <p className="mt-2 text-xs text-navy/60">
            You'll receive job requests from buyers within{" "}
            <span className="font-semibold text-navy">{radiusMi} miles</span> of
            your pin.
          </p>
        </div>

        <div>
          <h2 className="mb-2.5 text-sm font-semibold text-navy">Printers</h2>
          <div className="space-y-2.5">
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
      </div>
    </div>
  );
}
