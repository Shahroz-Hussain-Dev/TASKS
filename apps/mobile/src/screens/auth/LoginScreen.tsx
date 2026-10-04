import { useMutation } from "@tanstack/react-query";
import { Car, LogIn, UserRound } from "lucide-react";
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
      title={role === "driver" ? "Sign in to drive" : "Sign in to ride"}
      subtitle={role === "driver" ? "Go online, see requests near you and send offers." : "Name your fare and let drivers come to you."}
      aside={
        <Segmented
          value={role}
          onChange={changeRole}
          options={[
            { value: "customer", label: "Rider", icon: UserRound },
            { value: "driver", label: "Driver", icon: Car },
          ]}
        />
      }
      footer={
        <p>
          New to Raahi?{" "}
          <Link to={role === "driver" ? "/auth/signup/driver" : "/auth/signup/customer"} className="font-semibold text-brand-400">
            Create {role === "driver" ? "a driver" : "an"} account
          </Link>
        </p>
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <PhoneInput label="Mobile number" {...form.bind("phone")} />
        <PasswordInput label="Password" placeholder="Your password" autoComplete="current-password" {...form.bind("password")} />
        <Button type="submit" size="xl" full icon={LogIn} loading={login.isPending} className="mt-2">
          Sign in
        </Button>
      </form>
    </AuthShell>
  );
}
