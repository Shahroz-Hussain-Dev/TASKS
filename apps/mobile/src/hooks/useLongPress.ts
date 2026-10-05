/**
 * Press-and-hold gesture (used for the hidden server settings entry).
 * Returns pointer handlers to spread on the element plus `pressing` so the UI
 * can draw a progress ring while the timer runs.
 */
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { haptic } from "@/lib/native";

export interface LongPressHandlers {
  onPointerDown: (e: ReactPointerEvent<HTMLElement>) => void;
  onPointerUp: () => void;
  onPointerLeave: () => void;
  onPointerCancel: () => void;
  onContextMenu: (e: ReactPointerEvent<HTMLElement> | { preventDefault: () => void }) => void;
}

export function useLongPress(onLongPress: () => void, durationMs = 3000): { handlers: LongPressHandlers; pressing: boolean; durationMs: number } {
  const timer = useRef<number | null>(null);
  const [pressing, setPressing] = useState(false);
  const callback = useRef(onLongPress);
  callback.current = onLongPress;

  const clear = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    setPressing(false);
  }, []);

  const start = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      if (e.button !== undefined && e.button !== 0) return;
      clear();
      setPressing(true);
      timer.current = window.setTimeout(() => {
        timer.current = null;
        setPressing(false);
        haptic.medium();
        callback.current();
      }, durationMs);
    },
    [clear, durationMs],
  );

  useEffect(() => clear, [clear]);

  return {
    pressing,
    durationMs,
    handlers: {
      onPointerDown: start,
      onPointerUp: clear,
      onPointerLeave: clear,
      onPointerCancel: clear,
      onContextMenu: (e) => e.preventDefault(),
    },
  };
}
