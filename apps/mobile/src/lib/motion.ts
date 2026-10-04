/**
 * Motion vocabulary. Every screen composes these so the whole app moves with
 * one physical character: fast-in, soft-settle springs, elements arriving
 * from different edges and staggering into place.
 */
import type { Transition, Variants } from "framer-motion";

export const spring: Transition = { type: "spring", stiffness: 420, damping: 38, mass: 0.9 };
export const springSoft: Transition = { type: "spring", stiffness: 260, damping: 30, mass: 1 };
export const springBouncy: Transition = { type: "spring", stiffness: 520, damping: 26, mass: 0.8 };
export const easeOut: Transition = { duration: 0.45, ease: [0.16, 1, 0.3, 1] };

type Dir = "up" | "down" | "left" | "right" | "scale" | "fade";

const offset = (dir: Dir, d = 32) => {
  switch (dir) {
    case "up":
      return { y: d };
    case "down":
      return { y: -d };
    case "left":
      return { x: d };
    case "right":
      return { x: -d };
    case "scale":
      return { scale: 0.92 };
    default:
      return {};
  }
};

/** Enter from a direction. Use with `variants={fromDir("up")}` + initial="hidden" animate="show". */
export const fromDir = (dir: Dir = "up", distance = 32, delay = 0): Variants => ({
  hidden: { opacity: 0, ...offset(dir, distance) },
  show: { opacity: 1, x: 0, y: 0, scale: 1, transition: { ...spring, delay } },
  exit: { opacity: 0, ...offset(dir, distance / 2), transition: { duration: 0.18 } },
});

/** Parent container that staggers children. */
export const stagger = (staggerChildren = 0.06, delayChildren = 0.05): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren, delayChildren } },
  exit: { transition: { staggerChildren: 0.02, staggerDirection: -1 } },
});

/** Children of a stagger container — each may come from a different edge. */
export const item = {
  up: fromDir("up", 28),
  down: fromDir("down", 28),
  left: fromDir("left", 36),
  right: fromDir("right", 36),
  scale: fromDir("scale"),
  fade: fromDir("fade"),
} satisfies Record<Dir, Variants>;

/** Full-page transitions driven by navigation direction. */
export const pageVariants: Variants = {
  initial: (dir: number = 1) => ({ opacity: 0, x: dir * 36, scale: 0.985, filter: "blur(6px)" }),
  animate: { opacity: 1, x: 0, scale: 1, filter: "blur(0px)", transition: { ...spring, opacity: { duration: 0.25 }, filter: { duration: 0.3 } } },
  exit: (dir: number = 1) => ({ opacity: 0, x: dir * -28, scale: 0.985, filter: "blur(4px)", transition: { duration: 0.2, ease: [0.4, 0, 1, 1] } }),
};

/** Bottom sheets. */
export const sheetVariants: Variants = {
  hidden: { y: "100%", opacity: 0.6 },
  show: { y: 0, opacity: 1, transition: { ...springSoft } },
  exit: { y: "100%", opacity: 0.6, transition: { duration: 0.24, ease: [0.4, 0, 1, 1] } },
};

export const backdropVariants: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.25 } },
  exit: { opacity: 0, transition: { duration: 0.2 } },
};

/** Tactile press for buttons/cards. */
export const pressable = { whileTap: { scale: 0.97 }, transition: spring } as const;
export const pressableSoft = { whileTap: { scale: 0.985 }, transition: spring } as const;

/** Floating idle animation for hero illustrations. */
export const float = (amp = 8, duration = 4) => ({
  animate: { y: [0, -amp, 0] },
  transition: { duration, repeat: Infinity, ease: "easeInOut" as const },
});
