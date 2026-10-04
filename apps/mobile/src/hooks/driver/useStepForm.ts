/**
 * Form state for the onboarding steps. Values are strings (one per input);
 * `toPayload` shapes them for the shared zod schema (numbers, optional fields
 * as undefined). Errors show per field once touched or after a submit attempt.
 */
import { useCallback, useMemo, useState, type ChangeEvent } from "react";
import type { z } from "zod";

type StringRecord = Record<string, string>;
type Keys<V> = Extract<keyof V, string>;
export type ErrorMap<V> = Partial<Record<Keys<V>, string>>;

export interface StepFieldBinding {
  value: string;
  error: string | null;
  onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onBlur: () => void;
}

export interface StepForm<S extends z.ZodTypeAny, V extends StringRecord> {
  values: V;
  errors: ErrorMap<V>;
  isValid: boolean;
  submitted: boolean;
  set: (key: Keys<V>, value: string) => void;
  setMany: (patch: Partial<V>) => void;
  setError: (key: Keys<V>, message: string | null) => void;
  touch: (key: Keys<V>) => void;
  bind: (key: Keys<V>) => StepFieldBinding;
  /** Marks the form submitted; returns the parsed payload or null. */
  validate: () => z.output<S> | null;
}

export function useStepForm<S extends z.ZodTypeAny, V extends StringRecord>(opts: {
  schema: S;
  initial: V;
  toPayload: (values: V) => unknown;
  /** Cross-field rules keyed by field. Keep the function reference stable (module level or useCallback). */
  extra?: (values: V) => ErrorMap<V>;
}): StepForm<S, V> {
  const { schema, toPayload, extra } = opts;
  const [values, setValues] = useState<V>(opts.initial);
  const [touched, setTouched] = useState<Partial<Record<Keys<V>, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);
  const [serverErrors, setServerErrors] = useState<ErrorMap<V>>({});

  const allErrors = useMemo<ErrorMap<V>>(() => {
    const out: ErrorMap<V> = {};
    const res = schema.safeParse(toPayload(values));
    if (!res.success) {
      for (const issue of res.error.issues) {
        const key = issue.path[0];
        if (typeof key === "string" && !(key in out)) out[key as Keys<V>] = issue.message;
      }
    }
    if (extra) {
      for (const [key, message] of Object.entries(extra(values)) as [Keys<V>, string | undefined][]) {
        if (message && !out[key]) out[key] = message;
      }
    }
    return out;
  }, [schema, toPayload, values, extra]);

  const errors = useMemo<ErrorMap<V>>(() => {
    const out: ErrorMap<V> = {};
    for (const [key, message] of Object.entries(allErrors) as [Keys<V>, string | undefined][]) {
      if (message && (submitted || touched[key])) out[key] = message;
    }
    for (const [key, message] of Object.entries(serverErrors) as [Keys<V>, string | undefined][]) {
      if (message) out[key] = message;
    }
    return out;
  }, [allErrors, touched, submitted, serverErrors]);

  const set = useCallback((key: Keys<V>, value: string) => {
    setValues((s) => ({ ...s, [key]: value }));
    setServerErrors((s) => {
      if (!s[key]) return s;
      const next = { ...s };
      delete next[key];
      return next;
    });
  }, []);

  const setMany = useCallback((p: Partial<V>) => setValues((s) => ({ ...s, ...p })), []);

  const setError = useCallback((key: Keys<V>, message: string | null) => {
    setServerErrors((s) => {
      const next = { ...s };
      if (message) next[key] = message;
      else delete next[key];
      return next;
    });
  }, []);

  const touch = useCallback((key: Keys<V>) => setTouched((t) => (t[key] ? t : { ...t, [key]: true })), []);

  const bind = useCallback(
    (key: Keys<V>): StepFieldBinding => ({
      value: values[key] ?? "",
      error: errors[key] ?? null,
      onChange: (e) => set(key, e.target.value),
      onBlur: () => touch(key),
    }),
    [values, errors, set, touch],
  );

  const validate = useCallback((): z.output<S> | null => {
    setSubmitted(true);
    const res = schema.safeParse(toPayload(values));
    if (!res.success) return null;
    if (extra && Object.values(extra(values)).some(Boolean)) return null;
    return res.data as z.output<S>;
  }, [schema, toPayload, values, extra]);

  return { values, errors, isValid: Object.keys(allErrors).length === 0, submitted, set, setMany, setError, touch, bind, validate };
}
