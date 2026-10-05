/* eslint-disable react-refresh/only-export-components */
import * as maplibregl from "maplibre-gl";
import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import type { LngLatBoundsLike, Map as MLMap, GeoJSONSource, Marker as MLMarker } from "maplibre-gl";
import type { Feature, LineString } from "geojson";
import { createContext, useContext, useEffect, useImperativeHandle, useRef, useState, forwardRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { LatLng } from "@raahi/shared";
import { DEFAULT_CENTER, MAP_STYLE_URL } from "@/lib/config";
import { cn } from "@/lib/utils";

/**
 * MapLibre wrapper with OpenFreeMap vector tiles (free, no API key).
 * Children are React markers rendered through portals so they can animate
 * with framer-motion like any other component.
 */

/**
 * MapLibre 6 resolves its worker with `new URL("./maplibre-gl-worker.mjs", import.meta.url)`,
 * which Vite cannot rewrite inside a dependency; the production bundle would request a file that
 * does not exist and no tile would ever render. Point it at the worker Vite bundles for us.
 */
maplibregl.setWorkerUrl(maplibreWorkerUrl);

const MapCtx = createContext<MLMap | null>(null);
export const useMap = () => useContext(MapCtx);

export interface MapHandle {
  map: MLMap | null;
  flyTo: (p: LatLng, zoom?: number) => void;
  fitBounds: (pts: LatLng[], padding?: number | { top: number; bottom: number; left: number; right: number }) => void;
}

interface MapViewProps {
  center?: LatLng;
  zoom?: number;
  interactive?: boolean;
  className?: string;
  children?: ReactNode;
  onMoveEnd?: (center: LatLng, zoom: number) => void;
  onMoveStart?: () => void;
  onClick?: (p: LatLng) => void;
  padding?: { top?: number; bottom?: number; left?: number; right?: number };
  pitch?: number;
}

export const MapView = forwardRef<MapHandle, MapViewProps>(function MapView(
  { center = DEFAULT_CENTER, zoom = 13, interactive = true, className, children, onMoveEnd, onMoveStart, onClick, padding, pitch = 0 },
  ref,
) {
  const container = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<MLMap | null>(null);
  const callbacks = useRef({ onMoveEnd, onMoveStart, onClick });
  callbacks.current = { onMoveEnd, onMoveStart, onClick };

  useEffect(() => {
    if (!container.current) return;
    // Creating a MapLibre map is the heaviest thing a screen does. Let the page
    // transition finish first (it is ~220 ms) so the slide-in never stutters;
    // the cream placeholder is on screen meanwhile.
    let m: MLMap | null = null;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (cancelled || !container.current) return;
      m = createMap(container.current);
    }, 260);
    const createMap = (el: HTMLDivElement) => {
    const m = new maplibregl.Map({
      container: el,
      style: MAP_STYLE_URL,
      center: [center.lng, center.lat],
      zoom,
      pitch,
      attributionControl: { compact: true },
      interactive,
      fadeDuration: 150,
      maxPitch: 60,
    });
    m.touchPitch.disable();
    // Paint the night palette as soon as the style JSON arrives (before tiles) so there is never a light flash.
    m.on("styledata", () => applyDarkTheme(m));
    m.on("load", () => {
      applyDarkTheme(m);
      setMap(m);
    });
    m.on("moveend", () => {
      const c = m.getCenter();
      callbacks.current.onMoveEnd?.({ lat: c.lat, lng: c.lng }, m.getZoom());
    });
    m.on("movestart", () => callbacks.current.onMoveStart?.());
    m.on("click", (e: maplibregl.MapMouseEvent) => callbacks.current.onClick?.({ lat: e.lngLat.lat, lng: e.lngLat.lng }));
    return m;
    };
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      m?.remove();
      setMap(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (map && padding) map.setPadding({ top: padding.top ?? 0, bottom: padding.bottom ?? 0, left: padding.left ?? 0, right: padding.right ?? 0 });
  }, [map, padding?.top, padding?.bottom, padding?.left, padding?.right, padding]);

  useImperativeHandle(
    ref,
    () => ({
      map,
      flyTo: (p, z) => map?.flyTo({ center: [p.lng, p.lat], zoom: z ?? map.getZoom(), speed: 1.4, curve: 1.3, essential: true }),
      fitBounds: (pts, pad = 60) => {
        if (!map || pts.length === 0) return;
        if (pts.length === 1) {
          map.flyTo({ center: [pts[0]!.lng, pts[0]!.lat], zoom: 15 });
          return;
        }
        const b = pts.reduce((acc, p) => acc.extend([p.lng, p.lat]), new maplibregl.LngLatBounds([pts[0]!.lng, pts[0]!.lat], [pts[0]!.lng, pts[0]!.lat]));
        map.fitBounds(b as LngLatBoundsLike, { padding: pad, duration: 900, maxZoom: 16 });
      },
    }),
    [map],
  );

  return (
    <div className={cn("relative w-full h-full", className)}>
      <div ref={container} className="absolute inset-0" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", background: "#fff6ec" }} />
      <MapCtx.Provider value={map}>{map && children}</MapCtx.Provider>
    </div>
  );
});

/** Repaint the OSM style into Raahi's warm "paper" palette without a custom style. */
function applyDarkTheme(m: MLMap) {
  const style = m.getStyle();
  for (const layer of style.layers ?? []) {
    try {
      const id = layer.id.toLowerCase();
      if (layer.type === "background") m.setPaintProperty(layer.id, "background-color", "#fff6ec");
      else if (layer.type === "fill") {
        if (id.includes("water")) m.setPaintProperty(layer.id, "fill-color", "#cfe8ff");
        else if (id.includes("park") || id.includes("grass") || id.includes("wood") || id.includes("forest") || id.includes("green")) m.setPaintProperty(layer.id, "fill-color", "#dff3e3");
        else if (id.includes("building")) {
          m.setPaintProperty(layer.id, "fill-color", "#f3e4d2");
          m.setPaintProperty(layer.id, "fill-opacity", 0.9);
        } else if (id.includes("residential") || id.includes("landuse")) m.setPaintProperty(layer.id, "fill-color", "#fbeedd");
        else m.setPaintProperty(layer.id, "fill-color", "#fdf1e3");
      } else if (layer.type === "line") {
        if (id.includes("water")) m.setPaintProperty(layer.id, "line-color", "#b9dcff");
        else if (id.includes("motorway") || id.includes("trunk") || id.includes("highway")) m.setPaintProperty(layer.id, "line-color", id.includes("casing") ? "#f0cfae" : "#ffd9a8");
        else if (id.includes("primary") || id.includes("secondary")) m.setPaintProperty(layer.id, "line-color", id.includes("casing") ? "#ecd2b8" : "#ffffff");
        else if (id.includes("rail")) m.setPaintProperty(layer.id, "line-color", "#e2d3c1");
        else if (id.includes("boundary")) m.setPaintProperty(layer.id, "line-color", "#e8cfc0");
        else m.setPaintProperty(layer.id, "line-color", id.includes("casing") ? "#ecdcc8" : "#ffffff");
      } else if (layer.type === "symbol") {
        m.setPaintProperty(layer.id, "text-color", "#6b6478");
        m.setPaintProperty(layer.id, "text-halo-color", "#fff6ec");
        m.setPaintProperty(layer.id, "text-halo-width", 1.4);
        if (id.includes("poi")) m.setLayoutProperty(layer.id, "visibility", "none");
      } else if (layer.type === "fill-extrusion") {
        m.setPaintProperty(layer.id, "fill-extrusion-color", "#f3e4d2");
      }
    } catch {
      /* layer may not support the property */
    }
  }
}

/* ------------------------------------------------------------------ */
/* Markers (React portal into a maplibre Marker)                       */
/* ------------------------------------------------------------------ */

export function Marker({ position, children, anchor = "center", zIndex, rotation }: { position: LatLng; children: ReactNode; anchor?: "center" | "bottom"; zIndex?: number; rotation?: number }) {
  const map = useMap();
  const [el] = useState(() => document.createElement("div"));
  const marker = useRef<MLMarker | null>(null);
  useEffect(() => {
    if (!map) return;
    el.style.zIndex = String(zIndex ?? 1);
    const mk = new maplibregl.Marker({ element: el, anchor, rotationAlignment: "map", pitchAlignment: "map" }).setLngLat([position.lng, position.lat]).addTo(map);
    marker.current = mk;
    return () => {
      mk.remove();
      marker.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);
  useEffect(() => {
    marker.current?.setLngLat([position.lng, position.lat]);
  }, [position.lat, position.lng]);
  useEffect(() => {
    if (rotation != null) marker.current?.setRotation(rotation);
  }, [rotation]);
  useEffect(() => {
    el.style.zIndex = String(zIndex ?? 1);
  }, [zIndex, el]);
  return createPortal(children, el);
}

/* ------------------------------------------------------------------ */
/* Route line                                                          */
/* ------------------------------------------------------------------ */

export function RouteLine({ points, id = "route", color = "#ff6b4a", width = 5, animated = true }: { points: LatLng[]; id?: string; color?: string; width?: number; animated?: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (!map || points.length < 2) return;
    const data: Feature<LineString> = { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: points.map((p) => [p.lng, p.lat]) } };
    const srcId = `${id}-src`;
    if (map.getSource(srcId)) (map.getSource(srcId) as GeoJSONSource).setData(data);
    else {
      map.addSource(srcId, { type: "geojson", data, lineMetrics: true });
      map.addLayer({ id: `${id}-casing`, type: "line", source: srcId, layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#ffffff", "line-width": width + 6, "line-opacity": 0.9 } });
      map.addLayer({
        id,
        type: "line",
        source: srcId,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": color, "line-width": width, "line-gradient": ["interpolate", ["linear"], ["line-progress"], 0, "#12a594", 1, color] },
      });
      if (animated) {
        map.addLayer({ id: `${id}-dash`, type: "line", source: srcId, layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#ffffff", "line-width": Math.max(1.5, width - 3), "line-opacity": 0.55, "line-dasharray": [0, 2, 3] } });
      }
    }
    let raf = 0;
    let step = 0;
    const seq: number[][] = [
      [0, 4, 3],
      [0.5, 4, 2.5],
      [1, 4, 2],
      [1.5, 4, 1.5],
      [2, 4, 1],
      [2.5, 4, 0.5],
      [3, 4, 0],
      [0, 0.5, 3, 3.5],
      [0, 1, 3, 3],
      [0, 1.5, 3, 2.5],
      [0, 2, 3, 2],
      [0, 2.5, 3, 1.5],
      [0, 3, 3, 1],
      [0, 3.5, 3, 0.5],
    ];
    let last = 0;
    const tick = (t: number) => {
      if (t - last > 70 && map.getLayer(`${id}-dash`)) {
        map.setPaintProperty(`${id}-dash`, "line-dasharray", seq[step % seq.length]);
        step++;
        last = t;
      }
      raf = requestAnimationFrame(tick);
    };
    if (animated) raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      for (const l of [`${id}-dash`, id, `${id}-casing`]) if (map.getLayer(l)) map.removeLayer(l);
      if (map.getSource(srcId)) map.removeSource(srcId);
    };
  }, [map, points, id, color, width, animated]);
  return null;
}

/* ------------------------------------------------------------------ */
/* Pins                                                                */
/* ------------------------------------------------------------------ */

export function PinMarker({ kind, label }: { kind: "pickup" | "dropoff"; label?: string }) {
  const color = kind === "pickup" ? "#12a594" : "#ff6b4a";
  return (
    <div className="flex flex-col items-center -translate-y-1 pointer-events-none">
      {label && <div className="rounded-xl px-2.5 py-1 text-[12px] font-extrabold text-ink-900 bg-white shadow-pillow whitespace-nowrap mb-1 max-w-44 truncate">{label}</div>}
      <div className="relative">
        <div className="size-5 rounded-full border-[3px] border-white shadow-float" style={{ background: color }} />
        <div className="absolute left-1/2 -translate-x-1/2 top-4 w-0.5 h-5 rounded-full" style={{ background: color }} />
        <div className="absolute left-1/2 -translate-x-1/2 top-[34px] size-2 rounded-full bg-ink-900/25 blur-[2px]" />
      </div>
    </div>
  );
}

export function CarMarker({ heading = 0, category = "car", pulse }: { heading?: number | null; category?: string; pulse?: boolean }) {
  return (
    <div className="relative size-12 flex items-center justify-center pointer-events-none">
      {pulse && <span className="absolute inset-0 rounded-full bg-teal-500/30 radar-ring" />}
      <div className="absolute size-9 rounded-full bg-teal-500/20 blur-md" />
      <div className="relative size-9 rounded-full bg-white shadow-float flex items-center justify-center" style={{ transform: `rotate(${heading ?? 0}deg)`, transition: "transform 600ms ease" }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          {category === "bike" ? (
            <path d="M12 3l3 7h-6l3-7zM8 12a4 4 0 100 8 4 4 0 000-8zm8 0a4 4 0 100 8 4 4 0 000-8z" fill="#12a594" />
          ) : (
            <path d="M12 2.5c-.9 0-1.7.4-2.3 1L6.8 7.4A2.5 2.5 0 006 9.2V19a2 2 0 002 2h8a2 2 0 002-2V9.2c0-.7-.3-1.3-.8-1.8L14.3 3.5A3.2 3.2 0 0012 2.5zm-4 8.5h8v3H8v-3z" fill="#12a594" />
          )}
        </svg>
      </div>
    </div>
  );
}

export function UserDot() {
  return (
    <div className="relative size-10 flex items-center justify-center pointer-events-none">
      <span className="absolute inset-0 rounded-full bg-sky-400/30 radar-ring" />
      <div className="size-4 rounded-full bg-sky-500 border-[3px] border-white shadow-float" />
    </div>
  );
}
