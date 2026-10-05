import { AnimatePresence, motion } from "framer-motion";
import { Check, Warning } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { CANCEL_REASONS_CUSTOMER, CANCEL_REASONS_DRIVER, rideCancelSchema } from "@raahi/shared";
import { Button, Sheet, TextArea, useToast } from "@/components/ui";
import { item, spring, stagger } from "@/lib/motion";
import { haptic } from "@/lib/native";
import { cn, errorMessage } from "@/lib/utils";

export interface CancelSheetProps {
  open: boolean;
  onClose: () => void;
  /** Which reason list to show. */
  perspective: "customer" | "driver";
  /** Resolve with the chosen reason (+ optional details). Return a promise so the sheet can show a spinner. */
  onConfirm: (reason: string, details?: string) => Promise<void>;
  title?: string;
}

/**
 * Cancellation reasons as a single-select list of tinted chips-rows; "Other"
 * reveals a details box. The confirm button spins until the caller's promise settles.
 */
export default function CancelSheet({ open, onClose, perspective, onConfirm, title }: CancelSheetProps) {
  const reasons = perspective === "customer" ? CANCEL_REASONS_CUSTOMER : CANCEL_REASONS_DRIVER;
  const [reason, setReason] = useState<string | null>(null);
  const [details, setDetails] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const accent = perspective === "driver" ? "teal" : "coral";

  useEffect(() => {
    if (!open) return;
    setReason(null);
    setDetails("");
    setError(null);
    setBusy(false);
  }, [open]);

  const confirm = async () => {
    if (!reason) {
      setError("Pick a reason so we can improve the experience");
      haptic.warning();
      return;
    }
    const parsed = rideCancelSchema.safeParse({ reason, details: details.trim() || undefined });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the details and try again");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await onConfirm(parsed.data.reason, parsed.data.details);
      haptic.success();
    } catch (err) {
      haptic.error();
      toast({ title: "Couldn't cancel", body: errorMessage(err), tone: "error" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={busy ? () => {} : onClose} title={title ?? "Cancel this ride?"} dismissible={!busy}>
      <motion.div variants={stagger(0.05)} initial="hidden" animate="show" className="flex flex-col gap-4 pb-2">
        <motion.div variants={item.down} className="flex items-start gap-3 rounded-[20px] bg-sun-100 px-3.5 py-3 shadow-[0_3px_0_0_#ffe49a]">
          <Warning className="size-[22px] text-sun-600 shrink-0 mt-0.5" weight="duotone" />
          <p className="text-[13.5px] text-ink-700 leading-snug font-semibold">
            {perspective === "customer" ? "Your driver may already be on the way. Frequent cancellations lower your rating." : "Cancelling after accepting affects your acceptance rate and rating."}
          </p>
        </motion.div>

        <motion.ul variants={item.up} className="flex flex-col gap-2" role="radiogroup" aria-label="Reason">
          {reasons.map((r) => {
            const active = r === reason;
            return (
              <motion.li key={r} layout transition={spring}>
                <motion.button
                  type="button"
                  role="radio"
                  aria-checked={active}
                  whileTap={{ scale: 0.98 }}
                  transition={spring}
                  onClick={() => {
                    haptic.tick();
                    setReason(r);
                    setError(null);
                  }}
                  className={cn(
                    "w-full flex items-center gap-3 rounded-[20px] px-3.5 py-3 text-left transition-colors border-2",
                    active ? (accent === "teal" ? "bg-teal-100 border-teal-400" : "bg-coral-100 border-coral-400") : "bg-white border-transparent shadow-pillow",
                  )}
                >
                  <span className={cn("size-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors", active ? (accent === "teal" ? "border-teal-500 bg-teal-500" : "border-coral-500 bg-coral-500") : "border-paper-300 bg-paper-50")}>
                    <AnimatePresence>
                      {active && (
                        <motion.span key="c" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={spring}>
                          <Check className="size-3.5 text-white" weight="bold" />
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </span>
                  <span className={cn("text-[15px] font-bold", active ? "text-ink-900" : "text-ink-700")}>{r}</span>
                </motion.button>
              </motion.li>
            );
          })}
        </motion.ul>

        <AnimatePresence initial={false}>
          {reason === "Other" && (
            <motion.div key="details" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={spring} className="overflow-hidden">
              <TextArea label="Tell us more" placeholder="A short note helps our team understand what happened" value={details} maxLength={200} onChange={(e) => setDetails(e.target.value)} className="min-h-20" />
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div variants={item.up} className="flex flex-col gap-2 pt-1">
          <AnimatePresence initial={false}>
            {error && (
              <motion.p key="err" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-[13px] text-rose-500 text-center font-bold">
                {error}
              </motion.p>
            )}
          </AnimatePresence>
          <Button full size="xl" variant="danger" loading={busy} onClick={confirm}>
            {perspective === "customer" ? "Cancel ride" : "Cancel this trip"}
          </Button>
          <Button full variant="ghost" disabled={busy} onClick={onClose}>
            {perspective === "customer" ? "Keep my ride" : "Keep the trip"}
          </Button>
        </motion.div>
      </motion.div>
    </Sheet>
  );
}
