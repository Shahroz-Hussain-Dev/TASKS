import { useEffect, useState, type RefObject } from "react";

/**
 * Tracks an element's rendered height (rounded to whole pixels) so map
 * cameras can keep pins clear of a bottom panel whose size changes.
 */
export function useElementHeight<T extends HTMLElement>(ref: RefObject<T | null>, fallback: number): number {
  const [height, setHeight] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setHeight(Math.round(el.getBoundingClientRect().height) || fallback);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, fallback]);
  return height;
}
