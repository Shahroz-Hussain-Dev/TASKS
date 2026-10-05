import { useCallback, useEffect, useRef, useState } from "react";
import { ensureLocationPermission, getCurrentLocation, watchLocation, type LocationFix } from "@/lib/native";

export type LocationStatus = "idle" | "locating" | "ready" | "denied" | "unavailable";

export interface DeviceLocation {
  fix: LocationFix | null;
  status: LocationStatus;
  /** Ask for permission (again) and take a fresh fix. */
  locate: () => Promise<LocationFix | null>;
}

/**
 * Device GPS as React state. Takes one fix on mount and, with `watch`, keeps
 * following the device so the blue dot moves with the person.
 */
export function useDeviceLocation({ watch = false }: { watch?: boolean } = {}): DeviceLocation {
  const [fix, setFix] = useState<LocationFix | null>(null);
  const [status, setStatus] = useState<LocationStatus>("idle");
  const mounted = useRef(true);

  const locate = useCallback(async (): Promise<LocationFix | null> => {
    setStatus((s) => (s === "ready" ? s : "locating"));
    const granted = await ensureLocationPermission();
    const f = await getCurrentLocation();
    if (!mounted.current) return f;
    if (f) {
      setFix(f);
      setStatus("ready");
      return f;
    }
    setStatus((s) => (s === "ready" ? s : granted ? "unavailable" : "denied"));
    return null;
  }, []);

  useEffect(() => {
    mounted.current = true;
    void locate();
    return () => {
      mounted.current = false;
    };
  }, [locate]);

  useEffect(() => {
    if (!watch) return;
    let stop: (() => void) | null = null;
    let cancelled = false;
    void watchLocation((f) => {
      if (cancelled) return;
      setFix(f);
      setStatus("ready");
    }).then((s) => {
      if (cancelled) s();
      else stop = s;
    });
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [watch]);

  return { fix, status, locate };
}
