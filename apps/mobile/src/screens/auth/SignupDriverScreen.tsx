import { useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { BadgeCheck, Camera, Car, CreditCard, FileText, IdCard, Receipt, UserRound } from "lucide-react";
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
  { icon: IdCard, label: "CNIC, front and back" },
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
      title="Drive on your terms"
      subtitle="Keep 100% of every fare. Create your account, then we'll walk you through verification."
      aside={
        <div className="rounded-3xl bg-ink-800/80 border border-white/6 p-4">
          <div className="flex items-center gap-2 mb-3">
            <BadgeCheck className="size-4 text-brand-400" />
            <p className="text-[12.5px] font-bold uppercase tracking-[0.14em] text-ink-300">You'll need, in the next step</p>
          </div>
          <motion.ul variants={stagger(0.05, 0.3)} initial="hidden" animate="show" className="grid grid-cols-1 gap-2">
            {CHECKLIST.map(({ icon: Icon, label }) => (
              <motion.li key={label} variants={item.right} className="flex items-center gap-2.5 text-[13.5px] text-ink-200">
                <span className="size-7 rounded-lg bg-white/5 flex items-center justify-center text-ink-300 shrink-0">
                  <Icon className="size-4" />
                </span>
                {label}
              </motion.li>
            ))}
          </motion.ul>
          <p className="mt-3 flex items-center gap-1.5 text-[12px] text-ink-500">
            <CreditCard className="size-3.5" /> No commission on rides, ever.
          </p>
        </div>
      }
      footer={
        <p>
          Already driving with us?{" "}
          <Link to="/auth/login?role=driver" className="font-semibold text-brand-400">
            Sign in
          </Link>
        </p>
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <Input label="Full name" placeholder="Exactly as on your CNIC" icon={UserRound} autoComplete="name" autoCapitalize="words" hint="Must match your CNIC and licence for verification." {...form.bind("fullName")} />
        <PhoneInput label="Mobile number" {...form.bind("phone")} />
        <PasswordInput label="Password" placeholder="At least 8 characters" autoComplete="new-password" {...form.bind("password")} />
        <PasswordInput label="Confirm password" placeholder="Type it again" autoComplete="new-password" {...form.bind("confirm")} />
        <p className="text-[12.5px] leading-relaxed text-ink-500 px-1">By continuing you agree to Raahi's Driver Terms and Privacy Policy, and to document verification by Raahi and its AI systems.</p>
        <Button type="submit" size="xl" full icon={Car} loading={signup.isPending}>
          Continue to verification
        </Button>
      </form>
    </AuthShell>
  );
}
