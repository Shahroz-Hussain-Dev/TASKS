/**
 * Delight moments: a short burst of brand-coloured confetti (driver approved,
 * ride completed, Buddy happy). Respects reduced motion and never throws.
 */
import confetti from "canvas-confetti";

export const CONFETTI_COLORS = ["#ff6b4a", "#ffc53d", "#12a594", "#8b7cf6", "#3da9fc"];

let lastBurst = 0;

/** Fire a celebration. Debounced so a flurry of state changes becomes one party. */
export function celebrate(opts: { origin?: { x: number; y: number }; intensity?: "soft" | "big" } = {}) {
  if (typeof window === "undefined") return;
  const now = Date.now();
  if (now - lastBurst < 700) return;
  lastBurst = now;
  try {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const big = opts.intensity === "big";
    const origin = opts.origin ?? { x: 0.5, y: 0.62 };
    const base = { colors: CONFETTI_COLORS, zIndex: 9999, disableForReducedMotion: true, ticks: big ? 260 : 200, gravity: 1.05, scalar: 1.05 } as const;
    void confetti({ ...base, particleCount: big ? 90 : 55, spread: 70, startVelocity: big ? 48 : 38, origin });
    window.setTimeout(() => {
      void confetti({ ...base, particleCount: big ? 50 : 30, angle: 60, spread: 55, startVelocity: 42, origin: { x: 0.08, y: 0.72 } });
      void confetti({ ...base, particleCount: big ? 50 : 30, angle: 120, spread: 55, startVelocity: 42, origin: { x: 0.92, y: 0.72 } });
    }, 140);
  } catch {
    /* canvas not available */
  }
}
