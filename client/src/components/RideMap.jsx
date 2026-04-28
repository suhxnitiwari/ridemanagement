import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const pickupIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-violet.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34],
});

const dropoffIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34],
});

const FitBounds = ({ pickup, dropoff }) => {
  const map = useMap();
  useEffect(() => {
    if (pickup && dropoff) {
      map.fitBounds([pickup, dropoff], { padding: [40, 40] });
    } else if (pickup) {
      map.setView(pickup, 14);
    } else if (dropoff) {
      map.setView(dropoff, 14);
    }
  }, [pickup, dropoff, map]);
  return null;
};

const RideMap = ({ pickupCoords, dropoffCoords }) => {
  const [routePoints, setRoutePoints] = useState(null);
  const center = pickupCoords || dropoffCoords || [30.2849, -97.7341];

  useEffect(() => {
    if (!pickupCoords || !dropoffCoords) { setRoutePoints(null); return; }

    const [pickLat, pickLng] = pickupCoords;
    const [dropLat, dropLng] = dropoffCoords;

    fetch(
      `https://router.project-osrm.org/route/v1/driving/${pickLng},${pickLat};${dropLng},${dropLat}?overview=full&geometries=geojson`
    )
      .then((r) => r.json())
      .then((data) => {
        if (data.code === 'Ok' && data.routes?.[0]) {
          // OSRM returns [lng, lat] — flip to [lat, lng] for Leaflet
          const coords = data.routes[0].geometry.coordinates.map(([lng, lat]) => [lat, lng]);
          setRoutePoints(coords);
        } else {
          // No road route found (e.g. across ocean) — show nothing rather than a false line
          setRoutePoints(null);
        }
      })
      .catch(() => setRoutePoints(null));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(pickupCoords), JSON.stringify(dropoffCoords)]);

  return (
    <MapContainer center={center} zoom={13} style={{ height: '260px', width: '100%', borderRadius: '12px' }}>
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>'
      />
      <FitBounds pickup={pickupCoords} dropoff={dropoffCoords} />
      {pickupCoords  && <Marker position={pickupCoords}  icon={pickupIcon}  />}
      {dropoffCoords && <Marker position={dropoffCoords} icon={dropoffIcon} />}
      {routePoints && (
        <Polyline positions={routePoints} color="#7c3aed" weight={4} />
      )}
    </MapContainer>
  );
};

export default RideMap;
