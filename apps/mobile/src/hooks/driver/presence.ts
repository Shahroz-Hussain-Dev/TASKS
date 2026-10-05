/**
 * Driver presence & GPS tracker.
 *
 * A module-level store (not React state) so the tracker survives tab switches
 * and screen transitions: once the driver goes online the device keeps
 * watching GPS and pinging the server every 5 s until they go offline, and a
 * live ride holds the tracker open even when the driver is offline.
 *
 * Screens read it through `useDriverPresence()` (useSyncExternalStore) and
 * keep the GPS alive with `useGpsHold("<screen>")`. Pings are only sent while
 * the driver is online or inside a ride.
 */
import { useEffect, useSyncExternalStore } from "react";
import { api, ApiRequestError } from "@/lib/api";
import { ensureLocationPermission, getCurrentLocation, watchLocation, type LocationFix } from "@/lib/native";
import { errorMessage } from "@/lib/utils";

export const LOCATION_PING_MS = 5_000;
/** Screens hand the tracker over to each other during navigation; keep GPS warm across the gap. */
const RELEASE_GRACE_MS = 1_500;
const RIDE_HOLD = "ride";
const ONLINE_HOLD = "online";

export interface PresenceState {
  /** Accepting requests (mirrors the server's `isOnline`). */
  online: boolean;
  /** Driver id whose server state has been applied this launch (null until hydrated). */
  hydratedFor: string | null;
  /** Latest GPS fix while the tracker is running. */
  fix: LocationFix | null;
  /** Ride id the server reported on the last location ping. */
  activeRideId: string | null;
  permission: "unknown" | "granted" | "denied";
  /** GPS watch is running. */
  tracking: boolean;
  lastPingAt: number | null;
  /** When the driver last flipped online/offline locally — newer server reads win, older ones are ignored. */
  lastToggleAt: number;
  pingError: string | null;
}

let state: PresenceState = {
  online: false,
  hydratedFor: null,
  fix: null,
  activeRideId: null,
  permission: "unknown",
  tracking: false,
  lastPingAt: null,
  lastToggleAt: 0,
  pingError: null,
};

const listeners = new Set<() => void>();
const holds = new Set<string>();
let stopWatch: (() => void) | null = null;
let starting: Promise<boolean> | null = null;
let pingTimer: number | null = null;
let releaseTimer: number | null = null;
let pendingFix: LocationFix | null = null;
let lastPingSentAt = 0;
let pingInFlight = false;

function emit() {
  for (const l of listeners) l();
}

function patch(p: Partial<PresenceState>) {
  state = { ...state, ...p };
  emit();
}

const shouldPing = () => state.online || holds.has(RIDE_HOLD);

function sanitizeHeading(h: number | null): number | null {
  if (h === null || !Number.isFinite(h)) return null;
  return ((h % 360) + 360) % 360;
}

async function sendPing(fix: LocationFix) {
  if (pingInFlight) {
    pendingFix = fix;
    return;
  }
  if (!shouldPing()) return;
  pingInFlight = true;
  lastPingSentAt = Date.now();
  try {
    const res = await api.driver.location({
      lat: fix.lat,
      lng: fix.lng,
      heading: sanitizeHeading(fix.heading),
      speedKmh: fix.speedKmh !== null && Number.isFinite(fix.speedKmh) ? Math.min(300, Math.max(0, fix.speedKmh)) : null,
      accuracyM: fix.accuracyM !== null && Number.isFinite(fix.accuracyM) ? Math.min(10_000, Math.max(0, fix.accuracyM)) : null,
    });
    patch({ activeRideId: res.activeRideId, lastPingAt: Date.now(), pingError: null });
  } catch (err) {
    if (err instanceof ApiRequestError && (err.status === 401 || err.status === 403)) {
      // Session ended (logout or block): stop tracking entirely.
      presence.reset();
      return;
    }
    patch({ pingError: errorMessage(err, "Location update failed") });
  } finally {
    pingInFlight = false;
    if (pendingFix) {
      const f = pendingFix;
      pendingFix = null;
      schedulePing(f);
    }
  }
}

/** Throttle: at most one ping per LOCATION_PING_MS, always sending the freshest fix. */
function schedulePing(fix: LocationFix) {
  if (!shouldPing()) return;
  const elapsed = Date.now() - lastPingSentAt;
  if (elapsed >= LOCATION_PING_MS) {
    void sendPing(fix);
    return;
  }
  pendingFix = fix;
  if (pingTimer === null) {
    pingTimer = window.setTimeout(() => {
      pingTimer = null;
      const f = pendingFix;
      pendingFix = null;
      if (f) void sendPing(f);
    }, LOCATION_PING_MS - elapsed);
  }
}

async function startTracking(): Promise<boolean> {
  if (stopWatch) return true;
  if (starting) return starting;
  starting = (async () => {
    const granted = await ensureLocationPermission();
    if (!granted) {
      patch({ permission: "denied" });
      return false;
    }
    patch({ permission: "granted" });
    const stop = await watchLocation((fix) => {
      patch({ fix });
      schedulePing(fix);
    });
    if (holds.size === 0) {
      // Released while we were asking for permission.
      stop();
      return true;
    }
    stopWatch = stop;
    patch({ tracking: true });
    const first = await getCurrentLocation();
    if (first && holds.size > 0) {
      patch({ fix: first });
      schedulePing(first);
    }
    return true;
  })().finally(() => {
    starting = null;
  });
  return starting;
}

function stopTracking() {
  stopWatch?.();
  stopWatch = null;
  if (pingTimer !== null) {
    window.clearTimeout(pingTimer);
    pingTimer = null;
  }
  pendingFix = null;
  patch({ tracking: false });
}

export const presence = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  getState: (): PresenceState => state,

  /** Keep GPS running while `key` is held. Resolves false when location permission was refused. */
  acquire(key: string): Promise<boolean> {
    holds.add(key);
    if (releaseTimer !== null) {
      window.clearTimeout(releaseTimer);
      releaseTimer = null;
    }
    return startTracking();
  },
  release(key: string) {
    holds.delete(key);
    if (holds.size > 0 || releaseTimer !== null) return;
    releaseTimer = window.setTimeout(() => {
      releaseTimer = null;
      if (holds.size === 0) stopTracking();
    }, RELEASE_GRACE_MS);
  },

  /** Apply the server's online flag once per driver per launch (cold start / relogin). */
  hydrate(driverId: string, online: boolean) {
    if (state.hydratedFor === driverId) return;
    if (state.hydratedFor !== null) presence.reset();
    patch({ hydratedFor: driverId });
    presence.setOnline(online, false);
  },

  /** Set the online flag after the server confirmed it. `local` marks a driver-initiated toggle. */
  setOnline(online: boolean, local = true) {
    patch({ online, lastToggleAt: local ? Date.now() : state.lastToggleAt });
    if (online) void presence.acquire(ONLINE_HOLD);
    else presence.release(ONLINE_HOLD);
  },

  /** Reconcile with a server read taken at `readAt`; ignored when older than the last local toggle. */
  reconcile(online: boolean, readAt: number) {
    if (readAt <= state.lastToggleAt) return;
    if (online !== state.online) presence.setOnline(online, false);
  },

  /** Push the latest fix immediately (e.g. right after going online). */
  pingNow() {
    if (state.fix) void sendPing(state.fix);
  },

  setActiveRide(id: string | null) {
    if (state.activeRideId !== id) patch({ activeRideId: id });
  },

  /** Forget everything on logout. */
  reset() {
    holds.clear();
    if (releaseTimer !== null) {
      window.clearTimeout(releaseTimer);
      releaseTimer = null;
    }
    stopTracking();
    state = { ...state, online: false, hydratedFor: null, activeRideId: null, lastToggleAt: 0, pingError: null };
    emit();
  },
};

export function useDriverPresence(): PresenceState {
  return useSyncExternalStore(presence.subscribe, presence.getState, presence.getState);
}

/** Keep the GPS tracker alive while the calling screen is mounted. */
export function useGpsHold(key: string, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    void presence.acquire(key);
    return () => presence.release(key);
  }, [key, enabled]);
}
