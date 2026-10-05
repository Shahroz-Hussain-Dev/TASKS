import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

/** Three bouncing dots — "someone is typing". */
export function TypingDots({ className, color = "bg-coral-400" }: { className?: string; color?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 h-5", className)} aria-label="Typing">
      {[0, 1, 2].map((i) => (
        <motion.span key={i} className={cn("size-2 rounded-full", color)} animate={{ y: [0, -5, 0], opacity: [0.45, 1, 0.45] }} transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }} />
      ))}
    </span>
  );
}
