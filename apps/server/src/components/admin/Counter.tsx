"use client";

import { animate, useInView, useMotionValue, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

/** Number that counts up to its target whenever the target changes. */
export function Counter({ value, format = (n) => Math.round(n).toLocaleString("en-PK"), duration = 1.1, className }: { value: number; format?: (n: number) => string; duration?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -10% 0px" });
  const reduced = useReducedMotion();
  const mv = useMotionValue(0);
  const [text, setText] = useState(format(0));

  useEffect(() => {
    if (!inView) return;
    if (reduced) {
      mv.set(value);
      setText(format(value));
      return;
    }
    const controls = animate(mv, value, { duration, ease: [0.16, 1, 0.3, 1], onUpdate: (v) => setText(format(v)) });
    return () => controls.stop();
    // `format` is intentionally excluded: callers pass inline formatters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, inView, duration, reduced, mv]);

  return (
    <span ref={ref} className={className}>
      {text}
    </span>
  );
}
