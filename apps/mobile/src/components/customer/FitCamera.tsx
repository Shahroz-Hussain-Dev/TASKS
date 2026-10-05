import { useEffect, useRef } from "react";
import type { LatLng } from "@raahi/shared";
import { useMap } from "@/components/Map";
import { useMapSurface } from "@/hooks/customer/useMapSurface";

/** Minimum map height (px) that must stay visible above the bottom panel. */
const MIN_VISIBLE = 140;

/**
 * Keeps the camera on a set of points with room for the floating panels.
 * Lives inside <MapView> so it only runs once the map has loaded.
 *
 * With `follow` (default) the camera re-fits whenever the points move — right
 * for a route being planned. With `follow={false}` it only re-fits when
 * `fitKey` or the panel size changes, so a car moving every few seconds does
 * not wrestle the map away from the person panning it.
 */
export function FitCamera({ points, bottom = 0, top = 120, fitKey = "", maxZoom = 16, delayMs = 120, follow = true }: { points: LatLng[]; bottom?: number; top?: number; fitKey?: string | number; maxZoom?: number; delayMs?: number; follow?: boolean }) {
  const map = useMap();
  useMapSurface();
  const latest = useRef(points);
  latest.current = points;
  const signature = follow ? points.map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join("|") : "";

  useEffect(() => {
    if (!map) return;
    const t = window.setTimeout(() => {
      const pts = latest.current;
      if (pts.length === 0) return;
      // Make sure the camera maths sees the container's real size (panels and
      // keyboards resize the page) before computing padding.
      map.resize();
      const canvasHeight = map.getCanvas().clientHeight || map.getContainer().clientHeight || 0;
      const bottomPad = canvasHeight > 0 ? Math.min(bottom + 24, Math.max(0, canvasHeight - top - MIN_VISIBLE)) : bottom + 24;
      if (pts.length === 1) {
        const p = pts[0];
        if (p) map.flyTo({ center: [p.lng, p.lat], zoom: 15.5, duration: 900, essential: true, padding: { top, bottom: bottomPad, left: 0, right: 0 } });
        return;
      }
      let minLat = 90;
      let maxLat = -90;
      let minLng = 180;
      let maxLng = -180;
      for (const p of pts) {
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
        { padding: { top, bottom: bottomPad, left: 48, right: 48 }, duration: 900, maxZoom, essential: true },
      );
    }, delayMs);
    return () => window.clearTimeout(t);
  }, [map, signature, bottom, top, fitKey, maxZoom, delayMs]);

  return null;
}
