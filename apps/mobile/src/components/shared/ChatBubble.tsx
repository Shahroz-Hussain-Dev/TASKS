import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { springSoft } from "@/lib/motion";
import { cn } from "@/lib/utils";

export type BubbleSide = "left" | "right";
export type BubbleTone = "brand" | "glass" | "violet" | "muted";

/**
 * One chat message. Mine sit right in brand green, theirs left in glass;
 * admin/support replies use violet. `grouped` tightens corners between
 * consecutive messages from the same sender.
 */
export function ChatBubble({
  side,
  tone = side === "right" ? "brand" : "glass",
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
  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, y: 14, x: mine ? 18 : -18, scale: 0.96 }}
      animate={{ opacity: pending ? 0.7 : 1, y: 0, x: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={springSoft}
      className={cn("flex flex-col max-w-[82%]", mine ? "self-end items-end" : "self-start items-start", grouped ? "mt-1" : "mt-3", className)}
    >
      {label && !grouped && <span className="text-[11.5px] font-semibold text-ink-400 mb-1 px-1">{label}</span>}
      <div
        className={cn(
          "px-3.5 py-2.5 text-[15px] leading-snug whitespace-pre-wrap break-words shadow-card select-text",
          "rounded-[20px]",
          mine ? (grouped ? "rounded-tr-lg" : "rounded-br-lg") : grouped ? "rounded-tl-lg" : "rounded-bl-lg",
          tone === "brand" && "bg-brand-500 text-ink-950",
          tone === "glass" && "glass text-ink-50",
          tone === "violet" && "bg-violet-400/15 border border-violet-400/25 text-ink-50",
          tone === "muted" && "bg-white/5 text-ink-200",
          failed && "ring-1 ring-rose-500/60",
        )}
      >
        {children}
      </div>
      {meta && <span className={cn("text-[11px] mt-1 px-1", failed ? "text-rose-400" : "text-ink-500")}>{meta}</span>}
    </motion.div>
  );
}
