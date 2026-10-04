/**
 * Query keys for the driver flow. `["rides", …]` shares the prefix used by the
 * shared screens so a rating or cancellation anywhere invalidates here too.
 */
import type { LatLng } from "@raahi/shared";

/** Round to ~10 m so GPS jitter does not create new route cache entries. */
const r4 = (n: number) => Math.round(n * 1e4) / 1e4;

export const dk = {
  driver: ["driver", "me"] as const,
  feed: ["driver", "feed"] as const,
  bids: ["driver", "bids"] as const,
  earnings: ["driver", "earnings"] as const,
  activeRide: ["driver", "active-ride"] as const,
  catalog: (category: string) => ["vehicles", "catalog", category] as const,
  ridesList: ["rides", "driver-list"] as const,
  routeTo: (from: LatLng, to: LatLng) => ["geo", "route", r4(from.lat), r4(from.lng), r4(to.lat), r4(to.lng)] as const,
};

export const FEED_POLL_MS = 3_000;
export const ACTIVE_RIDE_POLL_MS = 5_000;
export const RIDE_POLL_MS = 3_000;
export const STATUS_POLL_MS = 10_000;
