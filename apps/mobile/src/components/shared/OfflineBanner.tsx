import { AnimatePresence, motion } from "framer-motion";
import { WifiSlash } from "@phosphor-icons/react";
import { useOnline } from "@/hooks/useOnline";
import { spring } from "@/lib/motion";
import { cn } from "@/lib/utils";

/** Slim banner that slides in from the top while the device is offline. */
export function OfflineBanner({ className, inline = false }: { className?: string; inline?: boolean }) {
  const online = useOnline();
  return (
    <AnimatePresence>
      {!online && (
        <motion.div
          initial={{ opacity: 0, y: -16, height: inline ? 0 : undefined }}
          animate={{ opacity: 1, y: 0, height: inline ? "auto" : undefined }}
          exit={{ opacity: 0, y: -12, height: inline ? 0 : undefined }}
          transition={spring}
          className={cn(inline ? "overflow-hidden" : "fixed inset-x-0 z-30 px-4 pointer-events-none", className)}
          style={inline ? undefined : { top: "calc(var(--safe-top) + 8px)" }}
        >
          <div className="mx-auto max-w-sm bg-white rounded-[20px] px-3.5 py-2.5 flex items-center gap-2.5 text-[13px] font-bold text-ink-700 border-l-[6px] border-l-sun-500 shadow-float">
            <WifiSlash className="size-[18px] text-sun-600 shrink-0" weight="duotone" />
            <span>You're offline. Showing what we have saved.</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
