import { animate } from "framer-motion";
import * as maplibregl from "maplibre-gl";
import type { Marker as MLMarker } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { bearingDeg, haversineKm, type LatLng } from "@raahi/shared";
import { CarMarker, useMap } from "@/components/Map";

/** Jumps larger than this are teleports (GPS glitch / first fix), not drives. */
const TELEPORT_KM = 2;
/** Ignore sub-metre jitter so a parked car does not twitch. */
const STILL_KM = 0.0005;

/**
 * Car marker whose position glides between location pings instead of jumping.
 * It drives the MapLibre marker directly from a framer-motion tween, so the
 * React tree is untouched while the car moves. Heading comes from the ping
 * when available, otherwise from the direction of travel.
 */
export function AnimatedCarMarker({ position, heading, category, pulse, durationMs = 2600, zIndex = 5 }: { position: LatLng; heading?: number | null; category?: string; pulse?: boolean; durationMs?: number; zIndex?: number }) {
  const map = useMap();
  const [el] = useState(() => document.createElement("div"));
  const marker = useRef<MLMarker | null>(null);
  const current = useRef<LatLng>(position);
  const [bearing, setBearing] = useState<number>(heading ?? 0);

  useEffect(() => {
    if (!map) return;
    el.style.zIndex = String(zIndex);
    const mk = new maplibregl.Marker({ element: el, anchor: "center", rotationAlignment: "map", pitchAlignment: "map" }).setLngLat([current.current.lng, current.current.lat]).addTo(map);
    marker.current = mk;
    return () => {
      mk.remove();
      marker.current = null;
    };
  }, [map, el, zIndex]);

  useEffect(() => {
    const from = current.current;
    const to = position;
    const km = haversineKm(from, to);
    if (heading != null) setBearing(heading);
    else if (km > 0.005) setBearing(bearingDeg(from, to));

    if (km < STILL_KM || km > TELEPORT_KM) {
      current.current = to;
      marker.current?.setLngLat([to.lng, to.lat]);
      return;
    }
    const controls = animate(0, 1, {
      duration: durationMs / 1000,
      ease: "linear",
      onUpdate: (t) => {
        const lat = from.lat + (to.lat - from.lat) * t;
        const lng = from.lng + (to.lng - from.lng) * t;
        current.current = { lat, lng };
        marker.current?.setLngLat([lng, lat]);
      },
    });
    return () => controls.stop();
  }, [position.lat, position.lng, heading, durationMs, position]);

  return createPortal(<CarMarker heading={bearing} category={category} pulse={pulse} />, el);
}
