import { Fragment, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Circle, Popup } from "react-leaflet";
import L from "leaflet";
import ShopLogo from "./ShopLogo";

const MILES_TO_METERS = 1609.34;
const FALLBACK_CENTER = [39.7817, -89.6501]; // Downtown, Springfield

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
  const fill = printer.logoUrl
    ? `background-image:url('${printer.logoUrl}');background-size:cover;background-position:center;`
    : `background:#0f2a4a;`;
  return L.divIcon({
    className: "",
    html: `<div style="width:40px;height:40px;border-radius:50%;border:3px solid ${color};${fill}box-shadow:0 2px 8px rgba(15,42,74,0.35);"></div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });
}

/**
 * Buyer-facing map of nearby print shops — each pin uses the shop's own
 * logo, ringed in a status color, with its service-radius circle drawn
 * underneath. Tapping a pin opens a popup with a "Get a quote" shortcut.
 */
export default function PrinterMapView({ printers }) {
  const navigate = useNavigate();

  const bounds = useMemo(() => {
    if (printers.length === 0) return null;
    return L.latLngBounds(printers.map((p) => p.location));
  }, [printers]);

  const viewProps = bounds
    ? { bounds, boundsOptions: { padding: [32, 32] } }
    : { center: FALLBACK_CENTER, zoom: 11 };

  return (
    <div className="overflow-hidden rounded-2xl ring-1 ring-black/5">
      <MapContainer
        {...viewProps}
        scrollWheelZoom={false}
        style={{ height: 320, width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {printers.map((printer) => (
          <Fragment key={printer.id}>
            <Circle
              center={printer.location}
              radius={printer.serviceRadiusMi * MILES_TO_METERS}
              pathOptions={{
                color: pinColor(printer),
                weight: 1.5,
                fillColor: pinColor(printer),
                fillOpacity: 0.08,
              }}
            />
            <Marker position={printer.location} icon={printerIcon(printer)}>
              <Popup closeButton={false}>
                <div className="min-w-[170px]">
                  <div className="flex items-center gap-2">
                    <ShopLogo src={printer.logoUrl} alt="" size="sm" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold leading-tight text-navy">
                        {printer.name}
                      </p>
                      <p className="text-xs text-navy/50">
                        {printer.distanceMi} mi · {printer.serviceRadiusMi} mi radius
                      </p>
                    </div>
                  </div>
                  <p className="mt-1.5 text-xs font-medium text-accent">
                    {printer.turnaroundLabel}
                  </p>
                  <button
                    type="button"
                    onClick={() => navigate(`/shop/${printer.id}`)}
                    className="mt-2 w-full rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-white active:scale-95"
                  >
                    View shop
                  </button>
                </div>
              </Popup>
            </Marker>
          </Fragment>
        ))}
      </MapContainer>
    </div>
  );
}
