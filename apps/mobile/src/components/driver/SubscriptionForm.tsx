import { AnimatePresence, motion } from "framer-motion";
import { Bank, Buildings, CalendarCheck, CheckCircle, Copy, DeviceMobile, Hash, Hourglass, Image as ImageIcon, Receipt, Wallet } from "@phosphor-icons/react";
import { useState } from "react";
import { subscriptionReceiptSchema, type DriverDto } from "@raahi/shared";
import { AuthImage, Badge, Button, Input, Money, Segmented, useToast, type IconComponent } from "@/components/ui";
import { formatDay, SUBSCRIPTION_METHODS, type SubscriptionMethod } from "@/hooks/driver/onboarding";
import { useConfig } from "@/hooks/driver/useConfig";
import { useDriverMutation } from "@/hooks/driver/useDriver";
import { api } from "@/lib/api";
import { item, spring, springBouncy, stagger } from "@/lib/motion";
import { haptic, pickImage } from "@/lib/native";
import { cn, errorMessage } from "@/lib/utils";

interface Receipt {
  fileId: string;
  url: string;
}

/**
 * Pay-and-upload flow for the monthly driver subscription. Used by onboarding
 * step 4 and by the renewal screen. Shows the payment accounts (copyable), a
 * method picker, an optional transaction reference and the receipt screenshot.
 */
export function SubscriptionForm({ driver, onSaved, mode, onContinue, className }: { driver: DriverDto; onSaved: (d: DriverDto) => void; mode: "onboarding" | "renew"; onContinue?: () => void; className?: string }) {
  const toast = useToast();
  const { settings } = useConfig();
  const amount = settings.driverSubscriptionPkr;
  const pay = settings.paymentInstructions;

  const [method, setMethod] = useState<SubscriptionMethod>("jazzcash");
  const [ref, setRef] = useState("");
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replacing, setReplacing] = useState(false);

  const active = driver.subscriptionActive && driver.subscription?.endsAt;
  const pending = driver.subscription?.status === "pending";
  const showForm = replacing || (!active && !pending);

  const submit = useDriverMutation((body: { fileId: string; method: string; transactionRef?: string; amountPkr: number }) => api.driver.subscription(body), {
    onSuccess: (d) => {
      haptic.success();
      onSaved(d);
      setReplacing(false);
      setReceipt(null);
      setRef("");
      toast({ title: d.subscriptionActive ? "Subscription active" : "Receipt submitted", body: d.subscriptionActive ? "You're covered for the next 30 days." : "We'll confirm it shortly.", tone: "success" });
    },
    onError: (err) => {
      haptic.error();
      setError(errorMessage(err, "Couldn't submit your receipt"));
    },
  });

  const copy = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      haptic.tick();
      toast({ title: `${label} copied`, tone: "neutral" });
    } catch {
      toast({ title: "Couldn't copy", body: value, tone: "neutral" });
    }
  };

  const pick = async () => {
    setError(null);
    try {
      const blob = await pickImage("prompt");
      if (!blob) return;
      setUploading(true);
      const up = await api.files.upload(blob, "receipt", "receipt.jpg");
      setReceipt({ fileId: up.file.id, url: up.file.url });
      haptic.light();
    } catch (err) {
      setError(errorMessage(err, "Couldn't upload the screenshot"));
    } finally {
      setUploading(false);
    }
  };

  const send = () => {
    if (!receipt) {
      setError("Add a screenshot of your payment receipt");
      haptic.warning();
      return;
    }
    const parsed = subscriptionReceiptSchema.safeParse({ fileId: receipt.fileId, method, transactionRef: ref.trim() || undefined, amountPkr: amount });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the details and try again");
      haptic.warning();
      return;
    }
    setError(null);
    submit.mutate(parsed.data);
  };

  return (
    <motion.div variants={stagger(0.06)} initial="hidden" animate="show" className={cn("flex flex-col gap-4", className)}>
      {/* Current status */}
      <AnimatePresence initial={false} mode="popLayout">
        {active && driver.subscription?.endsAt ? (
          <motion.div key="active" variants={item.scale} layout className="relative overflow-hidden pillow p-4 ring-2 ring-teal-200">
            <div className="flex items-start gap-3">
              <motion.span initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ ...springBouncy, delay: 0.15 }} className="size-11 rounded-[16px] bg-teal-500 text-white flex items-center justify-center shrink-0">
                <CheckCircle className="size-6" weight="fill" />
              </motion.span>
              <div className="min-w-0 flex-1">
                <p className="font-display text-[18px] font-semibold text-ink-900">Subscription active</p>
                <p className="text-[13.5px] font-semibold text-ink-500 mt-0.5">
                  Active until <span className="text-ink-900 font-extrabold">{formatDay(driver.subscription.endsAt)}</span>
                </p>
              </div>
            </div>
            {mode === "renew" && !replacing && (
              <Button variant="outline" size="md" className="mt-3" icon={Receipt} onClick={() => setReplacing(true)}>
                Renew early
              </Button>
            )}
          </motion.div>
        ) : pending && !replacing ? (
          <motion.div key="pending" variants={item.scale} layout className="rounded-[28px] bg-sun-100 p-4">
            <div className="flex items-start gap-3">
              <span className="size-11 rounded-[16px] bg-sun-500 text-ink-900 flex items-center justify-center shrink-0">
                <Hourglass className="size-6" weight="duotone" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-display text-[18px] font-semibold text-ink-900">Receipt under review</p>
                <p className="text-[13.5px] font-semibold text-ink-600 mt-0.5 leading-snug">We're confirming your payment of <Money value={driver.subscription?.amountPkr ?? amount} className="text-ink-900" />. This usually takes a few minutes.</p>
              </div>
            </div>
            <Button variant="ghost" size="md" className="mt-2" onClick={() => setReplacing(true)}>
              Upload a different receipt
            </Button>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {showForm && (
          <motion.div key="form" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={spring} className="flex flex-col gap-4 overflow-hidden">
            {/* Amount sticker */}
            <motion.div variants={item.left} className="relative px-1 py-2">
              <span aria-hidden className="blob bg-sun-100 w-48 h-48 -right-8 -top-14 opacity-90" />
              <div className="relative sticker sticker-tilt-l bg-sun-100 p-5 overflow-hidden">
                <span aria-hidden className="absolute -right-6 -bottom-8 size-28 rounded-full bg-sun-500/25" />
                <p className="text-[12px] font-extrabold uppercase tracking-[0.16em] text-sun-600">Monthly subscription</p>
                <div className="mt-1 flex items-end gap-2">
                  <Money value={amount} className="text-[38px] text-ink-900 leading-none" />
                  <span className="text-[13px] font-bold text-ink-500 mb-1">/ {settings.subscriptionDays} days</span>
                </div>
                <p className="mt-2 text-[13.5px] font-semibold text-ink-700 leading-snug">{pay.note}</p>
                <div className="mt-3 flex items-center gap-2">
                  <Badge tone="teal">0% commission</Badge>
                  <Badge tone="coral">100% of fares yours</Badge>
                </div>
              </div>
            </motion.div>

            {/* Accounts */}
            <motion.div variants={item.right} className="pillow overflow-hidden">
              <div className="px-4 pt-3.5 pb-2 flex items-center gap-2">
                <Wallet className="size-[18px] text-teal-600" weight="duotone" />
                <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink-400">Send to</p>
                <span className="ml-auto text-[12.5px] font-bold text-ink-500 truncate">{pay.accountTitle}</span>
              </div>
              <AccountRow icon={DeviceMobile} label="JazzCash" value={pay.jazzcash} onCopy={copy} highlighted={method === "jazzcash"} />
              <AccountRow icon={DeviceMobile} label="EasyPaisa" value={pay.easypaisa} onCopy={copy} highlighted={method === "easypaisa"} />
              <AccountRow icon={Buildings} label={pay.bankName} value={pay.bankAccount} onCopy={copy} highlighted={method === "bank"} />
              <AccountRow icon={Bank} label="IBAN" value={pay.iban} onCopy={copy} highlighted={method === "bank"} last />
            </motion.div>

            {/* Method */}
            <motion.div variants={item.up} className="flex flex-col gap-1.5">
              <p className="text-[13.5px] font-extrabold text-ink-600 tracking-wide pl-1">I paid with</p>
              <Segmented tone="teal" value={method} onChange={setMethod} options={SUBSCRIPTION_METHODS.map((m) => ({ value: m.value, label: m.label }))} />
            </motion.div>

            <motion.div variants={item.up}>
              <Input label="Transaction ID (optional)" icon={Hash} placeholder="e.g. 0123456789" value={ref} maxLength={60} autoCapitalize="characters" onChange={(e) => setRef(e.target.value)} hint="From the SMS or app receipt. Helps us match your payment faster." />
            </motion.div>

            {/* Receipt */}
            <motion.div variants={item.up} className="flex flex-col gap-1.5">
              <p className="text-[13.5px] font-extrabold text-ink-600 tracking-wide pl-1">Receipt screenshot</p>
              <motion.button
                type="button"
                whileTap={{ scale: 0.98 }}
                transition={spring}
                disabled={uploading || submit.isPending}
                onClick={() => void pick()}
                className={cn("relative w-full overflow-hidden rounded-[28px] text-left", receipt ? "aspect-[16/9] bg-white shadow-pillow ring-2 ring-teal-300" : "h-32 border-2 border-dashed border-paper-300 bg-paper-100", error && !receipt && "border-rose-400")}
              >
                {receipt ? (
                  <>
                    <AuthImage src={receipt.url} alt="Payment receipt" className="absolute inset-0 w-full h-full" />
                    <div className="absolute inset-0 bg-gradient-to-t from-ink-900/70 to-transparent" />
                    <div className="absolute left-3 bottom-3 flex items-center gap-2">
                      <Badge tone="mint">
                        <CheckCircle className="size-3" weight="fill" /> Attached
                      </Badge>
                      <span className="text-[12.5px] font-bold text-white">Tap to replace</span>
                    </div>
                  </>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center gap-3 px-4">
                    <span className="size-12 rounded-[18px] bg-teal-100 text-teal-600 flex items-center justify-center shrink-0">
                      <ImageIcon className="size-6" weight="duotone" />
                    </span>
                    <div>
                      <p className="text-[15px] font-extrabold text-ink-900">Add screenshot</p>
                      <p className="text-[12.5px] font-semibold text-ink-500 leading-snug">Camera or gallery · must show the amount and date</p>
                    </div>
                  </div>
                )}
                <AnimatePresence>
                  {uploading && (
                    <motion.div key="up" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-paper-50/85 backdrop-blur-[2px] flex items-center justify-center gap-2 text-[13px] font-extrabold text-ink-900">
                      <motion.span className="size-5 rounded-full border-2 border-teal-200 border-t-teal-500" animate={{ rotate: 360 }} transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }} />
                      Uploading…
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.button>
            </motion.div>

            <AnimatePresence initial={false}>
              {error && (
                <motion.p key="err" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-[13px] font-bold text-rose-600 text-center">
                  {error}
                </motion.p>
              )}
            </AnimatePresence>

            <motion.div variants={item.up} className="flex flex-col gap-2">
              <Button full size="xl" variant="teal" icon={CalendarCheck} loading={submit.isPending} disabled={uploading} onClick={send}>
                {mode === "renew" ? "Submit renewal receipt" : "Submit receipt"}
              </Button>
              {replacing && (
                <Button full variant="ghost" disabled={submit.isPending} onClick={() => setReplacing(false)}>
                  Keep current subscription
                </Button>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {!showForm && onContinue && (
        <motion.div variants={item.up}>
          <Button full size="xl" variant="teal" className="breathe" onClick={onContinue}>
            Continue
          </Button>
        </motion.div>
      )}
    </motion.div>
  );
}

function AccountRow({ icon: Icon, label, value, onCopy, highlighted, last }: { icon: IconComponent; label: string; value: string; onCopy: (label: string, value: string) => void; highlighted?: boolean; last?: boolean }) {
  return (
    <motion.button type="button" whileTap={{ scale: 0.985 }} transition={spring} onClick={() => onCopy(label, value)} className={cn("w-full flex items-center gap-3 px-4 py-3 text-left transition-colors", !last && "border-b border-paper-200", highlighted ? "bg-teal-100/60" : "hover:bg-paper-100")}>
      <span className={cn("size-10 rounded-[14px] flex items-center justify-center shrink-0", highlighted ? "bg-teal-500 text-white" : "bg-paper-100 text-ink-500")}>
        <Icon className="size-[20px]" weight="duotone" />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-[12px] font-bold text-ink-400">{label}</span>
        <span className="block text-[15px] font-extrabold text-ink-900 tabular-nums tracking-wide truncate">{value}</span>
      </span>
      <Copy className="size-[18px] text-ink-300 shrink-0" weight="duotone" />
    </motion.button>
  );
}
