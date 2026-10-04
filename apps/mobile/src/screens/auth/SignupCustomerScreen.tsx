import { useMutation } from "@tanstack/react-query";
import { Mail, Sparkles, UserRound } from "lucide-react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { customerSignupSchema, type CustomerSignupInput } from "@raahi/shared";
import { Button, Input, useToast } from "@/components/ui";
import { AuthShell } from "@/components/shared/AuthShell";
import { PasswordInput } from "@/components/shared/PasswordInput";
import { PhoneInput } from "@/components/shared/PhoneInput";
import { useZodForm } from "@/hooks/useZodForm";
import { api, ApiRequestError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { haptic } from "@/lib/native";
import { errorMessage } from "@/lib/utils";

type Values = { fullName: string; phone: string; email: string; password: string; confirm: string };

const confirmRule = (v: Values) => {
  if (!v.confirm) return v.password ? { confirm: "Re-enter your password" } : {};
  return v.confirm !== v.password ? { confirm: "Passwords don't match" } : {};
};

export default function SignupCustomerScreen() {
  const navigate = useNavigate();
  const { applyAuth } = useAuth();
  const toast = useToast();
  const form = useZodForm(customerSignupSchema, { fullName: "", phone: "", email: "", password: "", confirm: "" }, confirmRule);

  const signup = useMutation({
    mutationFn: (input: CustomerSignupInput) => api.auth.signupCustomer(input),
    onSuccess: async (res) => {
      haptic.success();
      await applyAuth(res);
      toast({ title: `Welcome to Raahi, ${res.user.fullName.split(" ")[0] ?? "friend"}`, body: "Set your pickup and name your fare to get started.", tone: "success" });
      navigate("/c", { replace: true });
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
      eyebrow="Rider account"
      title="Let's get you moving"
      subtitle="Takes under a minute. Your number is how drivers reach you."
      footer={
        <p>
          Already have an account?{" "}
          <Link to="/auth/login?role=customer" className="font-semibold text-brand-400">
            Sign in
          </Link>
        </p>
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <Input label="Full name" placeholder="As on your CNIC" icon={UserRound} autoComplete="name" autoCapitalize="words" {...form.bind("fullName")} />
        <PhoneInput label="Mobile number" {...form.bind("phone")} />
        <Input label="Email (optional)" placeholder="you@example.com" type="email" inputMode="email" icon={Mail} autoComplete="email" autoCapitalize="none" hint="For receipts and account recovery." {...form.bind("email")} />
        <PasswordInput label="Password" placeholder="At least 8 characters" autoComplete="new-password" {...form.bind("password")} />
        <PasswordInput label="Confirm password" placeholder="Type it again" autoComplete="new-password" {...form.bind("confirm")} />
        <p className="text-[12.5px] leading-relaxed text-ink-500 px-1">By creating an account you agree to Raahi's Terms of Service and Privacy Policy. Fares are paid in cash directly to the driver.</p>
        <Button type="submit" size="xl" full icon={Sparkles} loading={signup.isPending}>
          Create account
        </Button>
      </form>
    </AuthShell>
  );
}
