import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { markHintShown, useAssistantSettings, wasHintShown } from "@/lib/assistant/settings";
import { springBouncy, springJelly } from "@/lib/motion";
import { haptic } from "@/lib/native";
import { cn } from "@/lib/utils";
import { AssistantSheet } from "./AssistantSheet";
import { Buddy } from "./Buddy";

const HINT_MS = 5000;

/**
 * The floating coral jelly circle with a mini Buddy, bottom-right above the
 * tab bar. Owns the Assistant sheet; shows a one-time speech-bubble hint.
 * Tapping Buddy opens the sheet and he speaks first, then listens.
 */
export function BuddyBubble({ className, hint = "Say where you want to go" }: { className?: string; hint?: string }) {
  const { settings, ready } = useAssistantSettings();
  const [open, setOpen] = useState(false);
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    if (!ready || !settings.showBuddy) return;
    let cancelled = false;
    let timer: number | undefined;
    wasHintShown()
      .then((shown) => {
        if (cancelled || shown) return;
        setShowHint(true);
        void markHintShown();
        timer = window.setTimeout(() => setShowHint(false), HINT_MS);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [ready, settings.showBuddy]);

  if (typeof document === "undefined") return null;
  const visible = ready && settings.showBuddy;

  return createPortal(
    <>
      <AnimatePresence>
        {visible && (
          <motion.div
            key="buddy-bubble"
            initial={{ scale: 0.4, opacity: 0, y: 24 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.4, opacity: 0, y: 24 }}
            transition={springBouncy}
            className={cn("fixed z-30 flex items-end gap-2", className)}
            style={{ right: 18, bottom: "calc(var(--safe-bottom) + 96px)" }}
          >
            <AnimatePresence>
              {showHint && !open && (
                <motion.div
                  key="hint"
                  initial={{ opacity: 0, scale: 0.6, x: 16, y: 8 }}
                  animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
                  exit={{ opacity: 0, scale: 0.8, x: 12 }}
                  transition={springBouncy}
                  style={{ transformOrigin: "100% 100%" }}
                  className="relative mb-3 max-w-[210px] rounded-[20px] rounded-br-md bg-white px-4 py-2.5 shadow-pillow"
                  onClick={() => setShowHint(false)}
                >
                  <p className="font-display text-[15px] font-semibold leading-snug text-ink-900">{hint}</p>
                  <span className="absolute -right-1.5 bottom-2 size-4 rotate-45 rounded-sm bg-white" aria-hidden />
                </motion.div>
              )}
            </AnimatePresence>
            <motion.button
              type="button"
              aria-label="Talk to Buddy"
              whileTap={{ scale: 0.92, y: 3 }}
              transition={springJelly}
              onClick={() => {
                haptic.medium();
                setShowHint(false);
                setOpen(true);
              }}
              className="jelly jelly-coral relative flex size-16 items-center justify-center rounded-full shadow-glow"
            >
              <span className="absolute inset-0 rounded-full bg-white/10" aria-hidden />
              <span className="pointer-events-none relative -translate-y-[1px]">
                <Buddy size={56} state="idle" />
              </span>
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
      <AssistantSheet open={open && visible} autoVoice onClose={() => setOpen(false)} />
    </>,
    document.body,
  );
}
