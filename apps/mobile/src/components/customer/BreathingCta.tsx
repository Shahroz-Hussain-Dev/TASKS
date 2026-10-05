import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Wraps the primary call to action when it is the next step. A coral halo
 * behind the button breathes (the `breathe` keyframes from global.css plus a
 * soft opacity pulse) while the button itself stays perfectly still, so taps
 * and automated clicks always land on a stable target.
 */
export function BreathingCta({ active = true, children, className }: { active?: boolean; children: ReactNode; className?: string }) {
  return (
    <div className={cn("relative", className)}>
      {active && (
        <motion.span
          aria-hidden
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.35, 0.7, 0.35] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          className="breathe pointer-events-none absolute -inset-1 rounded-full bg-coral-400 blur-md"
        />
      )}
      <div className="relative">{children}</div>
    </div>
  );
}
