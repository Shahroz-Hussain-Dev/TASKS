import { useEffect } from "react";
import { useMap } from "@/components/Map";

/**
 * Guarantees the map container actually fills its parent.
 *
 * MapLibre's stylesheet declares `.maplibregl-map { position: relative }`
 * outside any cascade layer, which outranks Tailwind's layered `absolute`
 * utility; the container then collapses to 0px and MapLibre falls back to a
 * 300px canvas, leaving pins and camera framing wrong. When that happens the
 * inline style below restores the intended geometry and the map re-measures.
 * Once the container is sized correctly this is a no-op.
 */
export function useMapSurface(): void {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    const el = map.getContainer();
    const parent = el.parentElement;
    if (!parent) return;
    const fix = () => {
      if (el.clientHeight >= parent.clientHeight - 1) return;
      el.style.position = "absolute";
      el.style.inset = "0";
      el.style.width = "100%";
      el.style.height = "100%";
      map.resize();
    };
    fix();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(fix);
    ro.observe(parent);
    return () => ro.disconnect();
  }, [map]);
}
