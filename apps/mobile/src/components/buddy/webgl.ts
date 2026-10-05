let cached: boolean | null = null;

/** Can this device draw WebGL at all? Checked once; cheap afterwards. */
export function hasWebGL(): boolean {
  if (cached !== null) return cached;
  if (typeof document === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    const attrs = { failIfMajorPerformanceCaveat: false, alpha: true };
    const gl = canvas.getContext("webgl2", attrs) ?? canvas.getContext("webgl", attrs);
    cached = Boolean(gl);
    const lose = (gl as WebGLRenderingContext | null)?.getExtension("WEBGL_lose_context");
    lose?.loseContext();
  } catch {
    cached = false;
  }
  return cached;
}

/** The user asked the OS for less motion — Buddy still moves, just gently. */
export function prefersReducedMotion(): boolean {
  try {
    return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}
