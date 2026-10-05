import { AnimatePresence, motion } from "framer-motion";
import { Car, Check, ClipboardText, IdentificationCard, PaperPlaneTilt, PencilSimple, Receipt } from "@phosphor-icons/react";
import { useState, type ReactNode } from "react";
import { DOCUMENT_META, DOCUMENT_TYPES, formatCnic, formatPkPhone, VEHICLE_CATEGORY_META, type DriverDto, type UserDto } from "@raahi/shared";
import { Breathe } from "@/components/driver/Breathe";
import { Badge, Button, useToast, type IconComponent } from "@/components/ui";
import { DOC_STATUS_META, docFor, documentProgress, formatDay, SUBSCRIPTION_STATUS_META, type WizardStep } from "@/hooks/driver/onboarding";
import { useDriverMutation } from "@/hooks/driver/useDriver";
import { api } from "@/lib/api";
import { item, spring, stagger } from "@/lib/motion";
import { haptic } from "@/lib/native";
import { cn, errorMessage } from "@/lib/utils";

/** Step 5 — everything at a glance, a confirmation toggle, then submit for approval. */
export function ReviewStep({ driver, user, onEdit, onSubmitted }: { driver: DriverDto; user: UserDto; onEdit: (step: WizardStep) => void; onSubmitted: (d: DriverDto) => void }) {
  const toast = useToast();
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const docs = documentProgress(driver);
  const v = driver.vehicle;
  const sub = driver.subscription;

  const submit = useDriverMutation(() => api.driver.submit(), {
    onSuccess: (d) => {
      haptic.success();
      onSubmitted(d);
    },
    onError: (err) => {
      haptic.error();
      setError(errorMessage(err, "Couldn't submit your application"));
      toast({ title: "Couldn't submit", body: errorMessage(err), tone: "error" });
    },
  });

  const blockers: string[] = [];
  if (!driver.onboarding.details) blockers.push("personal details");
  if (!driver.onboarding.vehicle) blockers.push("vehicle");
  if (!docs.ready) blockers.push("documents");
  if (!driver.onboarding.subscription && !driver.subscriptionActive) blockers.push("subscription");
  const canSubmit = blockers.length === 0 && confirmed;

  return (
    <motion.div variants={stagger(0.06)} initial="hidden" animate="show" className="flex flex-col gap-3.5 pb-4">
      <SummaryCard variants={item.left} icon={IdentificationCard} tone="teal" title="Personal details" done={driver.onboarding.details} onEdit={() => onEdit("details")}>
        <Line label="Name" value={user.fullName} />
        <Line label="Phone" value={user.phone ? formatPkPhone(user.phone) : "—"} />
        <Line label="CNIC" value={driver.cnic ? formatCnic(driver.cnic) : "—"} />
        <Line label="City" value={driver.city ?? "—"} />
        <Line label="License" value={driver.licenseNumber ? `${driver.licenseNumber}${driver.licenseExpiry ? ` · exp ${formatDay(driver.licenseExpiry)}` : ""}` : "—"} />
      </SummaryCard>

      <SummaryCard variants={item.right} icon={Car} tone="coral" title="Vehicle" done={driver.onboarding.vehicle} onEdit={() => onEdit("vehicle")}>
        {v ? (
          <>
            <Line label="Model" value={`${v.make} ${v.model} · ${v.year}`} />
            <Line label="Service" value={VEHICLE_CATEGORY_META[v.category].label} />
            <Line label="Plate" value={v.plate} />
            <Line label="Colour" value={v.color} />
            <Line label="Economy" value={`${v.kmPerLitre} km/L${v.isCustom ? " · custom" : ""}`} />
          </>
        ) : (
          <p className="text-[13.5px] font-semibold text-ink-500">Not added yet.</p>
        )}
      </SummaryCard>

      <SummaryCard variants={item.left} icon={ClipboardText} tone="lavender" title="Documents" done={docs.ready} onEdit={() => onEdit("documents")} badge={`${docs.uploaded}/${docs.required}`}>
        <ul className="flex flex-col gap-1.5">
          {DOCUMENT_TYPES.map((t) => {
            const d = docFor(driver, t);
            const meta = d ? DOC_STATUS_META[d.status] : null;
            return (
              <li key={t} className="flex items-center justify-between gap-3 text-[13.5px]">
                <span className="font-semibold text-ink-600 truncate">{DOCUMENT_META[t].label}</span>
                {meta ? <Badge tone={meta.tone}>{meta.label}</Badge> : <Badge tone="rose">Missing</Badge>}
              </li>
            );
          })}
        </ul>
      </SummaryCard>

      <SummaryCard variants={item.right} icon={Receipt} tone="sun" title="Subscription" done={driver.subscriptionActive || driver.onboarding.subscription} onEdit={() => onEdit("subscription")}>
        {sub ? (
          <>
            <div className="flex items-center justify-between">
              <span className="text-[13.5px] font-semibold text-ink-600">Status</span>
              <Badge tone={SUBSCRIPTION_STATUS_META[sub.status].tone}>{SUBSCRIPTION_STATUS_META[sub.status].label}</Badge>
            </div>
            <Line label="Amount" value={`PKR ${sub.amountPkr.toLocaleString("en-PK")} · ${sub.method}`} />
            {sub.endsAt && <Line label="Valid until" value={formatDay(sub.endsAt)} />}
          </>
        ) : (
          <p className="text-[13.5px] font-semibold text-ink-500">No receipt uploaded yet.</p>
        )}
      </SummaryCard>

      {/* Confirmation */}
      <motion.button
        variants={item.up}
        type="button"
        whileTap={{ scale: 0.985 }}
        transition={spring}
        onClick={() => {
          haptic.tick();
          setConfirmed((c) => !c);
          setError(null);
        }}
        className={cn("flex items-start gap-3 rounded-[22px] px-3.5 py-3 text-left transition-colors", confirmed ? "bg-teal-100" : "bg-paper-100")}
        role="checkbox"
        aria-checked={confirmed}
      >
        <span className={cn("mt-0.5 size-6 rounded-lg border-[2.5px] flex items-center justify-center shrink-0 transition-colors", confirmed ? "border-teal-500 bg-teal-500 text-white" : "border-paper-300 bg-white")}>
          <AnimatePresence>{confirmed && <motion.span key="c" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={spring}><Check className="size-3.5" weight="bold" /></motion.span>}</AnimatePresence>
        </span>
        <span className="text-[13.5px] font-semibold text-ink-700 leading-snug">I confirm these documents are mine and accurate, and I agree to Raahi's driver terms and community guidelines.</span>
      </motion.button>

      <AnimatePresence initial={false}>
        {(blockers.length > 0 || error) && (
          <motion.p key="blk" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-[13px] font-bold text-sun-600 text-center px-2 leading-snug">
            {error ?? `Finish your ${blockers.join(", ")} to submit.`}
          </motion.p>
        )}
      </AnimatePresence>

      <motion.div variants={item.up} className="pt-1">
        <Breathe active={canSubmit}>
          <Button full size="xl" variant="teal" icon={PaperPlaneTilt} disabled={!canSubmit} loading={submit.isPending} onClick={() => submit.mutate(undefined)}>
            Submit for approval
          </Button>
        </Breathe>
        <p className="mt-2 text-center text-[12px] font-semibold text-ink-400">Most drivers are approved within 24 hours. We'll notify you.</p>
      </motion.div>
    </motion.div>
  );
}

const CARD_TINT = {
  teal: "bg-teal-100 text-teal-600",
  coral: "bg-coral-100 text-coral-500",
  lavender: "bg-lavender-100 text-lavender-500",
  sun: "bg-sun-100 text-sun-600",
} as const;

function SummaryCard({ icon: Icon, title, done, onEdit, badge, children, variants, tone }: { icon: IconComponent; title: string; done: boolean; onEdit: () => void; badge?: string; children: ReactNode; variants: typeof item.left; tone: keyof typeof CARD_TINT }) {
  return (
    <motion.section variants={variants} className="pillow p-4">
      <div className="flex items-center gap-3 mb-3">
        <span className={cn("size-10 rounded-[14px] flex items-center justify-center", CARD_TINT[tone])}>
          <Icon className="size-[22px]" weight="duotone" />
        </span>
        <h3 className="flex-1 font-display text-[17px] font-semibold text-ink-900">{title}</h3>
        {badge && <span className="text-[12px] font-bold text-ink-400 tabular-nums">{badge}</span>}
        {done ? <Badge tone="mint">Done</Badge> : <Badge tone="sun">To do</Badge>}
        <Button variant="ghost" size="sm" icon={PencilSimple} onClick={onEdit} className="text-teal-600 -mr-2">
          Edit
        </Button>
      </div>
      <div className="flex flex-col gap-1.5">{children}</div>
    </motion.section>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-[13.5px]">
      <span className="font-semibold text-ink-500 shrink-0">{label}</span>
      <span className="text-ink-900 font-bold text-right truncate">{value}</span>
    </div>
  );
}
