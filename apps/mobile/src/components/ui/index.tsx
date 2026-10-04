/* eslint-disable react-refresh/only-export-components */
/**
 * Raahi UI primitives. Everything is motion-aware and themed from
 * styles/global.css tokens. Keep this file the single source of truth for
 * controls so screens stay visually consistent.
 */
import { AnimatePresence, motion, useMotionValue, useSpring, useTransform, type HTMLMotionProps } from "framer-motion";
import { Loader2, X, type LucideIcon } from "lucide-react";
import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";
import { cn, initials } from "@/lib/utils";
import { backdropVariants, sheetVariants, spring } from "@/lib/motion";
import { haptic } from "@/lib/native";
import { api } from "@/lib/api";

/* ------------------------------------------------------------------ */
/* Button                                                              */
/* ------------------------------------------------------------------ */

type Variant = "primary" | "secondary" | "ghost" | "danger" | "amber" | "outline";
type Size = "sm" | "md" | "lg" | "xl";

export interface ButtonProps extends Omit<HTMLMotionProps<"button">, "children"> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: LucideIcon;
  iconRight?: LucideIcon;
  full?: boolean;
  children?: ReactNode;
}

const variantCls: Record<Variant, string> = {
  primary: "bg-brand-500 text-ink-950 shadow-glow hover:bg-brand-400 disabled:bg-ink-600 disabled:text-ink-300 disabled:shadow-none",
  secondary: "bg-ink-700 text-ink-50 hover:bg-ink-600 disabled:text-ink-400",
  ghost: "bg-transparent text-ink-200 hover:bg-white/5 disabled:text-ink-500",
  outline: "bg-transparent border border-white/12 text-ink-100 hover:bg-white/5 disabled:text-ink-500",
  danger: "bg-rose-500/15 text-rose-400 border border-rose-500/30 hover:bg-rose-500/25",
  amber: "bg-amber-400 text-ink-950 hover:bg-amber-300 disabled:bg-ink-600 disabled:text-ink-300",
};
const sizeCls: Record<Size, string> = {
  sm: "h-9 px-3.5 text-[13px] rounded-xl gap-1.5",
  md: "h-11 px-4 text-[15px] rounded-2xl gap-2",
  lg: "h-13 px-5 text-base rounded-2xl gap-2",
  xl: "h-14 px-6 text-[17px] rounded-[20px] gap-2.5",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "lg", loading, icon: Icon, iconRight: IconRight, full, className, children, disabled, onClick, ...rest },
  ref,
) {
  return (
    <motion.button
      ref={ref}
      whileTap={disabled || loading ? undefined : { scale: 0.97 }}
      transition={spring}
      disabled={disabled || loading}
      onClick={(e) => {
        haptic.light();
        onClick?.(e);
      }}
      className={cn(
        "relative inline-flex items-center justify-center font-semibold select-none transition-colors duration-200 disabled:cursor-not-allowed",
        variantCls[variant],
        sizeCls[size],
        full && "w-full",
        className,
      )}
      {...rest}
    >
      <AnimatePresence initial={false} mode="wait">
        {loading ? (
          <motion.span key="l" initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.6 }} className="inline-flex items-center gap-2">
            <Loader2 className="size-5 animate-spin" />
          </motion.span>
        ) : (
          <motion.span key="c" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="inline-flex items-center gap-2">
            {Icon && <Icon className="size-5" strokeWidth={2.2} />}
            {children}
            {IconRight && <IconRight className="size-5" strokeWidth={2.2} />}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
});

export function IconButton({
  icon: Icon,
  label,
  className,
  size = 44,
  variant = "glass",
  ...rest
}: { icon: LucideIcon; label: string; size?: number; variant?: "glass" | "solid" | "ghost" | "brand" } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children">) {
  return (
    <motion.button
      whileTap={{ scale: 0.9 }}
      transition={spring}
      aria-label={label}
      style={{ width: size, height: size }}
      className={cn(
        "inline-flex items-center justify-center rounded-full",
        variant === "glass" && "glass text-ink-50 shadow-card",
        variant === "solid" && "bg-ink-700 text-ink-50",
        variant === "ghost" && "text-ink-200 hover:bg-white/5",
        variant === "brand" && "bg-brand-500 text-ink-950 shadow-glow",
        className,
      )}
      {...(rest as HTMLMotionProps<"button">)}
    >
      <Icon className="size-[22px]" strokeWidth={2.2} />
    </motion.button>
  );
}

/* ------------------------------------------------------------------ */
/* Card                                                                */
/* ------------------------------------------------------------------ */

export function Card({ className, children, glass, onClick, ...rest }: HTMLMotionProps<"div"> & { glass?: boolean }) {
  return (
    <motion.div
      whileTap={onClick ? { scale: 0.985 } : undefined}
      transition={spring}
      onClick={onClick}
      className={cn("rounded-3xl p-4", glass ? "glass shadow-card" : "bg-ink-800 border border-white/6 shadow-card", onClick && "cursor-pointer", className)}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Inputs                                                              */
/* ------------------------------------------------------------------ */

interface FieldProps {
  label?: string;
  hint?: string;
  error?: string | null;
  children: ReactNode;
  className?: string;
  htmlFor?: string;
}

export function Field({ label, hint, error, children, className, htmlFor }: FieldProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && (
        <label htmlFor={htmlFor} className="text-[13px] font-semibold text-ink-300 tracking-wide">
          {label}
        </label>
      )}
      {children}
      <AnimatePresence initial={false}>
        {(error || hint) && (
          <motion.p
            key={error ? "e" : "h"}
            initial={{ opacity: 0, y: -4, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -4, height: 0 }}
            className={cn("text-[12.5px] leading-snug", error ? "text-rose-400" : "text-ink-400")}
          >
            {error ?? hint}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string | null;
  icon?: LucideIcon;
  prefix?: string;
  right?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ label, hint, error, icon: Icon, prefix, right, className, id, ...rest }, ref) {
  const auto = useId();
  const inputId = id ?? auto;
  return (
    <Field label={label} hint={hint} error={error} htmlFor={inputId}>
      <div
        className={cn(
          "flex items-center gap-2.5 h-13 rounded-2xl px-4 bg-ink-800 border transition-colors",
          error ? "border-rose-500/60" : "border-white/8 focus-within:border-brand-500/70 focus-within:bg-ink-700/70",
          className,
        )}
      >
        {Icon && <Icon className="size-5 text-ink-400 shrink-0" />}
        {prefix && <span className="text-ink-300 font-medium">{prefix}</span>}
        <input
          id={inputId}
          ref={ref}
          className="flex-1 bg-transparent outline-none text-[16px] text-ink-50 placeholder:text-ink-500 min-w-0"
          {...rest}
        />
        {right}
      </div>
    </Field>
  );
});

export const TextArea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; hint?: string; error?: string | null }>(function TextArea(
  { label, hint, error, className, id, ...rest },
  ref,
) {
  const auto = useId();
  return (
    <Field label={label} hint={hint} error={error} htmlFor={id ?? auto}>
      <textarea
        id={id ?? auto}
        ref={ref}
        className={cn(
          "w-full rounded-2xl px-4 py-3 bg-ink-800 border border-white/8 focus:border-brand-500/70 outline-none text-[16px] text-ink-50 placeholder:text-ink-500 resize-none min-h-24",
          className,
        )}
        {...rest}
      />
    </Field>
  );
});

/* ------------------------------------------------------------------ */
/* Chips & badges                                                      */
/* ------------------------------------------------------------------ */

export function Chip({ active, children, className, onClick, icon: Icon }: { active?: boolean; children: ReactNode; className?: string; onClick?: () => void; icon?: LucideIcon }) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.94 }}
      transition={spring}
      onClick={() => {
        haptic.tick();
        onClick?.();
      }}
      className={cn(
        "inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full text-[13.5px] font-semibold border transition-colors",
        active ? "bg-brand-500 text-ink-950 border-brand-500" : "bg-white/4 text-ink-200 border-white/8 hover:bg-white/8",
        className,
      )}
    >
      {Icon && <Icon className="size-4" />}
      {children}
    </motion.button>
  );
}

export function Badge({ children, tone = "neutral", className }: { children: ReactNode; tone?: "neutral" | "brand" | "amber" | "rose" | "sky" | "violet"; className?: string }) {
  const tones = {
    neutral: "bg-white/6 text-ink-200",
    brand: "bg-brand-500/15 text-brand-400",
    amber: "bg-amber-400/15 text-amber-300",
    rose: "bg-rose-500/15 text-rose-400",
    sky: "bg-sky-400/15 text-sky-400",
    violet: "bg-violet-400/15 text-violet-400",
  };
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-bold tracking-wide uppercase", tones[tone], className)}>{children}</span>;
}

/* ------------------------------------------------------------------ */
/* Avatar with authenticated image                                     */
/* ------------------------------------------------------------------ */

const blobCache = new Map<string, string>();

/** <img> that fetches through the API with the bearer token. */
export function AuthImage({ src, alt, className, fallback }: { src: string | null | undefined; alt: string; className?: string; fallback?: ReactNode }) {
  const [url, setUrl] = useState<string | null>(src ? blobCache.get(src) ?? null : null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!src) return;
    const cached = blobCache.get(src);
    if (cached) {
      setUrl(cached);
      return;
    }
    let cancelled = false;
    const abs = api.files.url(src);
    if (!abs) return;
    const tokens = (window as unknown as { __raahiTokens?: { accessToken?: string } }).__raahiTokens;
    void tokens;
    import("@/lib/api").then(({ getTokens }) => {
      const t = getTokens();
      fetch(abs, { headers: t?.accessToken ? { Authorization: `Bearer ${t.accessToken}` } : {} })
        .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))))
        .then((b) => {
          const u = URL.createObjectURL(b);
          blobCache.set(src, u);
          if (!cancelled) setUrl(u);
        })
        .catch(() => !cancelled && setFailed(true));
    });
    return () => {
      cancelled = true;
    };
  }, [src]);
  if (!src || failed) return <>{fallback ?? null}</>;
  return (
    <AnimatePresence>
      {url && <motion.img key={url} src={url} alt={alt} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={cn("object-cover", className)} />}
    </AnimatePresence>
  );
}

export function Avatar({ name, src, size = 44, className, ring }: { name: string; src?: string | null; size?: number; className?: string; ring?: boolean }) {
  return (
    <div
      style={{ width: size, height: size, fontSize: size * 0.36 }}
      className={cn(
        "relative shrink-0 rounded-full overflow-hidden bg-gradient-to-br from-ink-600 to-ink-700 text-ink-100 font-bold flex items-center justify-center font-display",
        ring && "ring-2 ring-brand-500/70 ring-offset-2 ring-offset-ink-900",
        className,
      )}
    >
      <span className="absolute inset-0 flex items-center justify-center">{initials(name)}</span>
      <AuthImage src={src} alt={name} className="absolute inset-0 w-full h-full" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Skeleton / Spinner / Empty                                          */
/* ------------------------------------------------------------------ */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("shimmer rounded-xl bg-white/5", className)} />;
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("size-6 animate-spin text-brand-400", className)} />;
}

export function EmptyState({ icon: Icon, title, body, action }: { icon: LucideIcon; title: string; body?: string; action?: ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={spring} className="flex flex-col items-center text-center px-8 py-12 gap-3">
      <div className="size-16 rounded-3xl glass flex items-center justify-center text-brand-400 shadow-card">
        <Icon className="size-7" />
      </div>
      <h3 className="font-display text-lg font-semibold text-ink-50">{title}</h3>
      {body && <p className="text-ink-400 text-[14px] leading-relaxed max-w-xs">{body}</p>}
      {action && <div className="mt-2">{action}</div>}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Animated money                                                      */
/* ------------------------------------------------------------------ */

export function Money({ value, className, prefix = "PKR " }: { value: number; className?: string; prefix?: string }) {
  const mv = useMotionValue(value);
  const sp = useSpring(mv, { stiffness: 180, damping: 26 });
  const text = useTransform(sp, (v) => `${prefix}${Math.round(v).toLocaleString("en-PK")}`);
  useEffect(() => {
    mv.set(value);
  }, [value, mv]);
  return <motion.span className={cn("tabular-nums font-display", className)}>{text}</motion.span>;
}

/* ------------------------------------------------------------------ */
/* Segmented control                                                   */
/* ------------------------------------------------------------------ */

export function Segmented<T extends string>({ value, onChange, options, className }: { value: T; onChange: (v: T) => void; options: { value: T; label: string; icon?: LucideIcon }[]; className?: string }) {
  const id = useId();
  return (
    <div className={cn("relative grid rounded-2xl bg-ink-800 border border-white/6 p-1", className)} style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => {
              haptic.tick();
              onChange(o.value);
            }}
            className={cn("relative z-10 h-10 rounded-xl text-[14px] font-semibold transition-colors flex items-center justify-center gap-1.5", active ? "text-ink-950" : "text-ink-300")}
          >
            {active && <motion.span layoutId={`seg-${id}`} transition={spring} className="absolute inset-0 rounded-xl bg-brand-500 shadow-glow" />}
            <span className="relative flex items-center gap-1.5">
              {o.icon && <o.icon className="size-4" />}
              {o.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Star rating                                                         */
/* ------------------------------------------------------------------ */

export function Stars({ value, onChange, size = 36, className }: { value: number; onChange?: (v: number) => void; size?: number; className?: string }) {
  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <motion.button
          key={n}
          type="button"
          disabled={!onChange}
          whileTap={onChange ? { scale: 0.85 } : undefined}
          animate={{ scale: n <= value ? 1 : 0.9, opacity: n <= value ? 1 : 0.4 }}
          transition={spring}
          onClick={() => {
            haptic.tick();
            onChange?.(n);
          }}
          aria-label={`${n} stars`}
        >
          <svg width={size} height={size} viewBox="0 0 24 24" fill={n <= value ? "#fbbf24" : "none"} stroke={n <= value ? "#fbbf24" : "#64748b"} strokeWidth={1.8}>
            <path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.5L12 17.3l-5.9 3.2 1.3-6.5L2.5 9.4l6.6-.8z" strokeLinejoin="round" />
          </svg>
        </motion.button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Bottom sheet                                                        */
/* ------------------------------------------------------------------ */

export function Sheet({
  open,
  onClose,
  title,
  children,
  dismissible = true,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  dismissible?: boolean;
  className?: string;
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="bd"
            variants={backdropVariants}
            initial="hidden"
            animate="show"
            exit="exit"
            onClick={dismissible ? onClose : undefined}
            className="fixed inset-0 z-40 bg-ink-950/70 backdrop-blur-[2px]"
          />
          <motion.div
            key="sheet"
            variants={sheetVariants}
            initial="hidden"
            animate="show"
            exit="exit"
            drag={dismissible ? "y" : false}
            dragConstraints={{ top: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => {
              if (dismissible && (info.offset.y > 120 || info.velocity.y > 600)) onClose();
            }}
            className={cn("fixed inset-x-0 bottom-0 z-50 rounded-t-[28px] bg-ink-800 border-t border-white/8 shadow-float", className)}
            style={{ paddingBottom: "calc(var(--safe-bottom) + 16px)" }}
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="h-1.5 w-12 rounded-full bg-white/15" />
            </div>
            {(title || dismissible) && (
              <div className="flex items-center justify-between px-5 pt-1 pb-2">
                <h2 className="font-display text-lg font-semibold text-ink-50">{title}</h2>
                {dismissible && <IconButton icon={X} label="Close" size={36} variant="ghost" onClick={onClose} />}
              </div>
            )}
            <div className="px-5 max-h-[78vh] overflow-y-auto no-scrollbar">{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* ------------------------------------------------------------------ */
/* Toasts                                                              */
/* ------------------------------------------------------------------ */

type Toast = { id: number; title: string; body?: string; tone: "neutral" | "success" | "error" | "brand" };
const ToastCtx = createContext<{ push: (t: Omit<Toast, "id">) => void } | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);
  const push = useCallback((t: Omit<Toast, "id">) => {
    const id = ++counter.current;
    setToasts((xs) => [...xs.slice(-2), { ...t, id }]);
    if (t.tone === "error") haptic.error();
    else if (t.tone === "success") haptic.success();
    setTimeout(() => setToasts((xs) => xs.filter((x) => x.id !== id)), 3600);
  }, []);
  const value = useMemo(() => ({ push }), [push]);
  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className="fixed inset-x-0 z-[60] flex flex-col items-center gap-2 px-4 pointer-events-none" style={{ top: "calc(var(--safe-top) + 12px)" }}>
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: -24, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -16, scale: 0.95 }}
              transition={spring}
              className={cn(
                "pointer-events-auto w-full max-w-sm rounded-2xl px-4 py-3 glass shadow-float border-l-4",
                t.tone === "success" && "border-l-brand-500",
                t.tone === "error" && "border-l-rose-500",
                t.tone === "brand" && "border-l-amber-400",
                t.tone === "neutral" && "border-l-ink-400",
              )}
            >
              <p className="text-[14px] font-semibold text-ink-50">{t.title}</p>
              {t.body && <p className="text-[13px] text-ink-300 mt-0.5 leading-snug">{t.body}</p>}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx.push;
}

/* ------------------------------------------------------------------ */
/* Screen scaffold                                                     */
/* ------------------------------------------------------------------ */

export function Screen({ children, className, padded = true, scroll = true }: { children: ReactNode; className?: string; padded?: boolean; scroll?: boolean }) {
  return (
    <div
      className={cn("relative h-full w-full flex flex-col", scroll ? "overflow-y-auto no-scrollbar" : "overflow-hidden", padded && "px-5", className)}
      style={{ paddingTop: padded ? "calc(var(--safe-top) + 12px)" : undefined, paddingBottom: padded ? "calc(var(--safe-bottom) + 24px)" : undefined }}
    >
      {children}
    </div>
  );
}

export function TopBar({ title, left, right, subtitle, className }: { title?: ReactNode; subtitle?: ReactNode; left?: ReactNode; right?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-center gap-3 min-h-12 mb-2", className)}>
      {left}
      <div className="flex-1 min-w-0">
        {typeof title === "string" ? <h1 className="font-display text-[22px] font-semibold text-ink-50 truncate">{title}</h1> : title}
        {subtitle && <p className="text-[13px] text-ink-400 truncate">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

export function Divider({ className }: { className?: string }) {
  return <div className={cn("h-px bg-white/6", className)} />;
}

export function Row({ icon: Icon, label, value, onClick, danger, right }: { icon?: LucideIcon; label: string; value?: ReactNode; onClick?: () => void; danger?: boolean; right?: ReactNode }) {
  return (
    <motion.button
      type="button"
      whileTap={onClick ? { scale: 0.985, backgroundColor: "rgba(255,255,255,0.04)" } : undefined}
      transition={spring}
      onClick={onClick}
      disabled={!onClick}
      className={cn("w-full flex items-center gap-3 px-1 py-3.5 text-left rounded-xl", danger ? "text-rose-400" : "text-ink-100")}
    >
      {Icon && (
        <span className={cn("size-9 rounded-xl flex items-center justify-center", danger ? "bg-rose-500/10" : "bg-white/5")}>
          <Icon className="size-[18px]" />
        </span>
      )}
      <span className="flex-1 text-[15px] font-medium">{label}</span>
      {value && <span className="text-[14px] text-ink-400">{value}</span>}
      {right}
    </motion.button>
  );
}
