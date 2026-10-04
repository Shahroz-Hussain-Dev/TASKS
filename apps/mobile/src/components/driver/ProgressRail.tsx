import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { spring, springBouncy } from "@/lib/motion";
import { haptic } from "@/lib/native";
import { cn } from "@/lib/utils";

export interface RailStep {
  id: string;
  label: string;
}

/**
 * Horizontal progress rail for the onboarding wizard: a track that fills up to
 * the active step, completed nodes flip to a check, and the active node wears
 * a breathing ring. Completed steps are tappable to jump back.
 */
export function ProgressRail({ steps, current, completed, onSelect, className }: { steps: readonly RailStep[]; current: string; completed: ReadonlySet<string>; onSelect?: (id: string) => void; className?: string }) {
  const currentIndex = Math.max(0, steps.findIndex((s) => s.id === current));
  const fill = steps.length > 1 ? (currentIndex / (steps.length - 1)) * 100 : 0;
  return (
    <div className={cn("relative px-3", className)} role="list" aria-label="Onboarding progress">
      <div className="absolute left-7 right-7 top-4 h-1 rounded-full bg-white/8 overflow-hidden" aria-hidden>
        <motion.div className="h-full rounded-full bg-gradient-to-r from-brand-600 to-brand-400 shadow-glow" initial={false} animate={{ width: `${fill}%` }} transition={spring} />
      </div>
      <div className="relative grid" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
        {steps.map((s, i) => {
          const done = completed.has(s.id) && s.id !== current;
          const active = s.id === current;
          const reachable = Boolean(onSelect) && (done || i < currentIndex);
          return (
            <motion.button
              key={s.id}
              type="button"
              role="listitem"
              aria-current={active ? "step" : undefined}
              disabled={!reachable}
              whileTap={reachable ? { scale: 0.92 } : undefined}
              onClick={() => {
                if (!reachable) return;
                haptic.tick();
                onSelect?.(s.id);
              }}
              className="flex flex-col items-center gap-2 disabled:cursor-default"
            >
              <span className="relative size-9 flex items-center justify-center">
                {active && <motion.span layoutId="rail-ring" className="absolute inset-0 rounded-full border-2 border-brand-400/70" transition={spring} />}
                {active && <motion.span className="absolute inset-0 rounded-full bg-brand-500/25" animate={{ scale: [1, 1.5, 1], opacity: [0.6, 0, 0.6] }} transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }} />}
                <motion.span
                  initial={false}
                  animate={{ backgroundColor: done || active ? "#10b981" : "#1a2235", color: done || active ? "#06080f" : "#94a3b8", scale: active ? 1 : 0.86 }}
                  transition={spring}
                  className="relative size-7 rounded-full flex items-center justify-center font-display text-[12.5px] font-bold border border-white/8"
                >
                  {done ? (
                    <motion.span key="check" initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} transition={springBouncy}>
                      <Check className="size-3.5" strokeWidth={3} />
                    </motion.span>
                  ) : (
                    <span>{i + 1}</span>
                  )}
                </motion.span>
              </span>
              <span className={cn("text-[11px] font-semibold tracking-wide transition-colors", active ? "text-brand-300" : done ? "text-ink-200" : "text-ink-500")}>{s.label}</span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
