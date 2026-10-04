import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button, Sheet, useToast } from "@/components/ui";
import { item, stagger } from "@/lib/motion";
import { errorMessage } from "@/lib/utils";
import { cn } from "@/lib/utils";

/**
 * Two-button confirmation bottom sheet. `onConfirm` may return a promise; the
 * confirm button shows a spinner until it settles and errors surface as toasts.
 */
export function ConfirmSheet({
  open,
  onClose,
  title,
  body,
  icon: Icon,
  confirmLabel = "Confirm",
  cancelLabel = "Not now",
  tone = "danger",
  onConfirm,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  body?: ReactNode;
  icon?: LucideIcon;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "primary" | "amber";
  onConfirm: () => Promise<void> | void;
  children?: ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const confirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
    } catch (err) {
      toast({ title: "That didn't work", body: errorMessage(err), tone: "error" });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open={open} onClose={busy ? () => {} : onClose} title={title} dismissible={!busy}>
      <motion.div variants={stagger(0.06)} initial="hidden" animate="show" className="flex flex-col gap-4 pb-2">
        {Icon && (
          <motion.div variants={item.scale} className="self-start">
            <span className={cn("size-12 rounded-2xl flex items-center justify-center", tone === "danger" ? "bg-rose-500/12 text-rose-400" : tone === "amber" ? "bg-amber-400/12 text-amber-300" : "bg-brand-500/12 text-brand-400")}>
              <Icon className="size-6" />
            </span>
          </motion.div>
        )}
        {body && (
          <motion.div variants={item.up} className="text-[15px] text-ink-300 leading-relaxed">
            {body}
          </motion.div>
        )}
        {children && <motion.div variants={item.up}>{children}</motion.div>}
        <motion.div variants={item.up} className="flex flex-col gap-2 pt-1">
          <Button variant={tone === "danger" ? "danger" : tone === "amber" ? "amber" : "primary"} loading={busy} onClick={confirm} full>
            {confirmLabel}
          </Button>
          <Button variant="ghost" disabled={busy} onClick={onClose} full>
            {cancelLabel}
          </Button>
        </motion.div>
      </motion.div>
    </Sheet>
  );
}
