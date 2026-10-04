import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Check } from "lucide-react";
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
 * Cancellation reasons as a single-select list; "Other" reveals a details
 * box. The confirm button spins until the caller's promise settles.
 */
export default function CancelSheet({ open, onClose, perspective, onConfirm, title }: CancelSheetProps) {
  const reasons = perspective === "customer" ? CANCEL_REASONS_CUSTOMER : CANCEL_REASONS_DRIVER;
  const [reason, setReason] = useState<string | null>(null);
  const [details, setDetails] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

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
        <motion.div variants={item.down} className="flex items-start gap-3 rounded-2xl bg-amber-400/8 border border-amber-400/15 px-3.5 py-3">
          <AlertTriangle className="size-5 text-amber-300 shrink-0 mt-0.5" />
          <p className="text-[13.5px] text-ink-200 leading-snug">
            {perspective === "customer" ? "Your driver may already be on the way. Frequent cancellations lower your rating." : "Cancelling after accepting affects your acceptance rate and rating."}
          </p>
        </motion.div>

        <motion.ul variants={item.up} className="flex flex-col gap-1.5" role="radiogroup" aria-label="Reason">
          {reasons.map((r) => {
            const active = r === reason;
            return (
              <motion.li key={r} layout transition={spring}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => {
                    haptic.tick();
                    setReason(r);
                    setError(null);
                  }}
                  className={cn("w-full flex items-center gap-3 rounded-2xl px-3.5 py-3 text-left border transition-colors", active ? "bg-brand-500/10 border-brand-500/50" : "bg-white/3 border-white/6 hover:bg-white/5")}
                >
                  <span className={cn("size-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors", active ? "border-brand-400 bg-brand-500" : "border-ink-500")}>
                    <AnimatePresence>{active && <motion.span key="c" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={spring}><Check className="size-3 text-ink-950" strokeWidth={3} /></motion.span>}</AnimatePresence>
                  </span>
                  <span className={cn("text-[15px] font-medium", active ? "text-ink-50" : "text-ink-200")}>{r}</span>
                </button>
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
              <motion.p key="err" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-[13px] text-rose-400 text-center">
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
