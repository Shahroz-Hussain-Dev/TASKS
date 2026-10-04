import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { useNow } from "@/hooks/customer/useNow";
import { cn, secondsLeft } from "@/lib/utils";

/**
 * Circular countdown. The arc drains continuously (one linear tween from the
 * remaining fraction to zero, so there is nothing to re-render per frame) and
 * the colour shifts from brand to amber to rose as time runs out.
 */
export function CountdownRing({ expiresAt, totalSeconds, size = 46, stroke = 3.5, className, children }: { expiresAt: string; totalSeconds: number; size?: number; stroke?: number; className?: string; children?: ReactNode }) {
  const now = useNow(1000);
  const left = secondsLeft(expiresAt, now);
  const fraction = Math.min(1, Math.max(0, left / Math.max(1, totalSeconds)));
  const r = (size - stroke) / 2;
  const colour = fraction > 0.5 ? "#34d399" : fraction > 0.25 ? "#fbbf24" : "#fb7185";

  return (
    <div className={cn("relative inline-flex items-center justify-center shrink-0", className)} style={{ width: size, height: size }} role="timer" aria-label={`${left} seconds left`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
        <motion.circle
          key={expiresAt}
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={colour}
          strokeWidth={stroke}
          strokeLinecap="round"
          initial={{ pathLength: fraction }}
          animate={{ pathLength: 0 }}
          transition={{ duration: left, ease: "linear" }}
          style={{ transition: "stroke 600ms ease" }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-display text-[13px] font-bold tabular-nums" style={{ color: colour }}>
        {children ?? left}
      </span>
    </div>
  );
}
