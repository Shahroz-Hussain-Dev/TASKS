import { useMutation } from "@tanstack/react-query";
import { Car, SignIn, User } from "@phosphor-icons/react";
import type { FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { loginSchema, type LoginInput } from "@raahi/shared";
import { Button, Segmented, useToast } from "@/components/ui";
import { AuthShell } from "@/components/shared/AuthShell";
import { PasswordInput } from "@/components/shared/PasswordInput";
import { PhoneInput } from "@/components/shared/PhoneInput";
import { useZodForm } from "@/hooks/useZodForm";
import { api, ApiRequestError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { haptic } from "@/lib/native";
import { errorMessage } from "@/lib/utils";

type Role = "customer" | "driver";
const asRole = (v: string | null, fallback: Role): Role => (v === "driver" || v === "customer" ? v : fallback);

export default function LoginScreen() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { applyAuth, preferredRole, setPreferredRole } = useAuth();
  const toast = useToast();
  const role = asRole(params.get("role"), preferredRole);
  const form = useZodForm(loginSchema, { phone: "", password: "", role });
  const driver = role === "driver";

  const login = useMutation({
    mutationFn: (input: LoginInput) => api.auth.login(input),
    onSuccess: async (res) => {
      haptic.success();
      await applyAuth(res);
      navigate(res.user.role === "driver" ? "/d" : "/c", { replace: true });
    },
    onError: (err) => {
      haptic.error();
      if (err instanceof ApiRequestError && err.status === 401) {
        form.setError("password", "Check your phone number and password");
        toast({ title: "Incorrect phone or password", body: `Make sure you're signing in as a ${role === "driver" ? "driver" : "rider"}.`, tone: "error" });
        return;
      }
      if (err instanceof ApiRequestError && err.status === 429) {
        toast({ title: "Too many attempts", body: errorMessage(err, "Please wait a few minutes and try again."), tone: "error" });
        return;
      }
      toast({ title: "Couldn't sign in", body: errorMessage(err), tone: "error" });
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const parsed = form.validate();
    if (!parsed) {
      haptic.warning();
      return;
    }
    login.mutate(parsed);
  };

  const changeRole = (r: Role) => {
    setPreferredRole(r);
    form.setField("role", r);
    setParams({ role: r }, { replace: true });
  };

  return (
    <AuthShell
      eyebrow="Welcome back"
      tone={driver ? "teal" : "coral"}
      title={
        driver ? (
          <>
            Sign in <span className="text-teal-500">to drive.</span>
          </>
        ) : (
          <>
            Sign in <span className="text-coral-500">to ride.</span>
          </>
        )
      }
      subtitle={driver ? "Go online, see requests near you and send offers." : "Name your fare and let drivers come to you."}
      aside={
        <Segmented
          value={role}
          onChange={changeRole}
          tone={driver ? "teal" : "coral"}
          options={[
            { value: "customer", label: "Rider", icon: User },
            { value: "driver", label: "Driver", icon: Car },
          ]}
        />
      }
      footer={
        <p>
          New to Raahi?{" "}
          <Link to={driver ? "/auth/signup/driver" : "/auth/signup/customer"} className={driver ? "font-extrabold text-teal-600" : "font-extrabold text-coral-600"}>
            Create {driver ? "a driver" : "an"} account
          </Link>
        </p>
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <PhoneInput label="Mobile number" {...form.bind("phone")} />
        <PasswordInput label="Password" placeholder="Your password" autoComplete="current-password" {...form.bind("password")} />
        <Button type="submit" size="xl" full icon={SignIn} variant={driver ? "teal" : "primary"} loading={login.isPending} className="mt-1">
          Sign in
        </Button>
        <p className="text-center text-[12.5px] text-ink-400 font-semibold -mt-1">Your number is your login. We never share it.</p>
      </form>
    </AuthShell>
  );
}
