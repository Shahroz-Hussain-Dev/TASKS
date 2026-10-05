"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import type { Map as MLMap, Marker as MLMarker, GeoJSONSource, LngLatBoundsLike } from "maplibre-gl";
import { useEffect, useMemo, useRef, useState } from "react";
import type { LatLng } from "@raahi/shared";
import { cn } from "./format";

export const MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
/** Lahore — a sensible default when nothing is on the map yet. */
export const DEFAULT_CENTER: LatLng = { lat: 31.5204, lng: 74.3587 };

export type MarkerKind = "driver" | "driver-busy" | "request" | "pickup" | "dropoff" | "customer";

export interface MapMarkerSpec {
  id: string;
  lat: number;
  lng: number;
  kind: MarkerKind;
  heading?: number | null;
  label?: string;
  onClick?: () => void;
}

export interface MapLineSpec {
  id: string;
  points: LatLng[];
  color?: string;
  width?: number;
  dashed?: boolean;
}

interface AdminMapProps {
  markers?: MapMarkerSpec[];
  lines?: MapLineSpec[];
  /** Points the viewport should contain; refit happens whenever `fitKey` changes. */
  fit?: LatLng[];
  fitKey?: string;
  className?: string;
  interactive?: boolean;
}

/** Sunrise palette: free driver = teal, busy driver = sun, request = lavender, pickup/customer = sky, drop-off = coral. */
const KIND_STYLE: Record<MarkerKind, { bg: string; ring: string; glyph: string }> = {
  driver: { bg: "#12a594", ring: "rgba(18,165,148,0.28)", glyph: "car" },
  "driver-busy": { bg: "#ffc53d", ring: "rgba(255,197,61,0.35)", glyph: "car" },
  request: { bg: "#8b7cf6", ring: "rgba(139,124,246,0.3)", glyph: "hand" },
  pickup: { bg: "#3da9fc", ring: "rgba(61,169,252,0.3)", glyph: "dot" },
  dropoff: { bg: "#ff6b4a", ring: "rgba(255,107,74,0.3)", glyph: "flag" },
  customer: { bg: "#3da9fc", ring: "rgba(61,169,252,0.3)", glyph: "dot" },
};

const GLYPHS: Record<string, string> = {
  car: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#ffffff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l4 7H8z"/><path d="M12 10v11"/></svg>',
  hand: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#ffffff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4"/><path d="m4.9 4.9 2.9 2.9"/><path d="M2 12h4"/><path d="M18 12h4"/><path d="m16.2 7.8 2.9-2.9"/><circle cx="12" cy="12" r="3"/></svg>',
  dot: '<svg viewBox="0 0 24 24" width="12" height="12"><circle cx="12" cy="12" r="5" fill="#ffffff"/></svg>',
  flag: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="#ffffff" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22V4h12l-2 4 2 4H4"/></svg>',
};

function markerElement(spec: MapMarkerSpec): HTMLDivElement {
  const s = KIND_STYLE[spec.kind];
  const el = document.createElement("div");
  el.className = "raahi-marker";
  el.style.cssText = "position:relative;width:34px;height:34px;display:grid;place-items:center;cursor:pointer;";
  const ring = document.createElement("span");
  ring.style.cssText = `position:absolute;inset:0;border-radius:9999px;background:${s.ring};transform:scale(1.25);`;
  const body = document.createElement("span");
  body.className = "raahi-marker-body";
  body.style.cssText = `position:relative;width:26px;height:26px;border-radius:9999px;background:${s.bg};display:grid;place-items:center;border:3px solid #ffffff;box-shadow:0 10px 24px -8px rgba(63,42,20,.45);transition:transform .35s cubic-bezier(.16,1,.3,1);`;
  body.innerHTML = GLYPHS[s.glyph] ?? GLYPHS.dot!;
  el.append(ring, body);
  if (spec.label) {
    const label = document.createElement("span");
    label.className = "raahi-marker-label";
    label.textContent = spec.label;
    label.style.cssText = "position:absolute;top:100%;left:50%;transform:translate(-50%,3px);white-space:nowrap;font:800 11px/1 var(--font-sans);color:#1f1b2d;background:#ffffff;padding:4px 8px;border-radius:9999px;box-shadow:0 6px 16px -8px rgba(63,42,20,.4);pointer-events:none;";
    el.append(label);
  }
  if (spec.heading !== undefined && spec.heading !== null && s.glyph === "car") body.style.transform = `rotate(${spec.heading}deg)`;
  return el;
}

function updateMarkerElement(el: HTMLElement, spec: MapMarkerSpec) {
  const body = el.querySelector<HTMLElement>(".raahi-marker-body");
  if (body) {
    body.style.background = KIND_STYLE[spec.kind].bg;
    body.style.transform = spec.heading !== undefined && spec.heading !== null && KIND_STYLE[spec.kind].glyph === "car" ? `rotate(${spec.heading}deg)` : "";
  }
  const label = el.querySelector<HTMLElement>(".raahi-marker-label");
  if (label && spec.label) label.textContent = spec.label;
}

/** Repaint the OSM style into Raahi's warm "paper" palette without a custom style (same pass as apps/mobile Map.tsx). */
function applyPaperTheme(m: MLMap) {
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

const LINES_SOURCE = "raahi-lines";

interface LineFeature {
  type: "Feature";
  properties: { id: string; color: string; width: number; dashed: number };
  geometry: { type: "LineString"; coordinates: [number, number][] };
}
interface LineCollection {
  type: "FeatureCollection";
  features: LineFeature[];
}

function linesToGeoJson(lines: MapLineSpec[]): LineCollection {
  return {
    type: "FeatureCollection",
    features: lines
      .filter((l) => l.points.length >= 2)
      .map<LineFeature>((l) => ({
        type: "Feature",
        properties: { id: l.id, color: l.color ?? "#ff6b4a", width: l.width ?? 4, dashed: l.dashed ? 1 : 0 },
        geometry: { type: "LineString", coordinates: l.points.map((p): [number, number] => [p.lng, p.lat]) },
      })),
  };
}

/**
 * MapLibre map for the admin panel. The library is loaded on the client only
 * (dynamic import inside an effect) so this file is safe to render on the server.
 */
export function AdminMap({ markers = [], lines = [], fit, fitKey, className, interactive = true }: AdminMapProps) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const markerRefs = useRef(new Map<string, { marker: MLMarker; el: HTMLDivElement }>());
  const libRef = useRef<typeof import("maplibre-gl") | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let map: MLMap | null = null;
    const markerStore = markerRefs.current;
    import("maplibre-gl")
      .then((lib) => {
        if (cancelled || !container.current) return;
        libRef.current = lib;
        // MapLibre resolves its worker relative to import.meta.url, which the bundler cannot rewrite
        // for a dependency; serve the worker from /public so tiles render in production.
        lib.setWorkerUrl("/maplibre-gl-worker.js");
        map = new lib.Map({
          container: container.current,
          style: MAP_STYLE_URL,
          center: [DEFAULT_CENTER.lng, DEFAULT_CENTER.lat],
          zoom: 11.5,
          attributionControl: { compact: true },
          interactive,
          fadeDuration: 0,
        });
        map.addControl(new lib.NavigationControl({ showCompass: false }), "bottom-right");
        map.on("styledata", () => {
          if (map) applyPaperTheme(map);
        });
        map.on("load", () => {
          if (!map) return;
          applyPaperTheme(map);
          map.addSource(LINES_SOURCE, { type: "geojson", data: linesToGeoJson([]) });
          map.addLayer({
            id: `${LINES_SOURCE}-casing`,
            type: "line",
            source: LINES_SOURCE,
            layout: { "line-cap": "round", "line-join": "round" },
            paint: { "line-color": "#ffffff", "line-width": ["+", ["get", "width"], 5], "line-opacity": 0.9 },
          });
          map.addLayer({
            id: LINES_SOURCE,
            type: "line",
            source: LINES_SOURCE,
            layout: { "line-cap": "round", "line-join": "round" },
            paint: { "line-color": ["get", "color"], "line-width": ["get", "width"], "line-dasharray": ["case", ["==", ["get", "dashed"], 1], ["literal", [1, 2]], ["literal", [1, 0]]] },
          });
          mapRef.current = map;
          setReady(true);
        });
        map.on("error", () => setFailed(true));
      })
      .catch(() => setFailed(true));
    return () => {
      cancelled = true;
      markerStore.forEach(({ marker }) => marker.remove());
      markerStore.clear();
      mapRef.current = null;
      map?.remove();
      setReady(false);
    };
  }, [interactive]);

  // Markers: diff by id so existing pins glide to their new position.
  useEffect(() => {
    const map = mapRef.current;
    const lib = libRef.current;
    if (!ready || !map || !lib) return;
    const seen = new Set<string>();
    for (const spec of markers) {
      seen.add(spec.id);
      const existing = markerRefs.current.get(spec.id);
      if (existing) {
        existing.marker.setLngLat([spec.lng, spec.lat]);
        updateMarkerElement(existing.el, spec);
        existing.el.onclick = spec.onClick ?? null;
      } else {
        const el = markerElement(spec);
        el.onclick = spec.onClick ?? null;
        const marker = new lib.Marker({ element: el, anchor: "center" }).setLngLat([spec.lng, spec.lat]).addTo(map);
        markerRefs.current.set(spec.id, { marker, el });
      }
    }
    for (const [id, ref] of markerRefs.current) {
      if (!seen.has(id)) {
        ref.marker.remove();
        markerRefs.current.delete(id);
      }
    }
  }, [markers, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const source = map.getSource(LINES_SOURCE) as GeoJSONSource | undefined;
    source?.setData(linesToGeoJson(lines));
  }, [lines, ready]);

  const fitPoints = useMemo(() => fit?.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng)) ?? [], [fit]);
  useEffect(() => {
    const map = mapRef.current;
    const lib = libRef.current;
    if (!ready || !map || !lib || fitPoints.length === 0) return;
    if (fitPoints.length === 1) {
      map.easeTo({ center: [fitPoints[0]!.lng, fitPoints[0]!.lat], zoom: Math.max(map.getZoom(), 14), duration: 700 });
      return;
    }
    const bounds = fitPoints.reduce((b, p) => b.extend([p.lng, p.lat]), new lib.LngLatBounds([fitPoints[0]!.lng, fitPoints[0]!.lat], [fitPoints[0]!.lng, fitPoints[0]!.lat]));
    map.fitBounds(bounds as LngLatBoundsLike, { padding: 64, duration: 800, maxZoom: 15.5 });
    // Refit only when the caller signals a new subject (fitKey), not on every poll.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, fitKey]);

  return (
    <div className={cn("relative overflow-hidden rounded-3xl bg-[#fff6ec] shadow-pillow", className)}>
      <div ref={container} className="absolute inset-0" />
      {!ready && !failed ? <div className="shimmer absolute inset-0" aria-hidden /> : null}
      {failed ? (
        <div className="absolute inset-0 grid place-items-center p-6 text-center text-[13.5px] text-ink-500">Map tiles could not be loaded. Check the connection to tiles.openfreemap.org.</div>
      ) : null}
    </div>
  );
}
