import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Info, Link2, Loader2, LogOut, MapPin, Moon, Plus, Printer, Search, Upload, X } from "lucide-react";
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
  const navigate = useNavigate();
  const { myShop, updateMyShop, currentUser, logout } = useApp();
  const [printers, setPrinters] = useState(initialPrinters);

  const [address, setAddress] = useState("");
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeError, setGeocodeError] = useState("");

  const [latText, setLatText] = useState(myShop.location[0].toFixed(5));
  const [lngText, setLngText] = useState(myShop.location[1].toFixed(5));
  const fileInputRef = useRef(null);
  const portfolioInputRef = useRef(null);
  const [printerLinkStatus, setPrinterLinkStatus] = useState("disconnected"); // 'disconnected' | 'connecting' | 'connected'

  const handleConnectPrinter = () => {
    setPrinterLinkStatus("connecting");
    setTimeout(() => setPrinterLinkStatus("connected"), 1200);
  };

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

  const handlePortfolioFile = (fileList) => {
    const file = fileList?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const photo = { id: `photo-${Date.now()}`, imageUrl: reader.result, caption: file.name };
      updateMyShop({ portfolio: [...(myShop.portfolio ?? []), photo] });
    };
    reader.readAsDataURL(file);
  };

  const removePortfolioPhoto = (id) => {
    updateMyShop({ portfolio: myShop.portfolio.filter((p) => p.id !== id) });
  };

  const setPricingRate = (material, value) => {
    const rate = Number(value);
    updateMyShop({
      pricingRates: { ...myShop.pricingRates, [material]: Number.isFinite(rate) ? rate : 0 },
    });
  };

  return (
    <div className="flex flex-1 flex-col">
      <ScreenHeader title="Settings" subtitle="Shop, service area & printers" />

      <div className="flex-1 space-y-5 px-4 py-5">
        <div className="rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-black/5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-navy">{currentUser?.name}</p>
              <p className="text-xs text-navy/50">{currentUser?.email}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                logout();
                navigate("/login");
              }}
              className="flex items-center gap-1.5 rounded-full border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-500 active:scale-95"
            >
              <LogOut size={13} />
              Log out
            </button>
          </div>
        </div>

        <div className="rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-black/5">
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

          <label className="mb-1.5 mt-4 block text-xs font-medium text-navy/50">
            Shop bio
          </label>
          <textarea
            value={myShop.bio ?? ""}
            onChange={(e) => updateMyShop({ bio: e.target.value })}
            rows={3}
            placeholder="Tell buyers about your setup, specialties, or turnaround..."
            className="w-full resize-none rounded-xl bg-surface-alt px-3.5 py-2.5 text-sm text-navy outline-none ring-1 ring-black/5 placeholder:text-navy/35 focus:ring-accent"
          />
        </div>

        <div className="rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-black/5">
          <h2 className="mb-3 text-sm font-semibold text-navy">Portfolio</h2>
          <div className="grid grid-cols-3 gap-2">
            {(myShop.portfolio ?? []).map((photo) => (
              <div key={photo.id} className="group relative aspect-square overflow-hidden rounded-xl">
                <img src={photo.imageUrl} alt={photo.caption} className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => removePortfolioPhoto(photo.id)}
                  className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-navy/70 text-white"
                  aria-label="Remove photo"
                >
                  <X size={11} />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => portfolioInputRef.current?.click()}
              className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-navy/15 text-navy/40 active:scale-95"
            >
              <Plus size={18} />
              <span className="text-[10px] font-medium">Add photo</span>
              <input
                ref={portfolioInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handlePortfolioFile(e.target.files)}
              />
            </button>
          </div>
          <p className="mt-3 text-xs text-navy/40">
            Shown on your shop profile so buyers can see finished work before requesting a quote.
          </p>
        </div>

        <div className="rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-black/5">
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
                className="min-w-0 flex-1 rounded-xl bg-surface-alt px-3.5 py-2.5 text-sm text-navy outline-none ring-1 ring-black/5 focus:ring-accent"
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
                className="w-full rounded-xl bg-surface-alt px-3.5 py-2.5 text-sm text-navy outline-none ring-1 ring-black/5 focus:ring-accent"
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
                className="w-full rounded-xl bg-surface-alt px-3.5 py-2.5 text-sm text-navy outline-none ring-1 ring-black/5 focus:ring-accent"
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

        <div className="rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-black/5">
          <h2 className="mb-1 text-sm font-semibold text-navy">Pricing</h2>
          <p className="mb-3 text-xs text-navy/40">
            Set your rate per material so quoting a job is one tap instead of guesswork.
          </p>
          <div className="space-y-2.5">
            {myShop.materials.map((material) => (
              <div key={material} className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-navy">{material}</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-navy/40">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={myShop.pricingRates?.[material] ?? 0}
                    onChange={(e) => setPricingRate(material, e.target.value)}
                    className="w-20 rounded-lg bg-surface-alt px-2.5 py-1.5 text-right text-sm text-navy outline-none ring-1 ring-black/5 focus:ring-accent"
                  />
                  <span className="text-xs text-navy/40">/g</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-black/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-navy/5 text-navy/50">
                <Moon size={16} />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-navy">Pause my shop</h2>
                <p className="text-xs text-navy/40">Stop new requests while you're away</p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={myShop.shopPaused}
              onClick={() =>
                updateMyShop({
                  shopPaused: !myShop.shopPaused,
                  pausedUntil: myShop.shopPaused ? null : myShop.pausedUntil,
                })
              }
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                myShop.shopPaused ? "bg-accent" : "bg-navy/15"
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-surface shadow transition-transform ${
                  myShop.shopPaused ? "translate-x-[22px]" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>
          {myShop.shopPaused && (
            <div className="mt-3.5">
              <label className="mb-1.5 block text-xs font-medium text-navy/50">Until</label>
              <input
                type="date"
                value={myShop.pausedUntil ?? ""}
                onChange={(e) => updateMyShop({ pausedUntil: e.target.value })}
                className="w-full rounded-xl bg-surface-alt px-3.5 py-2.5 text-sm text-navy outline-none ring-1 ring-black/5 focus:ring-accent"
              />
            </div>
          )}
        </div>

        <div className="rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-black/5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-navy/5 text-navy/50">
              <Link2 size={16} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-1.5">
                <h2 className="text-sm font-semibold text-navy">Connect a printer</h2>
                <span className="rounded-full bg-navy/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-navy/50">
                  Concept
                </span>
              </div>
              <p className="text-xs text-navy/40">Sync live status from a manufacturer cloud</p>
            </div>
          </div>

          <div className="mt-3 flex items-start gap-2 rounded-xl bg-navy/5 p-3">
            <Info size={14} className="mt-0.5 shrink-0 text-navy/40" />
            <p className="text-xs leading-relaxed text-navy/50">
              Preview only — not a real device connection. A future manufacturer partnership could
              pull queue and status here automatically instead of the manual toggles below.
            </p>
          </div>

          {printerLinkStatus === "disconnected" && (
            <button
              type="button"
              onClick={handleConnectPrinter}
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-full bg-navy px-4 py-2.5 text-xs font-semibold text-white active:scale-95"
            >
              <Link2 size={13} />
              Connect a Bambu printer
            </button>
          )}
          {printerLinkStatus === "connecting" && (
            <div className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-full bg-navy/10 px-4 py-2.5 text-xs font-semibold text-navy/50">
              <Loader2 size={13} className="animate-spin" />
              Connecting...
            </div>
          )}
          {printerLinkStatus === "connected" && (
            <div className="mt-3 space-y-2.5">
              <div className="flex items-center justify-between rounded-xl bg-emerald-50 px-3.5 py-2.5">
                <div>
                  <p className="text-xs font-semibold text-emerald-700">Bambu X1 Carbon — linked</p>
                  <p className="text-[11px] text-emerald-600">Queue: 2 jobs · 68% capacity (simulated)</p>
                </div>
                <button
                  type="button"
                  onClick={() => setPrinterLinkStatus("disconnected")}
                  className="shrink-0 text-[11px] font-semibold text-emerald-700 underline underline-offset-2"
                >
                  Disconnect
                </button>
              </div>
            </div>
          )}
        </div>

        <div>
          <h2 className="mb-2.5 text-sm font-semibold text-navy">Printers</h2>
          <div className="space-y-2.5">
            {printers.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-black/5"
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
