import { useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Camera, Car, CreditCard, FileText, IdentificationCard, Receipt, SealCheck, User } from "@phosphor-icons/react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { DEFAULT_SETTINGS, driverSignupSchema, formatPkr, type DriverSignupInput } from "@raahi/shared";
import { Button, Input, useToast } from "@/components/ui";
import { AuthShell } from "@/components/shared/AuthShell";
import { PasswordInput } from "@/components/shared/PasswordInput";
import { PhoneInput } from "@/components/shared/PhoneInput";
import { useZodForm } from "@/hooks/useZodForm";
import { api, ApiRequestError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { item, stagger } from "@/lib/motion";
import { haptic } from "@/lib/native";
import { errorMessage } from "@/lib/utils";

type Values = { fullName: string; phone: string; password: string; confirm: string };

const confirmRule = (v: Values) => {
  if (!v.confirm) return v.password ? { confirm: "Re-enter your password" } : {};
  return v.confirm !== v.password ? { confirm: "Passwords don't match" } : {};
};

const CHECKLIST = [
  { icon: Camera, label: "A live selfie" },
  { icon: IdentificationCard, label: "CNIC, front and back" },
  { icon: FileText, label: "Driving licence" },
  { icon: FileText, label: "Route permit" },
  { icon: Car, label: "Vehicle documents and a photo" },
  { icon: Receipt, label: `${formatPkr(DEFAULT_SETTINGS.driverSubscriptionPkr)} monthly subscription receipt` },
];

export default function SignupDriverScreen() {
  const navigate = useNavigate();
  const { applyAuth } = useAuth();
  const toast = useToast();
  const form = useZodForm(driverSignupSchema, { fullName: "", phone: "", password: "", confirm: "" }, confirmRule);

  const signup = useMutation({
    mutationFn: (input: DriverSignupInput) => api.auth.signupDriver(input),
    onSuccess: async (res) => {
      haptic.success();
      await applyAuth(res);
      toast({ title: "Account created", body: "Next: your details, vehicle and documents.", tone: "success" });
      navigate("/d", { replace: true });
    },
    onError: (err) => {
      haptic.error();
      if (err instanceof ApiRequestError && err.status === 409) {
        form.setError("phone", "An account with this number already exists");
        toast({ title: "Number already registered", body: "Sign in instead, or use a different mobile number.", tone: "error" });
        return;
      }
      toast({ title: "Couldn't create your account", body: errorMessage(err), tone: "error" });
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const parsed = form.validate();
    if (!parsed) {
      haptic.warning();
      return;
    }
    signup.mutate(parsed);
  };

  return (
    <AuthShell
      eyebrow="Driver account"
      tone="teal"
      title={
        <>
          Drive on <span className="text-teal-500">your terms.</span>
        </>
      }
      subtitle="Keep 100% of every fare. Create your account, then we'll walk you through verification."
      aside={
        <div className="relative overflow-hidden rounded-[26px] bg-teal-100 p-4 shadow-[0_4px_0_0_#b7e8df]">
          <span aria-hidden className="blob absolute -right-10 -top-12 size-36 bg-white/50" />
          <div className="relative flex items-center gap-2 mb-3">
            <SealCheck className="size-5 text-teal-600" weight="duotone" />
            <p className="text-[12px] font-extrabold uppercase tracking-[0.14em] text-teal-700">You'll need, in the next step</p>
          </div>
          <motion.ul variants={stagger(0.05, 0.3)} initial="hidden" animate="show" className="relative grid grid-cols-1 gap-2">
            {CHECKLIST.map(({ icon: Icon, label }) => (
              <motion.li key={label} variants={item.right} className="flex items-center gap-2.5 text-[13.5px] font-bold text-ink-800">
                <span className="size-8 rounded-xl bg-white flex items-center justify-center text-teal-600 shrink-0 shadow-pillow">
                  <Icon className="size-[18px]" weight="duotone" />
                </span>
                {label}
              </motion.li>
            ))}
          </motion.ul>
          <p className="relative mt-3 flex items-center gap-1.5 text-[12.5px] font-bold text-teal-700">
            <CreditCard className="size-4" weight="duotone" /> No commission on rides, ever.
          </p>
        </div>
      }
      footer={
        <p>
          Already driving with us?{" "}
          <Link to="/auth/login?role=driver" className="font-extrabold text-teal-600">
            Sign in
          </Link>
        </p>
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <Input label="Full name" placeholder="Exactly as on your CNIC" icon={User} autoComplete="name" autoCapitalize="words" hint="Must match your CNIC and licence for verification." {...form.bind("fullName")} />
        <PhoneInput label="Mobile number" {...form.bind("phone")} />
        <PasswordInput label="Password" placeholder="At least 8 characters" autoComplete="new-password" {...form.bind("password")} />
        <PasswordInput label="Confirm password" placeholder="Type it again" autoComplete="new-password" {...form.bind("confirm")} />
        <p className="text-[12.5px] leading-relaxed text-ink-500 px-1 font-medium">By continuing you agree to Raahi's Driver Terms and Privacy Policy, and to document verification by Raahi and its AI systems.</p>
        <Button type="submit" size="xl" full icon={Car} variant="teal" loading={signup.isPending}>
          Continue to verification
        </Button>
      </form>
    </AuthShell>
  );
}
