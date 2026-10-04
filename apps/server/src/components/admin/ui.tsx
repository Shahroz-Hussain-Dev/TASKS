"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, ChevronLeft, ChevronRight, Inbox, Loader2, RotateCcw, Search, X } from "lucide-react";
import Link from "next/link";
import { forwardRef, useEffect, useId, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { errorMessage } from "@/lib/admin-client";
import { cn, initials, type Tone } from "./format";
import { spring, springSoft } from "./motion";

/* ------------------------------------------------------------------ */
/* Buttons                                                             */
/* ------------------------------------------------------------------ */

type Variant = "primary" | "secondary" | "ghost" | "danger" | "amber";
type Size = "sm" | "md" | "lg";

const VARIANT: Record<Variant, string> = {
  primary: "bg-brand-500 text-ink-950 hover:bg-brand-400 shadow-glow disabled:shadow-none",
  secondary: "bg-ink-700 text-ink-50 hover:bg-ink-600 border border-white/6",
  ghost: "bg-transparent text-ink-200 hover:bg-white/5",
  danger: "bg-rose-500/15 text-rose-400 hover:bg-rose-500/25 border border-rose-500/20",
  amber: "bg-amber-400/15 text-amber-300 hover:bg-amber-400/25 border border-amber-400/20",
};
const SIZE: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px] gap-1.5 rounded-xl",
  md: "h-10 px-4 text-sm gap-2 rounded-2xl",
  lg: "h-12 px-5 text-[15px] gap-2 rounded-2xl",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading = false, icon, className, children, disabled, type = "button", ...rest },
  ref,
) {
  return (
    <motion.button
      ref={ref}
      type={type}
      whileTap={{ scale: 0.97 }}
      transition={spring}
      disabled={disabled || loading}
      className={cn(
        "inline-flex select-none items-center justify-center font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        VARIANT[variant],
        SIZE[size],
        className,
      )}
      {...(rest as object)}
    >
      {loading ? <Loader2 size={16} className="animate-spin" /> : icon}
      {children}
    </motion.button>
  );
});

export function IconButton({ label, className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.92 }}
      transition={spring}
      aria-label={label}
      title={label}
      className={cn("grid h-9 w-9 place-items-center rounded-xl text-ink-300 transition-colors hover:bg-white/6 hover:text-ink-50 disabled:opacity-40", className)}
      {...(rest as object)}
    >
      {children}
    </motion.button>
  );
}

/* ------------------------------------------------------------------ */
/* Form controls                                                       */
/* ------------------------------------------------------------------ */

const control =
  "w-full rounded-2xl border border-white/8 bg-ink-900/70 px-3.5 text-[15px] text-ink-50 placeholder:text-ink-500 outline-none transition-colors focus:border-brand-500/60 focus:bg-ink-900 disabled:opacity-50";

export interface FieldProps {
  label?: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
  htmlFor?: string;
}

export function Field({ label, hint, error, children, className, htmlFor }: FieldProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label ? (
        <label htmlFor={htmlFor} className="text-[12.5px] font-semibold uppercase tracking-wide text-ink-400">
          {label}
        </label>
      ) : null}
      {children}
      {error ? <p className="text-[12.5px] text-rose-400">{error}</p> : hint ? <p className="text-[12.5px] text-ink-500">{hint}</p> : null}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cn(control, "h-11", className)} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={cn(control, "min-h-[96px] py-2.5 leading-relaxed", className)} {...rest} />;
});

const CHEVRON = "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='m6 9 6 6 6-6'/></svg>\")";

export function Select({ className, children, style, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(control, "h-11 appearance-none pr-9", className)}
      style={{ backgroundImage: CHEVRON, backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center", backgroundSize: "16px", ...style }}
      {...rest}
    >
      {children}
    </select>
  );
}

export function Toggle({ checked, onChange, label, description, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 rounded-2xl border border-white/6 bg-ink-900/50 px-4 py-3 text-left transition-colors hover:bg-ink-900/80 disabled:opacity-50"
    >
      <span className="min-w-0">
        <span className="block text-[15px] font-semibold text-ink-50">{label}</span>
        {description ? <span className="mt-0.5 block text-[13px] text-ink-400">{description}</span> : null}
      </span>
      <span className={cn("relative h-7 w-12 shrink-0 rounded-full transition-colors", checked ? "bg-brand-500" : "bg-ink-600")}>
        <motion.span layout transition={spring} className={cn("absolute top-1 h-5 w-5 rounded-full bg-white shadow", checked ? "left-6" : "left-1")} />
      </span>
    </button>
  );
}

export function SearchInput({ value, onChange, placeholder = "Search", className }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  return (
    <div className={cn("relative", className)}>
      <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-500" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={cn(control, "h-10 pl-10 pr-9 text-sm")} />
      {value ? (
        <button type="button" onClick={() => onChange("")} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1 text-ink-500 hover:text-ink-100">
          <X size={14} />
        </button>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Chips / badges                                                      */
/* ------------------------------------------------------------------ */

const TONE_BADGE: Record<Tone, string> = {
  neutral: "bg-ink-600/60 text-ink-200",
  brand: "bg-brand-500/15 text-brand-300",
  amber: "bg-amber-400/15 text-amber-300",
  rose: "bg-rose-500/15 text-rose-400",
  sky: "bg-sky-400/15 text-sky-400",
  violet: "bg-violet-400/15 text-violet-400",
};
const TONE_DOT: Record<Tone, string> = {
  neutral: "bg-ink-300",
  brand: "bg-brand-400",
  amber: "bg-amber-400",
  rose: "bg-rose-400",
  sky: "bg-sky-400",
  violet: "bg-violet-400",
};

export function Badge({ tone = "neutral", children, dot, className }: { tone?: Tone; children: ReactNode; dot?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[12px] font-semibold", TONE_BADGE[tone], className)}>
      {dot ? <span className={cn("h-1.5 w-1.5 rounded-full", TONE_DOT[tone])} /> : null}
      {children}
    </span>
  );
}

export interface ChipOption<T extends string> {
  value: T;
  label: string;
  count?: number;
}

export function Chips<T extends string>({ value, onChange, options, layoutId }: { value: T; onChange: (v: T) => void; options: ChipOption<T>[]; layoutId: string }) {
  return (
    <div className="no-scrollbar flex gap-1.5 overflow-x-auto rounded-2xl bg-ink-900/60 p-1">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn("relative flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-[13px] font-semibold transition-colors", active ? "text-ink-950" : "text-ink-300 hover:text-ink-50")}
          >
            {active ? <motion.span layoutId={layoutId} transition={spring} className="absolute inset-0 rounded-xl bg-brand-400" /> : null}
            <span className="relative">{o.label}</span>
            {o.count !== undefined ? (
              <span className={cn("relative rounded-full px-1.5 text-[11px]", active ? "bg-ink-950/15 text-ink-950" : "bg-white/6 text-ink-300")}>{o.count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Surfaces                                                            */
/* ------------------------------------------------------------------ */

export function Card({ className, children, title, subtitle, action, padded = true }: { className?: string; children: ReactNode; title?: ReactNode; subtitle?: ReactNode; action?: ReactNode; padded?: boolean }) {
  return (
    <section className={cn("rounded-3xl border border-white/6 bg-ink-800 shadow-card", padded && "p-5", className)}>
      {title || action ? (
        <header className={cn("flex items-start justify-between gap-3", padded ? "mb-4" : "px-5 pt-5 pb-3")}>
          <div className="min-w-0">
            {title ? <h2 className="font-display text-[17px] font-semibold text-ink-50">{title}</h2> : null}
            {subtitle ? <p className="mt-0.5 text-[13px] text-ink-400">{subtitle}</p> : null}
          </div>
          {action}
        </header>
      ) : null}
      {children}
    </section>
  );
}

export function PageHeader({ title, subtitle, actions, back }: { title: string; subtitle?: ReactNode; actions?: ReactNode; back?: { href: string; label: string } }) {
  return (
    <motion.div initial={{ opacity: 0, y: -14 }} animate={{ opacity: 1, y: 0 }} transition={spring} className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {back ? (
          <Link href={back.href} className="mb-2 inline-flex items-center gap-1 text-[13px] font-semibold text-brand-400 hover:text-brand-300">
            <ChevronLeft size={16} /> {back.label}
          </Link>
        ) : null}
        <h1 className="font-display text-[28px] font-semibold leading-tight text-ink-50">{title}</h1>
        {subtitle ? <p className="mt-1 text-[14px] text-ink-400">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </motion.div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("shimmer rounded-xl bg-white/5", className)} />;
}

export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="divide-y divide-white/5">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="grid gap-4 px-5 py-4" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {Array.from({ length: cols }).map((__, c) => (
            <Skeleton key={c} className={cn("h-4", c === 0 ? "w-3/4" : "w-1/2")} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ icon, title, description, action, className }: { icon?: ReactNode; title: string; description?: string; action?: ReactNode; className?: string }) {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={springSoft} className={cn("relative flex flex-col items-center justify-center overflow-hidden px-6 py-14 text-center", className)}>
      <span className="aurora -left-10 top-0 h-40 w-40 bg-brand-500/30" />
      <span className="aurora -right-10 bottom-0 h-40 w-40 bg-violet-400/20" style={{ animationDelay: "-6s" }} />
      <div className="relative grid h-14 w-14 place-items-center rounded-2xl bg-ink-700 text-ink-300">{icon ?? <Inbox size={24} />}</div>
      <h3 className="relative mt-4 font-display text-[17px] font-semibold text-ink-50">{title}</h3>
      {description ? <p className="relative mt-1 max-w-sm text-[14px] text-ink-400">{description}</p> : null}
      {action ? <div className="relative mt-5">{action}</div> : null}
    </motion.div>
  );
}

export function ErrorState({ error, onRetry, className }: { error: unknown; onRetry?: () => void; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-12 text-center", className)}>
      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-rose-500/15 text-rose-400">
        <AlertTriangle size={22} />
      </div>
      <h3 className="mt-4 font-display text-[16px] font-semibold text-ink-50">Couldn&apos;t load this</h3>
      <p className="mt-1 max-w-sm text-[14px] text-ink-400">{errorMessage(error)}</p>
      {onRetry ? (
        <Button variant="secondary" size="sm" className="mt-4" icon={<RotateCcw size={14} />} onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}

export function Avatar({ name, src, size = 36, className }: { name: string | null | undefined; src?: string | null; size?: number; className?: string }) {
  return (
    <span className={cn("relative grid shrink-0 place-items-center overflow-hidden rounded-full bg-ink-600 font-display text-[12px] font-semibold text-ink-100", className)} style={{ width: size, height: size }}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name ?? ""} width={size} height={size} className="h-full w-full object-cover" />
      ) : (
        initials(name)
      )}
    </span>
  );
}

export function KeyValue({ items, columns = 2 }: { items: { label: string; value: ReactNode }[]; columns?: 1 | 2 | 3 }) {
  return (
    <dl className={cn("grid gap-x-6 gap-y-4", columns === 1 ? "grid-cols-1" : columns === 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-3")}>
      {items.map((it) => (
        <div key={it.label} className="min-w-0">
          <dt className="text-[12px] font-semibold uppercase tracking-wide text-ink-500">{it.label}</dt>
          <dd className="mt-0.5 break-words text-[15px] text-ink-100">{it.value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

/* ------------------------------------------------------------------ */
/* Table                                                               */
/* ------------------------------------------------------------------ */

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full min-w-[640px] border-collapse text-left text-[14px]">{children}</table>
    </div>
  );
}

export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return <th className={cn("sticky top-0 z-10 bg-ink-800 px-5 py-3 text-[12px] font-semibold uppercase tracking-wide text-ink-500", className)}>{children}</th>;
}

export function Td({ children, className, colSpan }: { children?: ReactNode; className?: string; colSpan?: number }) {
  return (
    <td colSpan={colSpan} className={cn("border-t border-white/5 px-5 py-3.5 align-middle text-ink-200", className)}>
      {children}
    </td>
  );
}

export function Pagination({ page, pageSize, total, onChange }: { page: number; pageSize: number; total: number; onChange: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/5 px-5 py-3 text-[13px] text-ink-400">
      <span>
        {total === 0 ? "No results" : `Showing ${from}–${to} of ${total.toLocaleString("en-PK")}`}
      </span>
      <div className="flex items-center gap-1">
        <IconButton label="Previous page" disabled={page <= 1} onClick={() => onChange(page - 1)} className="h-8 w-8">
          <ChevronLeft size={16} />
        </IconButton>
        <span className="min-w-[72px] text-center font-semibold text-ink-200">
          {page} / {pages}
        </span>
        <IconButton label="Next page" disabled={page >= pages} onClick={() => onChange(page + 1)} className="h-8 w-8">
          <ChevronRight size={16} />
        </IconButton>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Overlays                                                            */
/* ------------------------------------------------------------------ */

function useEscape(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
}

export function Modal({ open, onClose, title, description, children, footer, width = "max-w-lg" }: { open: boolean; onClose: () => void; title: string; description?: string; children?: ReactNode; footer?: ReactNode; width?: string }) {
  useEscape(open, onClose);
  const id = useId();
  return (
    <AnimatePresence>
      {open ? (
        <motion.div key="modal" className="fixed inset-0 z-[90] flex items-end justify-center p-4 sm:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-ink-950/70 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={id}
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98, transition: { duration: 0.16 } }}
            transition={springSoft}
            className={cn("relative w-full rounded-3xl border border-white/8 bg-ink-800 p-6 shadow-float", width)}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id={id} className="font-display text-[20px] font-semibold text-ink-50">
                  {title}
                </h2>
                {description ? <p className="mt-1 text-[14px] text-ink-400">{description}</p> : null}
              </div>
              <IconButton label="Close" onClick={onClose}>
                <X size={18} />
              </IconButton>
            </div>
            {children ? <div className="mt-5">{children}</div> : null}
            {footer ? <div className="mt-6 flex flex-wrap justify-end gap-2">{footer}</div> : null}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export function Drawer({ open, onClose, title, subtitle, children, width = "max-w-xl" }: { open: boolean; onClose: () => void; title: ReactNode; subtitle?: ReactNode; children: ReactNode; width?: string }) {
  useEscape(open, onClose);
  return (
    <AnimatePresence>
      {open ? (
        <motion.div key="drawer" className="fixed inset-0 z-[80] flex justify-end" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-ink-950/60 backdrop-blur-sm" onClick={onClose} />
          <motion.aside
            role="dialog"
            aria-modal="true"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%", transition: { duration: 0.22, ease: [0.4, 0, 1, 1] } }}
            transition={springSoft}
            className={cn("relative flex h-full w-full flex-col border-l border-white/8 bg-ink-900 shadow-float", width)}
          >
            <header className="flex items-start justify-between gap-4 border-b border-white/6 px-6 py-4">
              <div className="min-w-0">
                <h2 className="font-display text-[18px] font-semibold text-ink-50">{title}</h2>
                {subtitle ? <p className="mt-0.5 text-[13px] text-ink-400">{subtitle}</p> : null}
              </div>
              <IconButton label="Close" onClick={onClose}>
                <X size={18} />
              </IconButton>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
          </motion.aside>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

/** Confirmation dialog with an optional reason textarea. */
export function ReasonDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  tone = "primary",
  reasonLabel = "Reason",
  reasonPlaceholder,
  reasonRequired = false,
  reason,
  onReasonChange,
  loading,
  maxLength = 500,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  confirmLabel: string;
  tone?: Variant;
  reasonLabel?: string;
  reasonPlaceholder?: string;
  reasonRequired?: boolean;
  reason: string;
  onReasonChange: (v: string) => void;
  loading?: boolean;
  maxLength?: number;
}) {
  const invalid = reasonRequired && reason.trim().length === 0;
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant={tone} onClick={onConfirm} loading={loading} disabled={invalid}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <Field label={reasonRequired ? reasonLabel : `${reasonLabel} (optional)`} hint={`${reason.length}/${maxLength}`}>
        <Textarea value={reason} onChange={(e) => onReasonChange(e.target.value.slice(0, maxLength))} placeholder={reasonPlaceholder} autoFocus />
      </Field>
    </Modal>
  );
}
