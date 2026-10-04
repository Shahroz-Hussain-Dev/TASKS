import { decodePolyline, estimateDurationMin, estimateRoadKm, type LatLng } from "@raahi/shared";
import { env } from "./env";

/**
 * Free, key-less geo services:
 *  - Routing: OSRM (configurable, defaults to the public demo server) with a
 *    haversine-based fallback so quoting never fails.
 *  - Search: Photon (komoot) — fast OSM autocomplete, worldwide incl. Pakistan.
 *  - Reverse geocode: Nominatim with a proper User-Agent (required by policy).
 * All calls are proxied through the API so the mobile app never talks to third
 * parties directly, and results are cached in memory per instance.
 */

const UA = "Raahi/1.0 (ride-hailing; contact: support@raahi.pk)";

const cache = new Map<string, { at: number; value: unknown }>();
function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return Promise.resolve(hit.value as T);
  return fn().then((v) => {
    cache.set(key, { at: Date.now(), value: v });
    if (cache.size > 5000) cache.clear();
    return v;
  });
}

export interface RouteResult {
  distanceKm: number;
  durationMin: number;
  polyline: string | null;
  geometry: LatLng[];
  source: "osrm" | "estimate";
}

export async function route(a: LatLng, b: LatLng): Promise<RouteResult> {
  const key = `r:${a.lat.toFixed(4)},${a.lng.toFixed(4)}>${b.lat.toFixed(4)},${b.lng.toFixed(4)}`;
  return cached(key, 10 * 60_000, async () => {
    try {
      const url = `${env().OSRM_URL}/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=full&geometries=polyline&alternatives=false&steps=false`;
      const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(6000) });
      if (!res.ok) throw new Error(`osrm ${res.status}`);
      const data = (await res.json()) as { code: string; routes?: { distance: number; duration: number; geometry: string }[] };
      const r = data.routes?.[0];
      if (data.code !== "Ok" || !r) throw new Error("osrm no route");
      const distanceKm = Math.max(0.1, r.distance / 1000);
      // OSRM free-flow durations are optimistic for Pakistani traffic — add 35%.
      const durationMin = Math.max(2, (r.duration / 60) * 1.35);
      return { distanceKm, durationMin, polyline: r.geometry, geometry: decodePolyline(r.geometry), source: "osrm" as const };
    } catch (err) {
      console.warn("[geo] osrm failed, using estimate:", err instanceof Error ? err.message : err);
      const distanceKm = estimateRoadKm(a, b);
      return { distanceKm, durationMin: estimateDurationMin(distanceKm), polyline: null, geometry: [a, b], source: "estimate" as const };
    }
  });
}

export interface PlaceSuggestion {
  name: string;
  address: string;
  lat: number;
  lng: number;
  type: string;
}

export async function searchPlaces(q: string, near: LatLng | null, limit = 6): Promise<PlaceSuggestion[]> {
  const key = `s:${q.toLowerCase()}:${near ? `${near.lat.toFixed(2)},${near.lng.toFixed(2)}` : ""}:${limit}`;
  return cached(key, 5 * 60_000, async () => {
    const params = new URLSearchParams({ q, limit: String(limit), lang: "en" });
    if (near) {
      params.set("lat", String(near.lat));
      params.set("lon", String(near.lng));
      params.set("location_bias_scale", "0.4");
      params.set("zoom", "12");
    }
    // Bias towards Pakistan — Photon has no country filter, so we post-filter.
    const res = await fetch(`${env().PHOTON_URL}/api/?${params}`, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(6000) });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      features: { geometry: { coordinates: [number, number] }; properties: Record<string, string | undefined> }[];
    };
    const out: PlaceSuggestion[] = [];
    for (const f of data.features ?? []) {
      const p = f.properties;
      if (p.countrycode && p.countrycode.toUpperCase() !== "PK") continue;
      const [lng, lat] = f.geometry.coordinates;
      const name = p.name ?? p.street ?? p.city ?? "Unnamed place";
      const parts = [p.street && p.housenumber ? `${p.housenumber} ${p.street}` : p.street, p.district ?? p.locality, p.city ?? p.county, p.state]
        .filter((x): x is string => Boolean(x) && x !== name);
      out.push({ name, address: Array.from(new Set(parts)).join(", ") || (p.country ?? ""), lat, lng, type: p.osm_value ?? p.type ?? "place" });
    }
    return out;
  });
}

export async function reverseGeocode(p: LatLng): Promise<{ name: string; address: string }> {
  const key = `rg:${p.lat.toFixed(4)},${p.lng.toFixed(4)}`;
  return cached(key, 60 * 60_000, async () => {
    try {
      const url = `${env().NOMINATIM_URL}/reverse?lat=${p.lat}&lon=${p.lng}&format=jsonv2&zoom=18&addressdetails=1&accept-language=en`;
      const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(6000) });
      if (!res.ok) throw new Error(`nominatim ${res.status}`);
      const d = (await res.json()) as { name?: string; display_name?: string; address?: Record<string, string> };
      const a = d.address ?? {};
      const name = d.name || a.road || a.neighbourhood || a.suburb || "Pinned location";
      const parts = [a.house_number && a.road ? `${a.house_number} ${a.road}` : a.road, a.neighbourhood ?? a.suburb, a.city ?? a.town ?? a.village ?? a.county]
        .filter((x): x is string => Boolean(x) && x !== name);
      return { name, address: Array.from(new Set(parts)).join(", ") || d.display_name?.split(",").slice(0, 3).join(",") || "Pinned location" };
    } catch {
      return { name: "Pinned location", address: `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}` };
    }
  });
}
