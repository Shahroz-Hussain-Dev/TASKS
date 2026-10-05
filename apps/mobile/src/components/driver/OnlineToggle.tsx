import { AnimatePresence, motion } from "framer-motion";
import { CircleNotch, Power } from "@phosphor-icons/react";
import { spring, springSoft } from "@/lib/motion";
import { haptic } from "@/lib/native";
import { cn } from "@/lib/utils";

/**
 * The driver's main control. Offline it is a wide teal jelly "Go online" pill
 * that breathes; online it morphs into a white pill with a pulsing teal dot.
 * The width, colour and content morph in one layout animation.
 */
export function OnlineToggle({ online, busy, onToggle, nearby = 0, className }: { online: boolean; busy: boolean; onToggle: () => void; nearby?: number; className?: string }) {
  return (
    <motion.button
      type="button"
      layout
      disabled={busy}
      whileTap={{ scale: 0.96, y: 3 }}
      transition={springSoft}
      aria-pressed={online}
      onClick={() => {
        haptic.medium();
        onToggle();
      }}
      className={cn(
        "relative h-14 rounded-full flex items-center justify-center gap-2.5 px-6 font-display font-semibold text-[16px] select-none overflow-hidden jelly",
        online ? "jelly-white text-ink-900 min-w-56" : "jelly-teal min-w-64",
        !online && !busy && "breathe",
        busy && "opacity-80",
        className,
      )}
    >
      {!online && !busy && <motion.span aria-hidden className="absolute inset-0 rounded-full bg-teal-300/40" animate={{ scale: [1, 1.25], opacity: [0.5, 0] }} transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut" }} />}
      <AnimatePresence mode="popLayout" initial={false}>
        {busy ? (
          <motion.span key="busy" layout initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.7 }} transition={spring} className="relative inline-flex items-center gap-2">
            <CircleNotch className="size-5 animate-spin" weight="bold" />
            <span>{online ? "Going offline…" : "Going online…"}</span>
          </motion.span>
        ) : online ? (
          <motion.span key="on" layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={spring} className="relative inline-flex items-center gap-2.5">
            <span className="relative flex size-3">
              <span className="absolute inset-0 rounded-full bg-teal-400 radar-ring" />
              <span className="relative size-3 rounded-full bg-teal-500" />
            </span>
            <span>You're online</span>
            <span className="text-[12.5px] font-sans font-bold text-ink-400">· {nearby > 0 ? `${nearby} nearby` : "tap to stop"}</span>
          </motion.span>
        ) : (
          <motion.span key="off" layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={spring} className="relative inline-flex items-center gap-2.5">
            <Power className="size-5" weight="bold" />
            <span>Go online</span>
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}
