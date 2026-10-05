import { motion } from "framer-motion";
import { Minus, Plus } from "@phosphor-icons/react";
import { useEffect, useRef } from "react";
import { Money } from "@/components/ui";
import { springJelly } from "@/lib/motion";
import { haptic } from "@/lib/native";
import { cn } from "@/lib/utils";

/**
 * Minus / value / plus control with jelly circles. Press-and-hold repeats so
 * sliding a fare by a few hundred rupees is quick. Values are clamped to
 * [min, max] and the buttons disable at the edges.
 */
export function Stepper({ value, onChange, step, min, max, format, money, className, label, size = "lg" }: { value: number; onChange: (v: number) => void; step: number; min: number; max: number; format?: (v: number) => string; money?: boolean; className?: string; label?: string; size?: "md" | "lg" }) {
  const timer = useRef<number | null>(null);
  const valueRef = useRef(value);
  valueRef.current = value;

  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  const bump = (dir: 1 | -1) => {
    const next = clamp(valueRef.current + dir * step);
    if (next !== valueRef.current) {
      haptic.tick();
      onChange(next);
      valueRef.current = next;
    }
  };

  const stopRepeat = () => {
    if (timer.current !== null) {
      window.clearInterval(timer.current);
      timer.current = null;
    }
  };
  const startRepeat = (dir: 1 | -1) => {
    stopRepeat();
    let ticks = 0;
    timer.current = window.setInterval(() => {
      ticks += 1;
      if (ticks > 3) bump(dir);
    }, 110);
  };
  useEffect(() => stopRepeat, []);

  const btn = size === "lg" ? "size-12" : "size-10";
  const txt = size === "lg" ? "text-[30px]" : "text-[22px]";

  return (
    <div className={cn("flex flex-col items-center gap-1", className)}>
      {label && <span className="text-[12px] font-extrabold uppercase tracking-[0.14em] text-ink-500">{label}</span>}
      <div className="flex items-center gap-3">
        <motion.button
          type="button"
          aria-label="Decrease"
          disabled={value <= min}
          whileTap={{ scale: 0.9, y: 2 }}
          transition={springJelly}
          onClick={() => bump(-1)}
          onPointerDown={() => startRepeat(-1)}
          onPointerUp={stopRepeat}
          onPointerLeave={stopRepeat}
          onPointerCancel={stopRepeat}
          className={cn(btn, "rounded-full jelly jelly-cream flex items-center justify-center disabled:opacity-35 select-none touch-none")}
        >
          <Minus className="size-5" weight="bold" />
        </motion.button>
        <div className={cn("min-w-32 text-center font-display font-semibold text-ink-900 tabular-nums tracking-tight", txt)}>{money ? <Money value={value} /> : <span>{format ? format(value) : value}</span>}</div>
        <motion.button
          type="button"
          aria-label="Increase"
          disabled={value >= max}
          whileTap={{ scale: 0.9, y: 2 }}
          transition={springJelly}
          onClick={() => bump(1)}
          onPointerDown={() => startRepeat(1)}
          onPointerUp={stopRepeat}
          onPointerLeave={stopRepeat}
          onPointerCancel={stopRepeat}
          className={cn(btn, "rounded-full jelly jelly-teal flex items-center justify-center disabled:opacity-35 select-none touch-none")}
        >
          <Plus className="size-5" weight="bold" />
        </motion.button>
      </div>
    </div>
  );
}
