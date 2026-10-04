"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Banknote, Calculator, Fuel, RotateCcw, Save, ShieldCheck, Timer, Wallet } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { adminSettingsSchema, VEHICLE_CATEGORIES, VEHICLE_CATEGORY_META, type FareBreakdown, type PlatformSettings, type VehicleCategory } from "@raahi/shared";
import { adminApi, errorMessage, type SettingsPatch } from "@/lib/admin-client";
import { Counter } from "@/components/admin/Counter";
import { cn, pkr } from "@/components/admin/format";
import { item, stagger } from "@/components/admin/motion";
import { useToast } from "@/components/admin/toast";
import { Button, Card, Chips, ErrorState, Field, Input, PageHeader, Select, Skeleton, Textarea, Toggle } from "@/components/admin/ui";

type Payment = PlatformSettings["paymentInstructions"];
type NumericKey = Exclude<
  {
    [K in keyof PlatformSettings]: PlatformSettings[K] extends number ? K : never;
  }[keyof PlatformSettings],
  "commissionPercent"
>;

/** Form state keeps numbers as strings so partially typed values ("12.") are not clobbered. */
interface FormState {
  numbers: Record<NumericKey, string>;
  autoApproveSubscriptionReceipts: boolean;
  paymentInstructions: Payment;
  supportPhone: string;
  supportEmail: string;
}

const NUMERIC_KEYS: NumericKey[] = [
  "petrolPricePkr",
  "driverFlatPkr",
  "perMinutePkr",
  "recommendedFuelMultiplier",
  "maxFareMultiplier",
  "roundToPkr",
  "absoluteMinimumFarePkr",
  "driverSubscriptionPkr",
  "subscriptionDays",
  "matchRadiusKm",
  "requestTtlSeconds",
  "bidTtlSeconds",
  "autoVerifyConfidence",
];

function toForm(s: PlatformSettings): FormState {
  const numbers = {} as Record<NumericKey, string>;
  for (const k of NUMERIC_KEYS) numbers[k] = String(s[k]);
  return {
    numbers,
    autoApproveSubscriptionReceipts: s.autoApproveSubscriptionReceipts,
    paymentInstructions: { ...s.paymentInstructions },
    supportPhone: s.supportPhone,
    supportEmail: s.supportEmail,
  };
}

/** Build the PUT body from the fields that actually changed. Returns zod errors keyed by field. */
function toPatch(form: FormState, current: PlatformSettings): { patch: SettingsPatch; errors: Record<string, string> } {
  const patch: SettingsPatch = {};
  const errors: Record<string, string> = {};
  for (const k of NUMERIC_KEYS) {
    const raw = form.numbers[k].trim();
    const n = Number(raw);
    if (raw === "" || !Number.isFinite(n)) {
      errors[k] = "Enter a number";
      continue;
    }
    if (n !== current[k]) patch[k] = n;
  }
  if (form.autoApproveSubscriptionReceipts !== current.autoApproveSubscriptionReceipts) patch.autoApproveSubscriptionReceipts = form.autoApproveSubscriptionReceipts;
  if (form.supportPhone.trim() !== current.supportPhone) patch.supportPhone = form.supportPhone.trim();
  if (form.supportEmail.trim() !== current.supportEmail) patch.supportEmail = form.supportEmail.trim();
  const pay: Partial<Payment> = {};
  for (const key of Object.keys(form.paymentInstructions) as (keyof Payment)[]) {
    if (form.paymentInstructions[key].trim() !== current.paymentInstructions[key]) pay[key] = form.paymentInstructions[key].trim();
  }
  if (Object.keys(pay).length > 0) patch.paymentInstructions = pay;

  const parsed = adminSettingsSchema.safeParse(patch);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".");
      if (!errors[key]) errors[key] = issue.message;
    }
  }
  return { patch, errors };
}

export default function SettingsPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const settings = useQuery({ queryKey: ["admin", "settings"], queryFn: ({ signal }) => adminApi.settings.get(signal) });
  const [form, setForm] = useState<FormState | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (settings.data && form === null) setForm(toForm(settings.data));
  }, [settings.data, form]);

  const save = useMutation({
    mutationFn: (patch: SettingsPatch) => adminApi.settings.update(patch),
    onSuccess: (updated) => {
      queryClient.setQueryData(["admin", "settings"], updated);
      queryClient.invalidateQueries({ queryKey: ["admin", "settings"] });
      setForm(toForm(updated));
      setErrors({});
      toast.success("Settings saved", "Changes are live for every new quote and request.");
    },
    onError: (err) => toast.error("Settings not saved", errorMessage(err)),
  });

  const dirty = useMemo(() => {
    if (!form || !settings.data) return false;
    const { patch } = toPatch(form, settings.data);
    return Object.keys(patch).length > 0;
  }, [form, settings.data]);

  const submit = () => {
    if (!form || !settings.data) return;
    const { patch, errors: errs } = toPatch(form, settings.data);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      toast.error("Check the highlighted fields", Object.values(errs)[0]);
      return;
    }
    if (Object.keys(patch).length === 0) {
      toast.info("Nothing to save", "No settings were changed.");
      return;
    }
    setErrors({});
    save.mutate(patch);
  };

  if (settings.isPending || !form) {
    return (
      <>
        <PageHeader title="Settings" subtitle="Platform-wide pricing, subscriptions and matching rules." />
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <Skeleton className="h-[460px] rounded-3xl xl:col-span-2" />
          <Skeleton className="h-[460px] rounded-3xl" />
          <Skeleton className="h-[320px] rounded-3xl xl:col-span-3" />
        </div>
      </>
    );
  }
  if (settings.isError) {
    return (
      <>
        <PageHeader title="Settings" />
        <Card>
          <ErrorState error={settings.error} onRetry={() => settings.refetch()} />
        </Card>
      </>
    );
  }

  const setNumber = (k: NumericKey, v: string) => setForm((f) => (f ? { ...f, numbers: { ...f.numbers, [k]: v } } : f));
  const setPay = (k: keyof Payment, v: string) => setForm((f) => (f ? { ...f, paymentInstructions: { ...f.paymentInstructions, [k]: v } } : f));
  const numField = (k: NumericKey, label: string, opts: { hint?: string; step?: string; prefix?: string; suffix?: string } = {}) => (
    <Field label={label} hint={opts.hint} error={errors[k]} htmlFor={k}>
      <div className="relative">
        {opts.prefix ? <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[13px] font-semibold text-ink-500">{opts.prefix}</span> : null}
        <Input id={k} inputMode="decimal" step={opts.step ?? "any"} type="number" value={form.numbers[k]} onChange={(e) => setNumber(k, e.target.value)} className={cn(opts.prefix && "pl-12", opts.suffix && "pr-14", errors[k] && "border-rose-500/60")} />
        {opts.suffix ? <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[13px] font-semibold text-ink-500">{opts.suffix}</span> : null}
      </div>
    </Field>
  );

  const actions = (
    <>
      <Button variant="ghost" icon={<RotateCcw size={16} />} disabled={!dirty || save.isPending} onClick={() => settings.data && setForm(toForm(settings.data))}>
        Discard
      </Button>
      <Button icon={<Save size={16} />} onClick={submit} loading={save.isPending} disabled={!dirty}>
        Save changes
      </Button>
    </>
  );

  return (
    <>
      <PageHeader title="Settings" subtitle="Platform-wide pricing, subscriptions and matching rules. Every change is written to the audit log." actions={actions} />
      <motion.div variants={stagger(0.07)} initial="hidden" animate="show" className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <motion.div variants={item.up} className="space-y-6 xl:col-span-2">
          <Section icon={<Fuel size={18} />} title="Fare engine" subtitle="minimum = fuel cost + driver flat · recommended = fuel × multiplier + flat + per-minute · maximum = recommended × ceiling">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {numField("petrolPricePkr", "Petrol price", { prefix: "PKR", suffix: "/ L", hint: "OGRA retail price per litre. Changes fares instantly.", step: "0.01" })}
              {numField("driverFlatPkr", "Driver flat amount", { prefix: "PKR", hint: "Every ride earns the driver at least this on top of fuel." })}
              {numField("perMinutePkr", "Per-minute component", { prefix: "PKR", suffix: "/ min", hint: "Time cost added to the recommended fare." })}
              {numField("recommendedFuelMultiplier", "Recommended fuel multiplier", { suffix: "×", hint: "1.15 = 15% headroom over raw fuel cost.", step: "0.01" })}
              {numField("maxFareMultiplier", "Maximum fare ceiling", { suffix: "× rec.", hint: "Offers above recommended × this are rejected.", step: "0.1" })}
              {numField("roundToPkr", "Round fares to", { prefix: "PKR", hint: "Fares are rounded to this step." })}
              {numField("absoluteMinimumFarePkr", "Absolute minimum fare", { prefix: "PKR", hint: "Floor regardless of distance." })}
            </div>
          </Section>

          <Section icon={<Wallet size={18} />} title="Driver subscription" subtitle="Raahi takes no commission. Drivers pay a flat monthly fee.">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {numField("driverSubscriptionPkr", "Subscription price", { prefix: "PKR" })}
              {numField("subscriptionDays", "Subscription length", { suffix: "days" })}
            </div>
            <div className="mt-4">
              <Toggle
                checked={form.autoApproveSubscriptionReceipts}
                onChange={(v) => setForm({ ...form, autoApproveSubscriptionReceipts: v })}
                label="Auto-approve receipts"
                description="Test mode: every uploaded receipt activates the subscription immediately without review. Turn off before launch."
              />
            </div>
          </Section>

          <Section icon={<Banknote size={18} />} title="Payment instructions" subtitle="Shown to drivers in the app when they pay their subscription.">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <PayField k="accountTitle" label="Account title" value={form.paymentInstructions.accountTitle} onChange={setPay} error={errors["paymentInstructions.accountTitle"]} />
              <PayField k="bankName" label="Bank" value={form.paymentInstructions.bankName} onChange={setPay} error={errors["paymentInstructions.bankName"]} />
              <PayField k="jazzcash" label="JazzCash number" value={form.paymentInstructions.jazzcash} onChange={setPay} error={errors["paymentInstructions.jazzcash"]} inputMode="tel" />
              <PayField k="easypaisa" label="EasyPaisa number" value={form.paymentInstructions.easypaisa} onChange={setPay} error={errors["paymentInstructions.easypaisa"]} inputMode="tel" />
              <PayField k="bankAccount" label="Bank account" value={form.paymentInstructions.bankAccount} onChange={setPay} error={errors["paymentInstructions.bankAccount"]} />
              <PayField k="iban" label="IBAN" value={form.paymentInstructions.iban} onChange={setPay} error={errors["paymentInstructions.iban"]} />
            </div>
            <Field label="Note to drivers" hint={`${form.paymentInstructions.note.length}/300`} error={errors["paymentInstructions.note"]} className="mt-4">
              <Textarea value={form.paymentInstructions.note} onChange={(e) => setPay("note", e.target.value.slice(0, 300))} />
            </Field>
          </Section>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Section icon={<Timer size={18} />} title="Matching" subtitle="How requests reach drivers and how long offers live.">
              <div className="space-y-4">
                {numField("matchRadiusKm", "Match radius", { suffix: "km", hint: "Drivers within this distance of the pickup see the request." })}
                {numField("requestTtlSeconds", "Request lifetime", { suffix: "sec", hint: "Open requests expire after this." })}
                {numField("bidTtlSeconds", "Bid lifetime", { suffix: "sec", hint: "How long a passenger has to accept an offer." })}
              </div>
            </Section>
            <Section icon={<ShieldCheck size={18} />} title="Verification & support" subtitle="AI document checks and the contacts shown in the app.">
              <div className="space-y-4">
                {numField("autoVerifyConfidence", "Auto-verify confidence", { suffix: "0–1", hint: "Documents at or above this Gemini confidence are verified without a human.", step: "0.05" })}
                <Field label="Support phone" error={errors.supportPhone} htmlFor="supportPhone">
                  <Input id="supportPhone" inputMode="tel" value={form.supportPhone} onChange={(e) => setForm({ ...form, supportPhone: e.target.value })} />
                </Field>
                <Field label="Support email" error={errors.supportEmail} htmlFor="supportEmail">
                  <Input id="supportEmail" type="email" inputMode="email" value={form.supportEmail} onChange={(e) => setForm({ ...form, supportEmail: e.target.value })} />
                </Field>
              </div>
            </Section>
          </div>
        </motion.div>

        <motion.div variants={item.right} className="xl:sticky xl:top-20 xl:self-start">
          <FarePreview form={form} saved={settings.data} />
        </motion.div>
      </motion.div>

      <div className="sticky bottom-4 mt-6 flex justify-end">
        <motion.div initial={false} animate={{ y: dirty ? 0 : 12, opacity: dirty ? 1 : 0 }} className={cn("glass flex items-center gap-3 rounded-2xl px-4 py-3 shadow-float", !dirty && "pointer-events-none")}>
          <span className="text-[13.5px] text-ink-300">You have unsaved changes</span>
          {actions}
        </motion.div>
      </div>
    </>
  );
}

function Section({ icon, title, subtitle, children }: { icon: ReactNode; title: string; subtitle?: string; children: ReactNode }) {
  return (
    <Card
      title={
        <span className="inline-flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-brand-500/15 text-brand-400">{icon}</span>
          {title}
        </span>
      }
      subtitle={subtitle}
    >
      {children}
    </Card>
  );
}

function PayField({ k, label, value, onChange, error, inputMode }: { k: keyof Payment; label: string; value: string; onChange: (k: keyof Payment, v: string) => void; error?: string; inputMode?: "tel" | "text" }) {
  return (
    <Field label={label} error={error} htmlFor={`pay-${k}`}>
      <Input id={`pay-${k}`} value={value} inputMode={inputMode} onChange={(e) => onChange(k, e.target.value)} />
    </Field>
  );
}

/* ------------------------------------------------------------------ */
/* Live fare preview                                                   */
/* ------------------------------------------------------------------ */

function FarePreview({ form, saved }: { form: FormState; saved: PlatformSettings }) {
  const [distance, setDistance] = useState("8");
  const [duration, setDuration] = useState("22");
  const [category, setCategory] = useState<VehicleCategory>("car");

  const numeric = (k: NumericKey, min: number, max: number): number | undefined => {
    const n = Number(form.numbers[k]);
    return Number.isFinite(n) && n >= min && n <= max ? n : undefined;
  };
  const petrol = numeric("petrolPricePkr", 50, 2000);
  const flat = numeric("driverFlatPkr", 0, 5000);
  const perMin = numeric("perMinutePkr", 0, 100);
  const recMult = numeric("recommendedFuelMultiplier", 1, 3);
  const maxMult = numeric("maxFareMultiplier", 1.1, 5);
  const dist = Number(distance);
  const dur = Number(duration);
  const valid = Number.isFinite(dist) && dist > 0 && dist <= 1000 && Number.isFinite(dur) && dur > 0 && dur <= 2000;

  const [debounced, setDebounced] = useState({ dist, dur, category, petrol, flat, perMin, recMult, maxMult });
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced({ dist, dur, category, petrol, flat, perMin, recMult, maxMult }), 300);
    return () => window.clearTimeout(t);
  }, [dist, dur, category, petrol, flat, perMin, recMult, maxMult]);

  const preview = useQuery({
    queryKey: ["admin", "fare-preview", debounced],
    queryFn: ({ signal }) =>
      adminApi.fare.preview(
        {
          distanceKm: debounced.dist,
          durationMin: debounced.dur,
          category: debounced.category,
          petrolPricePkr: debounced.petrol,
          driverFlatPkr: debounced.flat,
          perMinutePkr: debounced.perMin,
          recommendedFuelMultiplier: debounced.recMult,
          maxFareMultiplier: debounced.maxMult,
        },
        signal,
      ),
    enabled: valid,
    placeholderData: (prev) => prev,
    staleTime: 60_000,
  });

  const unsavedPricing = petrol !== saved.petrolPricePkr || flat !== saved.driverFlatPkr || perMin !== saved.perMinutePkr || recMult !== saved.recommendedFuelMultiplier || maxMult !== saved.maxFareMultiplier;
  const fare: FareBreakdown | undefined = preview.data;

  return (
    <Card
      title={
        <span className="inline-flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-amber-400/15 text-amber-300">
            <Calculator size={18} />
          </span>
          Fare preview
        </span>
      }
      subtitle={unsavedPricing ? "Using the unsaved values from the form" : "Using the saved settings"}
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Distance" htmlFor="pv-dist">
          <div className="relative">
            <Input id="pv-dist" type="number" inputMode="decimal" min={0.3} value={distance} onChange={(e) => setDistance(e.target.value)} className="pr-10" />
            <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[13px] text-ink-500">km</span>
          </div>
        </Field>
        <Field label="Duration" htmlFor="pv-dur">
          <div className="relative">
            <Input id="pv-dur" type="number" inputMode="numeric" min={1} value={duration} onChange={(e) => setDuration(e.target.value)} className="pr-12" />
            <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[13px] text-ink-500">min</span>
          </div>
        </Field>
      </div>
      <div className="mt-3">
        <Chips<VehicleCategory> value={category} onChange={setCategory} layoutId="fare-preview-cat" options={VEHICLE_CATEGORIES.map((c) => ({ value: c, label: VEHICLE_CATEGORY_META[c].label }))} />
      </div>
      <div className="mt-2 sm:hidden">
        <Select value={category} onChange={(e) => setCategory(e.target.value as VehicleCategory)} aria-label="Vehicle category">
          {VEHICLE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {VEHICLE_CATEGORY_META[c].label}
            </option>
          ))}
        </Select>
      </div>

      {!valid ? (
        <p className="mt-5 text-[13.5px] text-ink-400">Enter a distance and duration to see what a passenger would pay.</p>
      ) : preview.isError ? (
        <ErrorState error={preview.error} onRetry={() => preview.refetch()} className="py-6" />
      ) : !fare ? (
        <div className="mt-5 space-y-3">
          <Skeleton className="h-16" />
          <Skeleton className="h-24" />
        </div>
      ) : (
        <motion.div className={cn("mt-5 space-y-4 transition-opacity", preview.isPlaceholderData && "opacity-60")}>
          <div className="grid grid-cols-3 gap-2 text-center">
            <Tile label="Minimum" value={fare.minimumFarePkr} tone="text-ink-100" />
            <Tile label="Recommended" value={fare.recommendedFarePkr} tone="text-brand-300" big />
            <Tile label="Maximum" value={fare.maximumFarePkr} tone="text-ink-100" />
          </div>
          <div className="relative h-2 rounded-full bg-ink-700">
            <motion.div layout className="absolute inset-y-0 rounded-full bg-gradient-to-r from-brand-500 via-brand-400 to-amber-400" style={{ left: 0, right: 0 }} />
            <span className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-ink-800 bg-brand-300" style={{ left: `${Math.min(100, Math.max(0, ((fare.recommendedFarePkr - fare.minimumFarePkr) / Math.max(1, fare.maximumFarePkr - fare.minimumFarePkr)) * 100))}%` }} />
          </div>
          <dl className="space-y-1.5 text-[13.5px]">
            <Row label={`Fuel · ${fare.litresNeeded.toFixed(2)} L at ${fare.kmPerLitre} km/L × ${pkr(fare.petrolPricePkr)}`} value={pkr(fare.fuelCostPkr)} />
            <Row label="Driver flat" value={pkr(fare.driverFlatPkr)} />
            <Row label={`Time · ${fare.durationMin} min`} value={pkr(fare.timeCostPkr)} />
            {fare.comfortMultiplier !== 1 ? <Row label="Comfort multiplier" value={`× ${fare.comfortMultiplier}`} /> : null}
          </dl>
          <p className="text-[12.5px] leading-relaxed text-ink-500">
            Passengers see the recommended fare pre-filled and can offer anything between the minimum and maximum. 100% of the fare goes to the driver.
          </p>
        </motion.div>
      )}
    </Card>
  );
}

function Tile({ label, value, tone, big }: { label: string; value: number; tone: string; big?: boolean }) {
  return (
    <div className={cn("rounded-2xl bg-ink-900/60 px-2 py-3", big && "ring-1 ring-brand-500/40")}>
      <p className={cn("font-display font-semibold tabular-nums", tone, big ? "text-[22px]" : "text-[17px]")}>
        <Counter value={value} format={(n) => pkr(n)} duration={0.6} />
      </p>
      <p className="mt-0.5 text-[11px] uppercase tracking-wide text-ink-500">{label}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-ink-400">{label}</dt>
      <dd className="font-semibold text-ink-100">{value}</dd>
    </div>
  );
}

