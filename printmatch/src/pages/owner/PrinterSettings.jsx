import { useEffect, useRef, useState } from "react";
import { Loader2, MapPin, Printer, Search, Upload } from "lucide-react";
import ScreenHeader from "../../components/ScreenHeader";
import StatusBadge from "../../components/StatusBadge";
import ShopLogo from "../../components/ShopLogo";
import ServiceAreaMap from "../../components/ServiceAreaMap";
import { ownerPrinters as initialPrinters } from "../../data/mockData";
import { useApp } from "../../context/AppContext";

const CYCLE = ["available", "printing", "offline"];
const MIN_RADIUS = 1;
const MAX_RADIUS = 25;

export default function PrinterSettings() {
  const { myShop, updateMyShop } = useApp();
  const [printers, setPrinters] = useState(initialPrinters);

  const [address, setAddress] = useState("");
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeError, setGeocodeError] = useState("");

  const [latText, setLatText] = useState(myShop.location[0].toFixed(5));
  const [lngText, setLngText] = useState(myShop.location[1].toFixed(5));
  const fileInputRef = useRef(null);

  // Keep the lat/lng text fields in sync when the location changes from
  // elsewhere (dragging the pin, or a successful address lookup).
  useEffect(() => {
    setLatText(myShop.location[0].toFixed(5));
    setLngText(myShop.location[1].toFixed(5));
  }, [myShop.location]);

  const cycleStatus = (id) => {
    setPrinters((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, status: CYCLE[(CYCLE.indexOf(p.status) + 1) % CYCLE.length] }
          : p
      )
    );
  };

  const handleLocate = async (e) => {
    e.preventDefault();
    if (!address.trim() || geocoding) return;
    setGeocoding(true);
    setGeocodeError("");
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address)}`
      );
      if (!res.ok) throw new Error("Lookup failed");
      const results = await res.json();
      if (!results.length) {
        setGeocodeError("No matches found for that address.");
        return;
      }
      updateMyShop({ location: [parseFloat(results[0].lat), parseFloat(results[0].lon)] });
    } catch {
      setGeocodeError("Couldn't reach the address lookup. Enter coordinates below instead.");
    } finally {
      setGeocoding(false);
    }
  };

  const commitLatLng = () => {
    const lat = parseFloat(latText);
    const lng = parseFloat(lngText);
    if (
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      lat >= -90 &&
      lat <= 90 &&
      lng >= -180 &&
      lng <= 180
    ) {
      updateMyShop({ location: [lat, lng] });
    } else {
      // Invalid entry — snap the fields back to the last known-good value.
      setLatText(myShop.location[0].toFixed(5));
      setLngText(myShop.location[1].toFixed(5));
    }
  };

  const handleLogoFile = (fileList) => {
    const file = fileList?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => updateMyShop({ logoUrl: reader.result });
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex flex-1 flex-col">
      <ScreenHeader title="Settings" subtitle="Shop, service area & printers" />

      <div className="flex-1 space-y-5 px-4 py-5">
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
          <h2 className="mb-3 text-sm font-semibold text-navy">Shop logo</h2>
          <div className="flex items-center gap-4">
            <ShopLogo src={myShop.logoUrl} alt="Your shop logo" size="lg" />
            <div className="flex flex-1 flex-col gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center justify-center gap-1.5 rounded-full bg-navy px-4 py-2 text-xs font-semibold text-white active:scale-95"
              >
                <Upload size={13} />
                Upload logo
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleLogoFile(e.target.files)}
                />
              </button>
              {myShop.logoUrl && (
                <button
                  type="button"
                  onClick={() => updateMyShop({ logoUrl: null })}
                  className="text-xs font-medium text-navy/40 hover:text-navy/60"
                >
                  Remove logo
                </button>
              )}
            </div>
          </div>
          <p className="mt-3 text-xs text-navy/40">
            Shown to buyers on your listing and on the service-area map.
          </p>
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-navy">Service area</h2>
            <span className="flex items-center gap-1 text-xs font-semibold text-accent">
              <MapPin size={13} />
              {myShop.serviceRadiusMi} mi radius
            </span>
          </div>

          <ServiceAreaMap
            center={myShop.location}
            radiusMi={myShop.serviceRadiusMi}
            onCenterChange={(next) => updateMyShop({ location: next })}
          />

          <p className="mt-2.5 text-xs text-navy/40">
            Drag the pin, or enter your location manually below.
          </p>

          <form onSubmit={handleLocate} className="mt-3.5">
            <label className="mb-1.5 block text-xs font-medium text-navy/50">
              Shop address
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="123 Main St, Springfield, IL"
                className="min-w-0 flex-1 rounded-xl bg-gray-50 px-3.5 py-2.5 text-sm text-navy outline-none ring-1 ring-black/5 focus:ring-accent"
              />
              <button
                type="submit"
                disabled={geocoding}
                className="flex shrink-0 items-center gap-1.5 rounded-xl bg-navy px-4 text-xs font-semibold text-white disabled:opacity-50"
              >
                {geocoding ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Search size={14} />
                )}
                Locate
              </button>
            </div>
            {geocodeError && (
              <p className="mt-1.5 text-xs text-red-500">{geocodeError}</p>
            )}
          </form>

          <div className="mt-3.5 grid grid-cols-2 gap-2.5">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-navy/50">
                Latitude
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={latText}
                onChange={(e) => setLatText(e.target.value)}
                onBlur={commitLatLng}
                className="w-full rounded-xl bg-gray-50 px-3.5 py-2.5 text-sm text-navy outline-none ring-1 ring-black/5 focus:ring-accent"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-navy/50">
                Longitude
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={lngText}
                onChange={(e) => setLngText(e.target.value)}
                onBlur={commitLatLng}
                className="w-full rounded-xl bg-gray-50 px-3.5 py-2.5 text-sm text-navy outline-none ring-1 ring-black/5 focus:ring-accent"
              />
            </div>
          </div>

          <div className="mt-4">
            <div className="mb-1.5 flex items-center justify-between text-xs font-medium text-navy/50">
              <span>{MIN_RADIUS} mi</span>
              <span>{MAX_RADIUS} mi</span>
            </div>
            <input
              type="range"
              min={MIN_RADIUS}
              max={MAX_RADIUS}
              value={myShop.serviceRadiusMi}
              onChange={(e) => updateMyShop({ serviceRadiusMi: Number(e.target.value) })}
              className="w-full accent-accent"
              aria-label="Service radius in miles"
            />
          </div>

          <p className="mt-2 text-xs text-navy/60">
            You'll receive job requests from buyers within{" "}
            <span className="font-semibold text-navy">{myShop.serviceRadiusMi} miles</span> of
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
