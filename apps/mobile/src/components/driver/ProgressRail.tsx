import { motion } from "framer-motion";
import { Check } from "@phosphor-icons/react";
import { Buddy } from "@/components/buddy";
import { spring, springBouncy } from "@/lib/motion";
import { haptic } from "@/lib/native";
import { cn } from "@/lib/utils";

export interface RailStep {
  id: string;
  label: string;
}

const NODE = 32;

/**
 * Progress rail for the onboarding wizard drawn as a dotted path: teal
 * circles for each step (completed ones flip to a check), a solid teal trail
 * up to the active step, and a small Buddy sitting on the current step.
 * Completed steps are tappable to jump back.
 */
export function ProgressRail({ steps, current, completed, onSelect, className }: { steps: readonly RailStep[]; current: string; completed: ReadonlySet<string>; onSelect?: (id: string) => void; className?: string }) {
  const currentIndex = Math.max(0, steps.findIndex((s) => s.id === current));
  const n = Math.max(1, steps.length);
  const centre = (i: number) => `${((i + 0.5) / n) * 100}%`;
  const fill = `${((currentIndex + 0.5) / n) * 100}%`;
  return (
    <div className={cn("relative pt-9", className)} role="list" aria-label="Onboarding progress">
      {/* Dotted path */}
      <div className="absolute inset-x-0 pointer-events-none" style={{ top: 36 + NODE / 2 - 2, height: 4 }} aria-hidden>
        <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
          <line x1={centre(0)} x2={centre(n - 1)} y1="2" y2="2" stroke="#ead9c3" strokeWidth="3" strokeLinecap="round" strokeDasharray="1 9" />
        </svg>
        <motion.div className="absolute top-0 h-full rounded-full bg-teal-400" style={{ left: centre(0) }} initial={false} animate={{ width: `calc(${fill} - ${centre(0)})` }} transition={spring} />
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
              className="relative flex flex-col items-center gap-1.5 disabled:cursor-default"
            >
              {active && (
                <motion.span layoutId="rail-buddy" transition={spring} className="absolute -top-9 left-1/2 -translate-x-1/2 pointer-events-none" aria-hidden>
                  <motion.span className="block" animate={{ y: [0, -3, 0] }} transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}>
                    <Buddy size={44} state="idle" />
                  </motion.span>
                </motion.span>
              )}
              <span className="relative flex items-center justify-center" style={{ width: NODE, height: NODE }}>
                {active && <motion.span layoutId="rail-ring" className="absolute -inset-1.5 rounded-full bg-teal-100" transition={spring} />}
                {active && <motion.span className="absolute inset-0 rounded-full bg-teal-400/40" animate={{ scale: [1, 1.6, 1], opacity: [0.6, 0, 0.6] }} transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }} />}
                <motion.span
                  initial={false}
                  animate={{ backgroundColor: done || active ? "#12a594" : "#ffffff", color: done || active ? "#ffffff" : "#a39cb0", scale: active ? 1 : 0.84, borderColor: done || active ? "#12a594" : "#ead9c3" }}
                  transition={spring}
                  className="relative rounded-full flex items-center justify-center font-display text-[13px] font-semibold border-[2.5px] shadow-pillow"
                  style={{ width: NODE, height: NODE }}
                >
                  {done ? (
                    <motion.span key="check" initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} transition={springBouncy}>
                      <Check className="size-4" weight="bold" />
                    </motion.span>
                  ) : (
                    <span>{i + 1}</span>
                  )}
                </motion.span>
              </span>
              <span className={cn("text-[11px] font-extrabold tracking-wide transition-colors", active ? "text-teal-600" : done ? "text-ink-700" : "text-ink-400")}>{s.label}</span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
