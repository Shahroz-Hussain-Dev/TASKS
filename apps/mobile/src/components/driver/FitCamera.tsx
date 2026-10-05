import { useEffect } from "react";
import type { LatLng } from "@raahi/shared";
import { useMap } from "@/components/Map";

/**
 * Frames the camera around `points` once the map is ready and again whenever
 * `revision` changes (e.g. a ride status transition). Render it inside
 * <MapView>, which only mounts children after the style has loaded.
 */
export function FitCamera({ points, padding, revision, maxZoom = 15.5 }: { points: LatLng[]; padding: { top: number; bottom: number; left: number; right: number }; revision: string | number; maxZoom?: number }) {
  const map = useMap();
  useEffect(() => {
    if (!map || points.length === 0) return;
    if (points.length === 1) {
      const p = points[0]!;
      map.easeTo({ center: [p.lng, p.lat], zoom: 15, padding, duration: 700 });
      return;
    }
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
    map.fitBounds(
      [
        [minLng, minLat],
        [maxLng, maxLat],
      ],
      { padding, duration: 900, maxZoom },
    );
    // Re-frame on revision changes only, never on every GPS tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, revision]);
  return null;
}
