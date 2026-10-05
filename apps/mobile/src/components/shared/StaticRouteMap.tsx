import { useEffect, useMemo } from "react";
import { decodePolyline, type LatLng, type Place } from "@raahi/shared";
import { MapView, Marker, PinMarker, RouteLine, useMap } from "@/components/Map";
import { cn } from "@/lib/utils";

/**
 * Non-interactive route thumbnail: pins at both ends, the driven route (or a
 * straight line when no polyline was stored) and a bottom gradient so it
 * blends into the surface below. MapView only mounts children once the map
 * has loaded, so markers and the fit effect can rely on `useMap()`.
 */
export function StaticRouteMap({ pickup, dropoff, polyline, className, height = 240, padding = 48 }: { pickup: Place; dropoff: Place; polyline: string | null; className?: string; height?: number; padding?: number }) {
  const points = useMemo<LatLng[]>(() => {
    if (polyline) {
      try {
        const decoded = decodePolyline(polyline);
        if (decoded.length >= 2) return decoded;
      } catch {
        /* malformed polyline: fall back to a straight line */
      }
    }
    return [
      { lat: pickup.lat, lng: pickup.lng },
      { lat: dropoff.lat, lng: dropoff.lng },
    ];
  }, [polyline, pickup.lat, pickup.lng, dropoff.lat, dropoff.lng]);

  const center = useMemo<LatLng>(() => ({ lat: (pickup.lat + dropoff.lat) / 2, lng: (pickup.lng + dropoff.lng) / 2 }), [pickup.lat, pickup.lng, dropoff.lat, dropoff.lng]);

  return (
    <div className={cn("relative w-full overflow-hidden bg-paper-100", className)} style={{ height }}>
      <MapView interactive={false} center={center} zoom={12}>
        <FitToPoints points={points} padding={padding} />
        <RouteLine points={points} id="ride-detail-route" animated={false} width={4} />
        <Marker position={pickup} anchor="bottom" zIndex={2}>
          <PinMarker kind="pickup" />
        </Marker>
        <Marker position={dropoff} anchor="bottom" zIndex={2}>
          <PinMarker kind="dropoff" />
        </Marker>
      </MapView>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-paper-50 to-transparent" />
    </div>
  );
}

/** Fits the camera to the route as soon as the map is ready. */
function FitToPoints({ points, padding }: { points: LatLng[]; padding: number }) {
  const map = useMap();
  useEffect(() => {
    if (!map || points.length === 0) return;
    let minLat = 90;
    let maxLat = -90;
    let minLng = 180;
    let maxLng = -180;
    for (const p of points) {
      minLat = Math.min(minLat, p.lat);
      maxLat = Math.max(maxLat, p.lat);
      minLng = Math.min(minLng, p.lng);
      maxLng = Math.max(maxLng, p.lng);
    }
    if (minLat === maxLat && minLng === maxLng) {
      map.jumpTo({ center: [minLng, minLat], zoom: 15 });
      return;
    }
    map.fitBounds(
      [
        [minLng, minLat],
        [maxLng, maxLat],
      ],
      { padding, duration: 0, maxZoom: 15.5 },
    );
  }, [map, points, padding]);
  return null;
}
