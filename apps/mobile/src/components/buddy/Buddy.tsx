import { Component, lazy, Suspense, useEffect, useMemo, type ErrorInfo, type ReactNode } from "react";
import { celebrate } from "@/lib/confetti";
import { cn } from "@/lib/utils";
import { BuddyFallback } from "./BuddyFallback";
import type { BuddyState } from "./types";
import { hasWebGL } from "./webgl";

/* The three.js stack only loads when a Buddy is actually on screen. */
const BuddyScene = lazy(() => import("./BuddyScene"));

class SceneBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) console.warn("Buddy 3D failed, using the SVG fallback", error, info.componentStack);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/**
 * Buddy, Raahi's assistant. A transparent WebGL canvas (lazy-loaded) with an
 * SVG twin as the loading/unsupported fallback. `state` drives the animation.
 */
export function Buddy({ state = "idle", size = 160, className }: { state?: BuddyState; size?: number; className?: string }) {
  const webgl = useMemo(() => hasWebGL(), []);

  useEffect(() => {
    if (state === "happy") celebrate();
  }, [state]);

  const fallback = <BuddyFallback state={state} size={size} className="absolute inset-0" />;
  return (
    <div style={{ width: size, height: size }} className={cn("relative shrink-0 select-none", className)} data-buddy-state={state}>
      {webgl ? (
        <SceneBoundary fallback={fallback}>
          <Suspense fallback={fallback}>
            <BuddyScene state={state} size={size} />
          </Suspense>
        </SceneBoundary>
      ) : (
        fallback
      )}
    </div>
  );
}
