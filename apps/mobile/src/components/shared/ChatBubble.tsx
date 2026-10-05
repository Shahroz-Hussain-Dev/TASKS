import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { springSoft } from "@/lib/motion";
import { cn } from "@/lib/utils";

export type BubbleSide = "left" | "right";
/** `brand`/`coral` = my messages (coral jelly), `glass`/`white` = theirs (white pillow), `violet`/`lavender` = Raahi team, `muted` = cream. */
export type BubbleTone = "brand" | "coral" | "glass" | "white" | "violet" | "lavender" | "muted" | "teal";

/**
 * One chat message. Mine sit right as coral jelly bubbles with a chunky edge,
 * theirs left as white pillows; support team replies use lavender. `grouped`
 * tightens corners between consecutive messages from the same sender.
 */
export function ChatBubble({
  side,
  tone = side === "right" ? "coral" : "white",
  children,
  meta,
  label,
  grouped,
  pending,
  failed,
  className,
}: {
  side: BubbleSide;
  tone?: BubbleTone;
  children: ReactNode;
  /** Small caption under the bubble (time, "Sending…"). */
  meta?: ReactNode;
  /** Small caption above the bubble (sender name). */
  label?: ReactNode;
  grouped?: boolean;
  pending?: boolean;
  failed?: boolean;
  className?: string;
}) {
  const mine = side === "right";
  const toneCls = {
    brand: "bg-coral-500 text-white shadow-[0_4px_0_0_#f2552f]",
    coral: "bg-coral-500 text-white shadow-[0_4px_0_0_#f2552f]",
    teal: "bg-teal-500 text-white shadow-[0_4px_0_0_#0e8a7b]",
    glass: "bg-white text-ink-800 shadow-pillow",
    white: "bg-white text-ink-800 shadow-pillow",
    violet: "bg-lavender-100 text-ink-800 shadow-[0_4px_0_0_#d8d2ff]",
    lavender: "bg-lavender-100 text-ink-800 shadow-[0_4px_0_0_#d8d2ff]",
    muted: "bg-paper-100 text-ink-700 shadow-[0_3px_0_0_#f6e9d8]",
  }[tone];
  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, y: 14, x: mine ? 18 : -18, scale: 0.94 }}
      animate={{ opacity: pending ? 0.7 : 1, y: 0, x: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={springSoft}
      className={cn("flex flex-col max-w-[82%]", mine ? "self-end items-end" : "self-start items-start", grouped ? "mt-1.5" : "mt-3.5", className)}
    >
      {label && !grouped && <span className="text-[11.5px] font-extrabold text-ink-400 mb-1 px-1.5">{label}</span>}
      <div
        className={cn(
          "px-4 py-2.5 text-[15px] leading-snug whitespace-pre-wrap break-words select-text font-semibold",
          "rounded-[22px]",
          mine ? (grouped ? "rounded-tr-[10px]" : "rounded-br-[10px]") : grouped ? "rounded-tl-[10px]" : "rounded-bl-[10px]",
          toneCls,
          failed && "ring-2 ring-rose-400 ring-offset-2 ring-offset-paper-50",
        )}
      >
        {children}
      </div>
      {meta && <span className={cn("text-[11px] mt-1.5 px-1.5 font-bold", failed ? "text-rose-500" : "text-ink-400")}>{meta}</span>}
    </motion.div>
  );
}
