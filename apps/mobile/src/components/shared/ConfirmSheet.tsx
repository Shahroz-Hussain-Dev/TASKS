import { motion } from "framer-motion";
import { useState, type ReactNode } from "react";
import { Button, Sheet, useToast, type IconComponent } from "@/components/ui";
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
  icon?: IconComponent;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "primary" | "amber" | "teal";
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
  const iconTint = { danger: "bg-rose-100 text-rose-500", amber: "bg-sun-100 text-sun-600", primary: "bg-coral-100 text-coral-500", teal: "bg-teal-100 text-teal-500" }[tone];
  const variant = tone === "danger" ? "danger" : tone === "amber" ? "amber" : tone === "teal" ? "teal" : "primary";
  return (
    <Sheet open={open} onClose={busy ? () => {} : onClose} title={title} dismissible={!busy}>
      <motion.div variants={stagger(0.06)} initial="hidden" animate="show" className="flex flex-col gap-4 pb-2">
        {Icon && (
          <motion.div variants={item.pop} className="self-start relative">
            <span className={cn("blob absolute -inset-2 -z-10 opacity-70", iconTint.split(" ")[0])} />
            <span className={cn("relative size-14 rounded-[20px] flex items-center justify-center sticker", iconTint)}>
              <Icon className="size-7" weight="duotone" />
            </span>
          </motion.div>
        )}
        {body && (
          <motion.div variants={item.up} className="text-[15px] text-ink-600 leading-relaxed font-medium">
            {body}
          </motion.div>
        )}
        {children && <motion.div variants={item.up}>{children}</motion.div>}
        <motion.div variants={item.up} className="flex flex-col gap-2.5 pt-1">
          <Button variant={variant} loading={busy} onClick={confirm} full>
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
