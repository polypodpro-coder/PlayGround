import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Circle, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import ShopLogo from "./ShopLogo";
import { getFulfillmentOptions } from '../lib/fulfillment';

const MILES_TO_METERS = 1609.34;
const FALLBACK_CENTER = [39.7817, -89.6501]; // Downtown, Springfield

function FitCoverage({ bounds }) {
  const map = useMap();
  useEffect(() => {
    if (bounds) map.fitBounds(bounds, { padding: [28, 28], maxZoom: 13, animate: false });
  }, [map, bounds]);
  return null;
}

const STATUS_COLORS = {
  available: "#10b981",
  printing: "#e8752d",
  offline: "#94a3b8",
  paused: "#d4a017",
};

function pinColor(printer) {
  if (printer.shopPaused) return STATUS_COLORS.paused;
  return STATUS_COLORS[printer.status] ?? STATUS_COLORS.offline;
}

function printerIcon(printer) {
  const color = pinColor(printer);
  // Assign URLs through DOM properties, never interpolate profile data into HTML.
  const pin = document.createElement('div');
  Object.assign(pin.style, {width:'40px',height:'40px',borderRadius:'50%',border:`3px solid ${color}`,backgroundColor:'#122d40',boxShadow:'0 2px 8px #122d4050',overflow:'hidden'});
  if (printer.logoUrl) {
    const logo = document.createElement('img');
    logo.src = printer.logoUrl; logo.alt = ''; logo.referrerPolicy = 'no-referrer';
    Object.assign(logo.style,{width:'100%',height:'100%',objectFit:'cover'});
    pin.append(logo);
  }
  return L.divIcon({
    className: "",
    html: pin,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });
}

/**
 * Buyer-facing map of nearby print shops — each pin uses the shop's own
 * logo, ringed in a status color, with its service-radius circle drawn
 * underneath. Tapping a pin opens a popup with a farm-profile shortcut.
 */
export default function PrinterMapView({ printers, selectedFarmId = '', onSelectFarm }) {
  const navigate = useNavigate();
  const [tileError, setTileError] = useState(false);
  const regionRef = useRef(null);
  useEffect(() => { regionRef.current?.scrollIntoView({ block: 'start' }); }, []);
  const selectedFarm = printers.find((farm) => farm.id === selectedFarmId);
  const selectedMethods = useMemo(() => getFulfillmentOptions(selectedFarm), [selectedFarm]);
  const visibleFarms = useMemo(() => selectedFarm ? [selectedFarm] : printers, [selectedFarm, printers]);

  const bounds = useMemo(() => {
    if (visibleFarms.length === 0) return null;
    const coverage = L.latLngBounds([]);
    for (const farm of visibleFarms) {
      // Fit the full service circle, rather than only the farms' pin locations.
      coverage.extend(L.latLng(farm.location).toBounds(farm.serviceRadiusMi * MILES_TO_METERS * 2));
    }
    return coverage;
  }, [visibleFarms]);

  const viewProps = bounds
    ? { bounds, boundsOptions: { padding: [32, 32], maxZoom: 13 } }
    : { center: FALLBACK_CENTER, zoom: 11 };

  return (
    <section ref={regionRef} aria-label="Map of sample print farms" style={{ scrollMarginTop: 20 }}>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div><h3 className="text-xl font-semibold">Local pickup &amp; drop-off coverage</h3><p className="mt-2 text-sm muted">Shaded circles show each sample farm’s local service radius. Choose a farm to see its full area.</p></div>
        <label className="field w-full sm:w-auto">Show coverage for<select value={selectedFarm?.id ?? ''} onChange={(event) => onSelectFarm?.(event.target.value)}><option value="">All farm coverage</option>{printers.map((farm) => <option key={farm.id} value={farm.id}>{farm.name} · {farm.serviceRadiusMi} mi</option>)}</select></label>
      </div>
      <div className="mb-3 flex flex-wrap gap-4 text-xs" aria-label="Sample farm status legend">{Object.entries(STATUS_COLORS).map(([status,color])=><span key={status} className="inline-flex items-center gap-2"><span aria-hidden="true" style={{width:9,height:9,borderRadius:'50%',background:color}}/>{status === 'printing' ? 'Busy' : status[0].toUpperCase()+status.slice(1)}</span>)}</div>
      {tileError && <p role="status" className="notice mb-3">The map background could not load. Switch to the farm list to keep browsing.</p>}
    <div className="isolate overflow-hidden rounded-2xl ring-1 ring-black/5">
      <MapContainer
        {...viewProps}
        scrollWheelZoom={false}
        style={{ height: 320, width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          eventHandlers={{tileerror:()=>setTileError(true)}}
        />
        <FitCoverage bounds={bounds} />
        {visibleFarms.map((printer) => (
          <Fragment key={printer.id}>
            <Circle
              center={printer.location}
              radius={printer.serviceRadiusMi * MILES_TO_METERS}
              pathOptions={{
                color: pinColor(printer),
                weight: selectedFarm ? 2.5 : 1.5,
                fillColor: pinColor(printer),
                fillOpacity: selectedFarm ? 0.16 : 0.08,
              }}
              interactive={false}
            />
            <Marker position={printer.location} icon={printerIcon(printer)} title={`${printer.name} · sample farm`} alt={`${printer.name} · sample farm`}>
              <Popup minWidth={170} maxWidth={200}>
                <div className="min-w-[170px]">
                  <div className="flex items-center gap-2">
                    <ShopLogo src={printer.logoUrl} alt="" size="sm" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold leading-tight text-navy">
                        {printer.name}
                      </p>
                      <p className="text-xs text-navy/50">
                        {printer.serviceRadiusMi}-mile local service radius
                      </p>
                    </div>
                  </div>
                  <p className="mt-1.5 text-xs font-medium text-accent">
                    {printer.turnaroundLabel}
                  </p>
                  <p className="mt-2 text-xs text-navy/65">View the farm’s offered fulfillment methods and example charges before preparing a request.</p>
                  <button
                    type="button"
                    onClick={() => navigate(`/shop/${printer.id}`)}
                    className="mt-2 min-h-11 w-full rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-white active:scale-95"
                  >
                    View farm
                  </button>
                </div>
              </Popup>
            </Marker>
          </Fragment>
        ))}
      </MapContainer>
    </div>
      <div className="notice mt-4" role="status">
        <p><strong>{selectedFarm ? `${selectedFarm.name} · ${selectedFarm.serviceRadiusMi}-mile example radius` : 'Example coverage for the sample farm network'}</strong></p>
        {selectedFarm && (selectedMethods.length ? <ul className="my-3 flex flex-wrap gap-2" aria-label="Offered sample fulfillment methods">{selectedMethods.map(method => <li key={method.id} className="badge">{method.label} · ${(method.feeCents / 100).toFixed(2)} / order · example</li>)}</ul> : <p className="mt-2 font-semibold">No fulfillment methods offered in this sample.</p>)}
        <p className="mt-1">Coverage is a straight-line radius, not a driving route. A circle does not add pickup or drop-off to a farm’s offered methods. Local arrangements and eligibility still need farm confirmation; these sample locations do not establish your address.</p>
        {selectedFarm && <button type="button" className="button-secondary mt-3" onClick={() => navigate(`/shop/${selectedFarm.id}`)}>View {selectedFarm.name}</button>}
      </div>
    </section>
  );
}
