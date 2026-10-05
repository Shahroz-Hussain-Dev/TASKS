/**
 * Reveals a growing string a few characters at a time, so streamed assistant
 * replies read as typing instead of jumping in chunks. Speeds up when it
 * falls behind the stream so it never lags more than a moment.
 */
import { useEffect, useRef, useState } from "react";

export function useTypewriter(target: string, enabled = true, charsPerSecond = 80): { shown: string; done: boolean } {
  const [shown, setShown] = useState(enabled ? "" : target);
  const shownRef = useRef(shown);

  useEffect(() => {
    if (!enabled) {
      shownRef.current = target;
      setShown(target);
      return;
    }
    if (!target.startsWith(shownRef.current)) {
      shownRef.current = "";
      setShown("");
    }
    let raf = 0;
    let last = performance.now();
    let budget = 0;
    const tick = (now: number) => {
      const dt = Math.min(100, now - last);
      last = now;
      const backlog = target.length - shownRef.current.length;
      if (backlog <= 0) return;
      const speed = charsPerSecond * (1 + backlog / 60);
      budget += (dt / 1000) * speed;
      const n = Math.floor(budget);
      if (n > 0) {
        budget -= n;
        shownRef.current = target.slice(0, shownRef.current.length + n);
        setShown(shownRef.current);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, enabled, charsPerSecond]);

  return { shown, done: shown.length >= target.length };
}
