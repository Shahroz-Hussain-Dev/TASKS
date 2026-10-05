import type { Transition, Variants } from "framer-motion";

export const spring: Transition = { type: "spring", stiffness: 420, damping: 38, mass: 0.9 };
export const springSoft: Transition = { type: "spring", stiffness: 260, damping: 30, mass: 1 };
export const springBouncy: Transition = { type: "spring", stiffness: 520, damping: 26, mass: 0.8 };

type Dir = "up" | "down" | "left" | "right" | "scale" | "fade";

const offset = (dir: Dir, d = 24) => {
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
      return { scale: 0.94 };
    default:
      return {};
  }
};

export const fromDir = (dir: Dir = "up", distance = 24, delay = 0): Variants => ({
  hidden: { opacity: 0, ...offset(dir, distance) },
  show: { opacity: 1, x: 0, y: 0, scale: 1, transition: { ...spring, delay } },
  exit: { opacity: 0, ...offset(dir, distance / 2), transition: { duration: 0.16 } },
});

export const stagger = (staggerChildren = 0.06, delayChildren = 0.04): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren, delayChildren } },
  exit: { transition: { staggerChildren: 0.02, staggerDirection: -1 } },
});

export const item = {
  up: fromDir("up"),
  down: fromDir("down"),
  left: fromDir("left", 32),
  right: fromDir("right", 32),
  scale: fromDir("scale"),
  fade: fromDir("fade"),
} satisfies Record<Dir, Variants>;
