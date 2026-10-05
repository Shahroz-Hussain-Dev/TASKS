"use client";

import { ArrowRight, EnvelopeSimple, LockKey, ShieldCheck } from "@phosphor-icons/react";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type FormEvent } from "react";
import { adminLoginSchema } from "@raahi/shared";
import { adminApi, errorMessage, isAdminApiError } from "@/lib/admin-client";
import { Logo } from "@/components/landing/Logo";
import { item, stagger } from "@/components/admin/motion";
import { Button, Field, Input } from "@/components/admin/ui";

function safeNext(raw: string | null): string {
  if (!raw) return "/admin";
  // Only same-origin admin paths may be used as a post-login destination.
  if (raw.startsWith("/admin") && !raw.startsWith("//") && !raw.startsWith("/admin/login")) return raw;
  return "/admin";
}

function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const queryClient = useQueryClient();
  const next = safeNext(search.get("next"));

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  // Already signed in? Skip the form.
  useEffect(() => {
    const controller = new AbortController();
    adminApi.auth
      .me(controller.signal)
      .then((me) => {
        if (me.user.role === "admin") router.replace(next);
        else setChecking(false);
      })
      .catch(() => setChecking(false));
    return () => controller.abort();
  }, [router, next]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const parsed = adminLoginSchema.safeParse({ email, password });
    if (!parsed.success) {
      const errs: { email?: string; password?: string } = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (key === "email") errs.email = "Enter a valid email address";
        if (key === "password") errs.password = "Enter your password";
      }
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});
    setLoading(true);
    try {
      await adminApi.auth.login(parsed.data.email, parsed.data.password);
      queryClient.clear();
      router.push(next);
    } catch (err) {
      if (isAdminApiError(err) && err.status === 401) setFormError("That email and password don't match an admin account.");
      else if (isAdminApiError(err) && err.status === 429) setFormError("Too many attempts. Wait a minute and try again.");
      else setFormError(errorMessage(err));
      setLoading(false);
    }
  };

  return (
    <motion.div variants={stagger(0.08)} initial="hidden" animate="show" className="relative w-full max-w-[420px]">
      <motion.div variants={item.down} className="mb-8 flex flex-col items-center text-center">
        <motion.div initial={{ rotate: -6 }} animate={{ rotate: 0 }} transition={{ type: "spring", stiffness: 260, damping: 18 }}>
          <Logo size={68} />
        </motion.div>
        <h1 className="mt-5 font-display text-[30px] font-semibold text-ink-900">Raahi Admin</h1>
        <p className="mt-1 text-[14px] text-ink-600">Sign in to manage drivers, rides and settings.</p>
      </motion.div>

      <motion.form variants={item.up} onSubmit={submit} noValidate className="pillow p-6 shadow-float">
        {checking ? (
          <div className="space-y-4">
            <div className="shimmer h-11 rounded-2xl" />
            <div className="shimmer h-11 rounded-2xl" />
            <div className="shimmer h-12 rounded-full" />
          </div>
        ) : (
          <div className="space-y-4">
            <Field label="Email" htmlFor="email" error={fieldErrors.email}>
              <div className="relative">
                <EnvelopeSimple size={18} weight="duotone" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-coral-500" />
                <Input id="email" type="email" autoComplete="username" inputMode="email" placeholder="you@raahi.pk" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-11" autoFocus />
              </div>
            </Field>
            <Field label="Password" htmlFor="password" error={fieldErrors.password}>
              <div className="relative">
                <LockKey size={18} weight="duotone" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-coral-500" />
                <Input id="password" type="password" autoComplete="current-password" placeholder="Your password" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-11" />
              </div>
            </Field>
            {formError ? (
              <motion.p initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} role="alert" className="rounded-2xl bg-rose-100 px-3.5 py-2.5 text-[13.5px] font-semibold text-rose-700">
                {formError}
              </motion.p>
            ) : null}
            <Button type="submit" size="lg" className="w-full" loading={loading} icon={<ArrowRight size={18} weight="bold" />}>
              Sign in
            </Button>
          </div>
        )}
      </motion.form>

      <motion.p variants={item.fade} className="mt-6 flex items-center justify-center gap-1.5 text-center text-[12.5px] text-ink-500">
        <ShieldCheck size={16} weight="duotone" className="text-teal-600" /> Every action here is written to the audit log.
      </motion.p>
      <motion.p variants={item.fade} className="mt-2 text-center text-[12.5px] text-ink-500">
        <Link href="/" className="font-bold text-coral-600 hover:text-coral-700">
          Back to raahi.pk
        </Link>
      </motion.p>
    </motion.div>
  );
}

export default function AdminLoginPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-paper-50 px-4 py-10">
      <span className="blob left-[6%] top-[10%] h-[360px] w-[360px] bg-coral-100" />
      <span className="blob right-[4%] bottom-[8%] h-[320px] w-[320px] bg-teal-100" style={{ animationDelay: "-7s" }} />
      <Suspense fallback={<div className="shimmer h-80 w-full max-w-[420px] rounded-3xl" />}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
