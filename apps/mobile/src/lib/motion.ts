/**
 * Motion vocabulary ("Sunrise"). Everything moves with one physical character:
 * springy, slightly overshooting, tactile. Screens compose these; the page
 * transition lives in App.tsx.
 */
import type { Transition, Variants } from "framer-motion";

export const spring: Transition = { type: "spring", stiffness: 380, damping: 30, mass: 0.9 };
export const springSoft: Transition = { type: "spring", stiffness: 240, damping: 28, mass: 1 };
export const springBouncy: Transition = { type: "spring", stiffness: 520, damping: 22, mass: 0.8 };
export const springJelly: Transition = { type: "spring", stiffness: 600, damping: 18, mass: 0.7 };
export const easeOut: Transition = { duration: 0.45, ease: [0.16, 1, 0.3, 1] };

type Dir = "up" | "down" | "left" | "right" | "scale" | "fade" | "pop";

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
    case "pop":
      return { scale: 0.6 };
    default:
      return {};
  }
};

/** Enter from a direction. Use with `variants={fromDir("up")}` + initial="hidden" animate="show". */
export const fromDir = (dir: Dir = "up", distance = 32, delay = 0): Variants => ({
  hidden: { opacity: 0, ...offset(dir, distance) },
  show: { opacity: 1, x: 0, y: 0, scale: 1, transition: { ...(dir === "pop" ? springBouncy : spring), delay } },
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
  pop: fromDir("pop"),
  fade: fromDir("fade"),
} satisfies Record<Dir, Variants>;

/**
 * Page transitions: the incoming page rises and settles with a soft overshoot,
 * the outgoing one sinks and fades. Direction flips on back navigation.
 */
export const pageVariants: Variants = {
  initial: (dir: number = 1) => ({ opacity: 0, y: 24 * Math.sign(dir || 1), scale: 0.97 }),
  animate: { opacity: 1, y: 0, scale: 1, transition: { ...spring, opacity: { duration: 0.22 } } },
  exit: (dir: number = 1) => ({ opacity: 0, y: -12 * Math.sign(dir || 1), scale: 0.985, transition: { duration: 0.18, ease: [0.4, 0, 1, 1] } }),
};

/** Bottom sheets bounce in. */
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
/** Jelly press: squash down like a soft button. */
export const pressJelly = { whileTap: { scale: 0.96, y: 3 }, transition: springJelly } as const;

/** Floating idle animation for hero illustrations and Buddy. */
export const float = (amp = 8, duration = 4) => ({
  animate: { y: [0, -amp, 0] },
  transition: { duration, repeat: Infinity, ease: "easeInOut" as const },
});

/** Wiggle for attention (new bid, new request). */
export const wiggle = { rotate: [0, -3, 3, -2, 2, 0], transition: { duration: 0.6 } } as const;
