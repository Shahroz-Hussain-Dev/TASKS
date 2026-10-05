/**
 * Query keys for the passenger flow. `qk.ride` / `qk.rides` from the shared
 * screens are reused so a rating or cancellation anywhere invalidates here too.
 */
import type { LatLng } from "@raahi/shared";

/** Round to ~1 m so tiny GPS jitter does not create new cache entries. */
const r5 = (n: number) => Math.round(n * 1e5) / 1e5;

export const ck = {
  activeTrip: ["customer", "active-trip"] as const,
  request: (id: string) => ["request", id] as const,
  quote: (pickup: LatLng, dropoff: LatLng) => ["quote", r5(pickup.lat), r5(pickup.lng), r5(dropoff.lat), r5(dropoff.lng)] as const,
  reverse: (p: LatLng | null) => ["geo", "reverse", p ? r5(p.lat) : null, p ? r5(p.lng) : null] as const,
  ridesList: ["rides", "list"] as const,
};
