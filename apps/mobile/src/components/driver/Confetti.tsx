import { motion } from "framer-motion";
import { useMemo } from "react";
import { cn } from "@/lib/utils";

const COLORS = ["#34d399", "#6ee7b7", "#fbbf24", "#fcd34d", "#a78bfa", "#38bdf8", "#f8fafc"];

interface Particle {
  id: number;
  x: number;
  drift: number;
  size: number;
  color: string;
  delay: number;
  duration: number;
  rotate: number;
  round: boolean;
}

/**
 * A burst of paper from the top of its container. Pure framer-motion, no
 * canvas, so it respects reduced-motion and costs nothing when idle.
 */
export function Confetti({ count = 70, className, seed = 1 }: { count?: number; className?: string; seed?: number }) {
  const particles = useMemo<Particle[]>(() => {
    let s = seed * 9301 + 49297;
    const rnd = () => {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      x: 5 + rnd() * 90,
      drift: (rnd() - 0.5) * 160,
      size: 6 + rnd() * 8,
      color: COLORS[Math.floor(rnd() * COLORS.length)] ?? "#34d399",
      delay: rnd() * 0.6,
      duration: 2 + rnd() * 1.6,
      rotate: 360 + rnd() * 720,
      round: rnd() > 0.65,
    }));
  }, [count, seed]);

  const fall = typeof window !== "undefined" ? window.innerHeight + 120 : 1000;
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      {particles.map((p) => (
        <motion.span
          key={p.id}
          className={cn("absolute top-0 block", p.round ? "rounded-full" : "rounded-[2px]")}
          style={{ left: `${p.x}%`, width: p.size, height: p.round ? p.size : p.size * 0.55, background: p.color }}
          initial={{ y: -40, x: 0, opacity: 0, rotate: 0, scale: 0.6 }}
          animate={{ y: [-40, fall], x: [0, p.drift], opacity: [0, 1, 1, 0], rotate: p.rotate, scale: 1 }}
          transition={{ duration: p.duration, delay: p.delay, ease: [0.2, 0.6, 0.4, 1], opacity: { duration: p.duration, times: [0, 0.1, 0.8, 1] } }}
        />
      ))}
    </div>
  );
}
