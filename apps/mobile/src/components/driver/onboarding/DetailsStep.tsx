import { motion } from "framer-motion";
import { CalendarDots, IdentificationCard, MapPin, ShieldCheck } from "@phosphor-icons/react";
import { useCallback, type FormEvent } from "react";
import { driverDetailsSchema, formatCnic, type DriverDetailsInput, type DriverDto } from "@raahi/shared";
import { Breathe } from "@/components/driver/Breathe";
import { PhoneInput } from "@/components/shared/PhoneInput";
import { Button, Chip, Input, useToast } from "@/components/ui";
import { PK_CITIES, toDateInput } from "@/hooks/driver/onboarding";
import { useDriverMutation } from "@/hooks/driver/useDriver";
import { useStepForm, type ErrorMap } from "@/hooks/driver/useStepForm";
import { api, ApiRequestError } from "@/lib/api";
import { item, stagger } from "@/lib/motion";
import { haptic } from "@/lib/native";
import { errorMessage } from "@/lib/utils";

type Values = { cnic: string; dateOfBirth: string; city: string; licenseNumber: string; licenseExpiry: string; emergencyContact: string };

const todayIso = () => new Date().toISOString().slice(0, 10);
const yearsAgo = (n: number) => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - n);
  return d.toISOString().slice(0, 10);
};

const toPayload = (v: Values) => ({
  cnic: v.cnic,
  dateOfBirth: v.dateOfBirth || undefined,
  city: v.city,
  licenseNumber: v.licenseNumber,
  licenseExpiry: v.licenseExpiry || undefined,
  emergencyContact: v.emergencyContact.trim() || undefined,
});

const rules = (v: Values): ErrorMap<Values> => {
  const out: ErrorMap<Values> = {};
  if (v.licenseExpiry && v.licenseExpiry <= todayIso()) out.licenseExpiry = "Your license has expired. Renew it before driving with Raahi.";
  if (v.dateOfBirth && v.dateOfBirth > yearsAgo(18)) out.dateOfBirth = "You must be at least 18 to drive.";
  return out;
};

/** Step 1 — identity & KYC basics. */
export function DetailsStep({ driver, onNext }: { driver: DriverDto; onNext: () => void }) {
  const toast = useToast();
  const form = useStepForm({
    schema: driverDetailsSchema,
    initial: {
      cnic: driver.cnic ? formatCnic(driver.cnic) : "",
      dateOfBirth: "",
      city: driver.city ?? "",
      licenseNumber: driver.licenseNumber ?? "",
      licenseExpiry: toDateInput(driver.licenseExpiry),
      emergencyContact: "",
    } satisfies Values,
    toPayload,
    extra: rules,
  });

  const save = useDriverMutation((body: DriverDetailsInput) => api.driver.details(body), {
    onSuccess: () => {
      haptic.success();
      onNext();
    },
    onError: (err) => {
      haptic.error();
      if (err instanceof ApiRequestError && err.status === 409) form.setError("cnic", "This CNIC is already registered with another driver account");
      else toast({ title: "Couldn't save your details", body: errorMessage(err), tone: "error" });
    },
  });

  const onCnic = useCallback(
    (raw: string) => {
      const digits = raw.replace(/\D/g, "").slice(0, 13);
      const parts = [digits.slice(0, 5), digits.slice(5, 12), digits.slice(12, 13)].filter(Boolean);
      form.set("cnic", parts.join("-"));
    },
    [form],
  );

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const parsed = form.validate();
    if (!parsed) {
      haptic.warning();
      return;
    }
    save.mutate(parsed);
  };

  const cnicField = form.bind("cnic");

  return (
    <motion.form variants={stagger(0.06)} initial="hidden" animate="show" onSubmit={submit} noValidate className="flex flex-col gap-4 pb-4">
      <motion.div variants={item.left} className="flex items-start gap-3 rounded-[22px] bg-teal-100 px-3.5 py-3">
        <ShieldCheck className="size-6 text-teal-600 shrink-0 mt-0.5" weight="duotone" />
        <p className="text-[13px] font-semibold text-ink-700 leading-snug">Your details are checked against your documents by AI and never shown to passengers. Only your first name, photo and vehicle are visible.</p>
      </motion.div>

      <motion.div variants={item.up}>
        <Input label="CNIC number" icon={IdentificationCard} inputMode="numeric" autoComplete="off" placeholder="35202-1234567-1" value={cnicField.value} error={cnicField.error} onBlur={cnicField.onBlur} onChange={(e) => onCnic(e.target.value)} hint="13 digits, as printed on your national ID card." />
      </motion.div>

      <motion.div variants={item.up}>
        <Input label="Date of birth (optional)" icon={CalendarDots} type="date" max={yearsAgo(18)} min="1940-01-01" {...form.bind("dateOfBirth")} />
      </motion.div>

      <motion.div variants={item.up} className="flex flex-col gap-2">
        <Input label="City" icon={MapPin} autoComplete="address-level2" autoCapitalize="words" placeholder="Where you'll drive most" {...form.bind("city")} />
        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-5 px-5 pb-1">
          {PK_CITIES.map((c) => (
            <Chip key={c} tone="teal" active={form.values.city.trim().toLowerCase() === c.toLowerCase()} onClick={() => form.set("city", c)} className="shrink-0">
              {c}
            </Chip>
          ))}
        </div>
      </motion.div>

      <motion.div variants={item.up} className="grid grid-cols-1 gap-4">
        <Input label="Driving license number" autoComplete="off" autoCapitalize="characters" placeholder="e.g. LHR-1234567" {...form.bind("licenseNumber")} />
        <Input label="License expiry (optional)" type="date" min={todayIso()} {...form.bind("licenseExpiry")} />
      </motion.div>

      <motion.div variants={item.up}>
        <PhoneInput label="Emergency contact (optional)" {...form.bind("emergencyContact")} hint="Someone we can reach if there's a problem during a trip." />
      </motion.div>

      <motion.div variants={item.up} className="pt-2">
        <Breathe>
          <Button type="submit" full size="xl" variant="teal" loading={save.isPending}>
            Save & continue
          </Button>
        </Breathe>
      </motion.div>
    </motion.form>
  );
}
