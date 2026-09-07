import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Circle, useMap } from "react-leaflet";
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

function FitServiceCoverage({ center, radiusMi }) {
  const map = useMap();
  const [latitude, longitude] = center;
  useEffect(() => {
    // Include the entire service diameter, not just the farm's pin.
    const bounds = L.latLng([latitude, longitude]).toBounds(radiusMi * MILES_TO_METERS * 2);
    map.fitBounds(bounds, { padding: [24, 24], maxZoom: 13, animate: false });
  }, [map, latitude, longitude, radiusMi]);
  return null;
}

/**
 * Draggable-pin map with a live radius circle. `center` is [lat, lng];
 * `radiusMi` is in miles. Dragging the pin calls `onCenterChange` with the
 * new [lat, lng] — the radius itself is controlled by a slider elsewhere.
 */
export default function ServiceAreaMap({ center, radiusMi, onCenterChange }) {
  const markerRef = useRef(null);
  const [tileError, setTileError] = useState(false);
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
    <section aria-label="Sample farm local pickup and drop-off service area">
      <p className="mb-3 text-sm leading-6 text-navy/65">The shaded circle shows the {radiusMi}-mile sample pickup and drop-off area. Actual availability, meeting location, and fees require farm confirmation.</p>
      {tileError && <p role="status" className="notice mb-3">The map background did not fully load. You can still use the sample city and radius controls to edit coverage.</p>}
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
          eventHandlers={{ tileerror: () => setTileError(true) }}
        />
        <FitServiceCoverage center={center} radiusMi={radiusMi} />
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
          title="Sample farm location. Drag to change the local service area."
          alt="Sample farm location pin"
          keyboard
          draggable
          eventHandlers={eventHandlers}
          ref={markerRef}
        />
      </MapContainer>
      </div>
    </section>
  );
}


