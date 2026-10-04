import { useEffect, useState } from "react";

/**
 * A clock that re-renders on an interval. Countdowns derive their remaining
 * time from this instead of keeping their own timers, so twenty bid cards tick
 * in lockstep and the screen never drifts.
 */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    setNow(Date.now());
    const t = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(t);
  }, [intervalMs]);
  return now;
}

/** mm:ss for request countdowns. */
export function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}
