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

const KIND_STYLE: Record<MarkerKind, { bg: string; ring: string; glyph: string }> = {
  driver: { bg: "#10b981", ring: "rgba(16,185,129,0.35)", glyph: "car" },
  "driver-busy": { bg: "#f59e0b", ring: "rgba(245,158,11,0.35)", glyph: "car" },
  request: { bg: "#a78bfa", ring: "rgba(167,139,250,0.35)", glyph: "hand" },
  pickup: { bg: "#38bdf8", ring: "rgba(56,189,248,0.35)", glyph: "dot" },
  dropoff: { bg: "#fb7185", ring: "rgba(251,113,133,0.35)", glyph: "flag" },
  customer: { bg: "#38bdf8", ring: "rgba(56,189,248,0.35)", glyph: "dot" },
};

const GLYPHS: Record<string, string> = {
  car: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#06080f" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l4 7H8z"/><path d="M12 10v11"/></svg>',
  hand: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#06080f" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4"/><path d="m4.9 4.9 2.9 2.9"/><path d="M2 12h4"/><path d="M18 12h4"/><path d="m16.2 7.8 2.9-2.9"/><circle cx="12" cy="12" r="3"/></svg>',
  dot: '<svg viewBox="0 0 24 24" width="12" height="12"><circle cx="12" cy="12" r="5" fill="#06080f"/></svg>',
  flag: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="#06080f" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22V4h12l-2 4 2 4H4"/></svg>',
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
  body.style.cssText = `position:relative;width:24px;height:24px;border-radius:9999px;background:${s.bg};display:grid;place-items:center;border:2px solid #06080f;box-shadow:0 8px 20px -6px rgba(0,0,0,.8);transition:transform .35s cubic-bezier(.16,1,.3,1);`;
  body.innerHTML = GLYPHS[s.glyph] ?? GLYPHS.dot!;
  el.append(ring, body);
  if (spec.label) {
    const label = document.createElement("span");
    label.className = "raahi-marker-label";
    label.textContent = spec.label;
    label.style.cssText = "position:absolute;top:100%;left:50%;transform:translate(-50%,2px);white-space:nowrap;font:600 11px/1 var(--font-sans);color:#e2e8f0;background:rgba(11,15,26,.85);padding:3px 7px;border-radius:9999px;border:1px solid rgba(255,255,255,.08);pointer-events:none;";
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

/** Dim the light OSM style into Raahi's night palette without a custom style. */
function applyDarkTheme(m: MLMap) {
  const style = m.getStyle();
  for (const layer of style.layers ?? []) {
    try {
      if (layer.type === "background") m.setPaintProperty(layer.id, "background-color", "#0b0f1a");
      else if (layer.type === "fill") {
        const id = layer.id.toLowerCase();
        if (id.includes("water")) m.setPaintProperty(layer.id, "fill-color", "#0e1a2b");
        else if (id.includes("park") || id.includes("grass") || id.includes("wood") || id.includes("forest")) m.setPaintProperty(layer.id, "fill-color", "#0f1f1c");
        else if (id.includes("building")) {
          m.setPaintProperty(layer.id, "fill-color", "#161e2e");
          m.setPaintProperty(layer.id, "fill-opacity", 0.9);
        } else m.setPaintProperty(layer.id, "fill-color", "#111827");
      } else if (layer.type === "line") {
        const id = layer.id.toLowerCase();
        if (id.includes("water")) m.setPaintProperty(layer.id, "line-color", "#13233a");
        else if (id.includes("motorway") || id.includes("trunk") || id.includes("highway")) m.setPaintProperty(layer.id, "line-color", id.includes("casing") ? "#1f2a3f" : "#3b4b66");
        else if (id.includes("primary") || id.includes("secondary")) m.setPaintProperty(layer.id, "line-color", id.includes("casing") ? "#1a2235" : "#33415a");
        else if (id.includes("rail")) m.setPaintProperty(layer.id, "line-color", "#1f2a3f");
        else if (id.includes("boundary")) m.setPaintProperty(layer.id, "line-color", "#2b3650");
        else m.setPaintProperty(layer.id, "line-color", id.includes("casing") ? "#141b2b" : "#263247");
      } else if (layer.type === "symbol") {
        m.setPaintProperty(layer.id, "text-color", "#9aa6bd");
        m.setPaintProperty(layer.id, "text-halo-color", "#0b0f1a");
        m.setPaintProperty(layer.id, "text-halo-width", 1.2);
        if (layer.id.toLowerCase().includes("poi")) m.setLayoutProperty(layer.id, "visibility", "none");
      } else if (layer.type === "fill-extrusion") {
        m.setPaintProperty(layer.id, "fill-extrusion-color", "#1a2235");
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
        properties: { id: l.id, color: l.color ?? "#34d399", width: l.width ?? 4, dashed: l.dashed ? 1 : 0 },
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
        map.on("load", () => {
          if (!map) return;
          applyDarkTheme(map);
          map.addSource(LINES_SOURCE, { type: "geojson", data: linesToGeoJson([]) });
          map.addLayer({
            id: `${LINES_SOURCE}-casing`,
            type: "line",
            source: LINES_SOURCE,
            layout: { "line-cap": "round", "line-join": "round" },
            paint: { "line-color": "#06080f", "line-width": ["+", ["get", "width"], 4], "line-opacity": 0.8 },
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
    <div className={cn("relative overflow-hidden rounded-3xl border border-white/6 bg-ink-900", className)}>
      <div ref={container} className="absolute inset-0" />
      {!ready && !failed ? <div className="shimmer absolute inset-0" aria-hidden /> : null}
      {failed ? (
        <div className="absolute inset-0 grid place-items-center p-6 text-center text-[13.5px] text-ink-400">Map tiles could not be loaded. Check the connection to tiles.openfreemap.org.</div>
      ) : null}
    </div>
  );
}
