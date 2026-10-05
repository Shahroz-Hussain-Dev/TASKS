import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Circular countdown. `left / total` drives the arc; the stroke warms from
 * teal to sun to rose as time runs out.
 */
export function CountdownRing({ total, left, size = 56, stroke = 4, children, className }: { total: number; left: number; size?: number; stroke?: number; children?: ReactNode; className?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const frac = total > 0 ? Math.min(1, Math.max(0, left / total)) : 0;
  const color = frac > 0.5 ? "#12a594" : frac > 0.2 ? "#ffc53d" : "#f4537e";
  return (
    <div className={cn("relative shrink-0", className)} style={{ width: size, height: size }} role="timer" aria-label={`${Math.ceil(left)} seconds left`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f6e9d8" strokeWidth={stroke} />
        <motion.circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} initial={false} animate={{ strokeDashoffset: c * (1 - frac), stroke: color }} transition={{ strokeDashoffset: { duration: 0.9, ease: "linear" }, stroke: { duration: 0.4 } }} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}
