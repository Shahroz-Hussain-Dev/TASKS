import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const TINT = {
  teal: "bg-teal-400/35",
  coral: "bg-coral-400/35",
  sun: "bg-sun-400/45",
  sky: "bg-sky-400/35",
} as const;

/**
 * "Breathing" halo for the CTA that is the next step. The glow behind the
 * button swells and fades; the button itself never moves, so automated taps
 * (and thumbs) always land on a stable target.
 */
export function Breathe({ children, active = true, tone = "teal", className }: { children: ReactNode; active?: boolean; tone?: keyof typeof TINT; className?: string }) {
  return (
    <div className={cn("relative", className)}>
      {active && <motion.span aria-hidden className={cn("absolute inset-0 rounded-full pointer-events-none", TINT[tone])} animate={{ scale: [1, 1.05, 1], opacity: [0.45, 0, 0.45] }} transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }} />}
      <div className="relative">{children}</div>
    </div>
  );
}
