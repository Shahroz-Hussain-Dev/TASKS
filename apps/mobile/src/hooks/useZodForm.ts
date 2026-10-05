/**
 * Tiny form state for screens that validate with the shared zod schemas.
 * Shows at most one issue per field, only once the field was touched (or the
 * form was submitted), so people are never shouted at while typing.
 */
import { useCallback, useMemo, useState, type ChangeEvent } from "react";
import type { z } from "zod";

type StringRecord = Record<string, string>;
type Keys<V> = Extract<keyof V, string>;
type ErrorMap<V> = Partial<Record<Keys<V>, string>>;

export interface FieldBinding {
  value: string;
  error: string | null;
  onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onBlur: () => void;
}

export interface ZodForm<S extends z.ZodTypeAny, V extends StringRecord> {
  values: V;
  /** Errors currently visible (touched or submitted fields + server errors). */
  errors: ErrorMap<V>;
  /** True when the schema (and extra rules) pass for the current values. */
  isValid: boolean;
  submitted: boolean;
  setField: (key: Keys<V>, value: string) => void;
  setError: (key: Keys<V>, message: string | null) => void;
  touch: (key: Keys<V>) => void;
  bind: (key: Keys<V>) => FieldBinding;
  /** Marks the form submitted; returns the parsed payload or null when invalid. */
  validate: () => z.output<S> | null;
  reset: (next?: V) => void;
}

/**
 * @param schema   zod schema from `@raahi/shared`
 * @param initial  initial string values (one per input)
 * @param extra    optional cross-field rules (e.g. password confirmation). Keep it
 *                 module-level so the reference is stable.
 */
export function useZodForm<S extends z.ZodTypeAny, V extends StringRecord>(schema: S, initial: V, extra?: (values: V) => ErrorMap<V>): ZodForm<S, V> {
  const [values, setValues] = useState<V>(initial);
  const [touched, setTouched] = useState<Partial<Record<Keys<V>, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);
  const [serverErrors, setServerErrors] = useState<ErrorMap<V>>({});

  const allErrors = useMemo<ErrorMap<V>>(() => {
    const out: ErrorMap<V> = {};
    const res = schema.safeParse(values);
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
  }, [schema, values, extra]);

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

  const setField = useCallback((key: Keys<V>, value: string) => {
    setValues((s) => ({ ...s, [key]: value }));
    setServerErrors((s) => {
      if (!s[key]) return s;
      const next = { ...s };
      delete next[key];
      return next;
    });
  }, []);

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
    (key: Keys<V>): FieldBinding => ({
      value: values[key] ?? "",
      error: errors[key] ?? null,
      onChange: (e) => setField(key, e.target.value),
      onBlur: () => touch(key),
    }),
    [values, errors, setField, touch],
  );

  const validate = useCallback((): z.output<S> | null => {
    setSubmitted(true);
    const res = schema.safeParse(values);
    if (!res.success) return null;
    if (extra && Object.values(extra(values)).some(Boolean)) return null;
    return res.data as z.output<S>;
  }, [schema, values, extra]);

  const reset = useCallback(
    (next?: V) => {
      setValues(next ?? initial);
      setTouched({});
      setSubmitted(false);
      setServerErrors({});
    },
    [initial],
  );

  return {
    values,
    errors,
    isValid: Object.keys(allErrors).length === 0,
    submitted,
    setField,
    setError,
    touch,
    bind,
    validate,
    reset,
  };
}
