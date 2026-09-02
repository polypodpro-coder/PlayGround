import { useMemo, useRef } from "react";
import { MapContainer, TileLayer, Marker, Circle } from "react-leaflet";
import L from "leaflet";

const pinIcon = L.divIcon({
  className: "",
  html: `<div style="
    width:26px;height:26px;border-radius:50% 50% 50% 0;
    background:#0f2a4a;border:2px solid white;
    transform:rotate(-45deg);
    box-shadow:0 2px 6px rgba(15,42,74,0.4);
  "></div>`,
  iconSize: [26, 26],
  iconAnchor: [13, 26],
});

const MILES_TO_METERS = 1609.34;

/**
 * Draggable-pin map with a live radius circle. `center` is [lat, lng];
 * `radiusMi` is in miles. Dragging the pin calls `onCenterChange` with the
 * new [lat, lng] — the radius itself is controlled by a slider elsewhere.
 */
export default function ServiceAreaMap({ center, radiusMi, onCenterChange }) {
  const markerRef = useRef(null);
  const radiusMeters = useMemo(() => radiusMi * MILES_TO_METERS, [radiusMi]);

  const eventHandlers = useMemo(
    () => ({
      dragend() {
        const marker = markerRef.current;
        if (!marker) return;
        const { lat, lng } = marker.getLatLng();
        onCenterChange([lat, lng]);
      },
    }),
    [onCenterChange]
  );

  return (
    <div className="isolate overflow-hidden rounded-2xl ring-1 ring-black/5">
      <MapContainer
        center={center}
        zoom={10}
        scrollWheelZoom={false}
        style={{ height: 220, width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Circle
          center={center}
          radius={radiusMeters}
          pathOptions={{
            color: "#e8752d",
            weight: 2,
            fillColor: "#e8752d",
            fillOpacity: 0.15,
          }}
        />
        <Marker
          position={center}
          icon={pinIcon}
          draggable
          eventHandlers={eventHandlers}
          ref={markerRef}
        />
      </MapContainer>
    </div>
  );
}
