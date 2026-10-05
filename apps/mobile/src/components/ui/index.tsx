/* eslint-disable react-refresh/only-export-components */
/**
 * Raahi UI primitives — "Sunrise" edition. Light, warm, tactile. Every control
 * is motion-aware and themed from styles/global.css tokens. Keep this file the
 * single source of truth so screens stay visually consistent.
 */
import { AnimatePresence, motion, useMotionValue, useSpring, useTransform, type HTMLMotionProps } from "framer-motion";
import { CircleNotch, X } from "@phosphor-icons/react";
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
  type ComponentType,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";
import { cn, initials } from "@/lib/utils";
import { backdropVariants, sheetVariants, spring, springJelly } from "@/lib/motion";
import { haptic } from "@/lib/native";
import { api, getTokens } from "@/lib/api";

/** Any icon component (Phosphor duotone preferred). */
export type IconComponent = ComponentType<{ className?: string; size?: number | string; weight?: "thin" | "light" | "regular" | "bold" | "fill" | "duotone"; color?: string }>;

/* ------------------------------------------------------------------ */
/* Button                                                              */
/* ------------------------------------------------------------------ */

type Variant = "primary" | "secondary" | "ghost" | "danger" | "amber" | "outline" | "teal" | "ink";
type Size = "sm" | "md" | "lg" | "xl";

export interface ButtonProps extends Omit<HTMLMotionProps<"button">, "children"> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: IconComponent;
  iconRight?: IconComponent;
  full?: boolean;
  children?: ReactNode;
}

const variantCls: Record<Variant, string> = {
  primary: "jelly jelly-coral disabled:bg-ink-200 disabled:text-ink-400 disabled:[--jelly-edge:#cfc9d9]",
  teal: "jelly jelly-teal disabled:bg-ink-200 disabled:text-ink-400 disabled:[--jelly-edge:#cfc9d9]",
  amber: "jelly jelly-sun disabled:bg-ink-200 disabled:text-ink-400 disabled:[--jelly-edge:#cfc9d9]",
  ink: "jelly jelly-ink disabled:bg-ink-200 disabled:text-ink-400 disabled:[--jelly-edge:#cfc9d9]",
  secondary: "jelly jelly-cream text-ink-800 disabled:text-ink-400",
  outline: "jelly jelly-white text-ink-800 border border-paper-200 disabled:text-ink-400",
  ghost: "bg-transparent text-ink-600 hover:bg-paper-100 disabled:text-ink-300",
  danger: "jelly jelly-rose disabled:bg-ink-200 disabled:text-ink-400",
};
const sizeCls: Record<Size, string> = {
  sm: "h-10 px-4 text-[13.5px] rounded-full gap-1.5",
  md: "h-12 px-5 text-[15px] rounded-full gap-2",
  lg: "h-14 px-6 text-[16px] rounded-full gap-2",
  xl: "h-[60px] px-7 text-[17px] rounded-full gap-2.5",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "lg", loading, icon: Icon, iconRight: IconRight, full, className, children, disabled, onClick, ...rest },
  ref,
) {
  return (
    <motion.button
      ref={ref}
      whileTap={disabled || loading ? undefined : { scale: 0.97 }}
      transition={springJelly}
      disabled={disabled || loading}
      onClick={(e) => {
        haptic.light();
        onClick?.(e);
      }}
      className={cn(
        "relative inline-flex items-center justify-center font-display font-semibold tracking-wide select-none transition-colors duration-200 disabled:cursor-not-allowed",
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
            <CircleNotch className="size-5 animate-spin" weight="bold" />
          </motion.span>
        ) : (
          <motion.span key="c" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="inline-flex items-center gap-2">
            {Icon && <Icon className="size-5" weight="bold" />}
            {children}
            {IconRight && <IconRight className="size-5" weight="bold" />}
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
  size = 48,
  variant = "glass",
  weight = "duotone",
  ...rest
}: { icon: IconComponent; label: string; size?: number; variant?: "glass" | "solid" | "ghost" | "brand" | "coral" | "teal"; weight?: "duotone" | "bold" | "fill" | "regular" } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children">) {
  return (
    <motion.button
      whileTap={{ scale: 0.9 }}
      transition={springJelly}
      aria-label={label}
      style={{ width: size, height: size }}
      className={cn(
        "inline-flex items-center justify-center rounded-full",
        variant === "glass" && "glass text-ink-800",
        variant === "solid" && "jelly jelly-white text-ink-800",
        variant === "ghost" && "text-ink-600 hover:bg-paper-100",
        (variant === "brand" || variant === "coral") && "jelly jelly-coral",
        variant === "teal" && "jelly jelly-teal",
        className,
      )}
      {...(rest as HTMLMotionProps<"button">)}
    >
      <Icon className="size-[22px]" weight={weight} />
    </motion.button>
  );
}

/* ------------------------------------------------------------------ */
/* Card                                                                */
/* ------------------------------------------------------------------ */

export function Card({ className, children, glass, tone, onClick, ...rest }: HTMLMotionProps<"div"> & { glass?: boolean; tone?: "white" | "cream" | "coral" | "teal" | "sun" | "lavender" | "sky" }) {
  const tones = {
    white: "bg-card",
    cream: "bg-paper-100",
    coral: "bg-coral-100",
    teal: "bg-teal-100",
    sun: "bg-sun-100",
    lavender: "bg-lavender-100",
    sky: "bg-sky-100",
  } as const;
  return (
    <motion.div
      whileTap={onClick ? { scale: 0.985 } : undefined}
      transition={spring}
      onClick={onClick}
      className={cn("rounded-[28px] p-4 shadow-pillow", glass ? "glass" : tones[tone ?? "white"], onClick && "cursor-pointer", className)}
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
        <label htmlFor={htmlFor} className="text-[13.5px] font-extrabold text-ink-600 tracking-wide pl-1">
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
            className={cn("text-[12.5px] leading-snug pl-1 font-semibold", error ? "text-rose-600" : "text-ink-400")}
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
  icon?: IconComponent;
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
          "flex items-center gap-2.5 h-14 rounded-[20px] px-4 bg-paper-100 border-2 transition-colors",
          error ? "border-rose-400" : "border-transparent focus-within:border-coral-400 focus-within:bg-white",
          className,
        )}
      >
        {Icon && <Icon className="size-[22px] text-coral-500 shrink-0" weight="duotone" />}
        {prefix && <span className="text-ink-500 font-bold">{prefix}</span>}
        <input
          id={inputId}
          ref={ref}
          className="flex-1 bg-transparent outline-none text-[16px] font-semibold text-ink-900 placeholder:text-ink-300 placeholder:font-medium min-w-0"
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
          "w-full rounded-[20px] px-4 py-3 bg-paper-100 border-2 border-transparent focus:border-coral-400 focus:bg-white outline-none text-[16px] font-semibold text-ink-900 placeholder:text-ink-300 placeholder:font-medium resize-none min-h-24",
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

export function Chip({
  active,
  children,
  className,
  onClick,
  icon: Icon,
  tone = "coral",
}: {
  active?: boolean;
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  icon?: IconComponent;
  tone?: "coral" | "teal" | "sun" | "lavender" | "sky" | "ink";
}) {
  const activeCls = {
    coral: "bg-coral-500 text-white",
    teal: "bg-teal-500 text-white",
    sun: "bg-sun-500 text-ink-900",
    lavender: "bg-lavender-500 text-white",
    sky: "bg-sky-500 text-white",
    ink: "bg-ink-800 text-white",
  }[tone];
  const idleCls = {
    coral: "bg-coral-100 text-coral-700",
    teal: "bg-teal-100 text-teal-700",
    sun: "bg-sun-100 text-sun-600",
    lavender: "bg-lavender-100 text-lavender-600",
    sky: "bg-sky-100 text-sky-600",
    ink: "bg-paper-100 text-ink-700",
  }[tone];
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.92 }}
      animate={active ? { scale: [1, 1.08, 1] } : { scale: 1 }}
      transition={springJelly}
      onClick={() => {
        haptic.tick();
        onClick?.();
      }}
      className={cn("inline-flex items-center gap-1.5 h-10 px-4 rounded-full text-[14px] font-extrabold transition-colors", active ? activeCls : idleCls, className)}
    >
      {Icon && <Icon className="size-[18px]" weight={active ? "fill" : "duotone"} />}
      {children}
    </motion.button>
  );
}

export function Badge({ children, tone = "neutral", className }: { children: ReactNode; tone?: "neutral" | "brand" | "amber" | "rose" | "sky" | "violet" | "coral" | "teal" | "sun" | "mint"; className?: string }) {
  const tones = {
    neutral: "bg-paper-200 text-ink-600",
    brand: "bg-teal-100 text-teal-700",
    teal: "bg-teal-100 text-teal-700",
    coral: "bg-coral-100 text-coral-700",
    amber: "bg-sun-100 text-sun-600",
    sun: "bg-sun-100 text-sun-600",
    rose: "bg-rose-100 text-rose-600",
    sky: "bg-sky-100 text-sky-600",
    violet: "bg-lavender-100 text-lavender-600",
    mint: "bg-mint-100 text-mint-600",
  };
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-extrabold tracking-wide uppercase", tones[tone], className)}>{children}</span>;
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
    const t = getTokens();
    fetch(abs, { headers: t?.accessToken ? { Authorization: `Bearer ${t.accessToken}` } : {} })
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))))
      .then((b) => {
        const u = URL.createObjectURL(b);
        blobCache.set(src, u);
        if (!cancelled) setUrl(u);
      })
      .catch(() => !cancelled && setFailed(true));
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

const AVATAR_TINTS = ["bg-coral-100 text-coral-700", "bg-teal-100 text-teal-700", "bg-sun-100 text-sun-600", "bg-lavender-100 text-lavender-600", "bg-sky-100 text-sky-600"];

export function Avatar({ name, src, size = 44, className, ring }: { name: string; src?: string | null; size?: number; className?: string; ring?: boolean }) {
  const tint = AVATAR_TINTS[(name.charCodeAt(0) || 0) % AVATAR_TINTS.length];
  return (
    <div
      style={{ width: size, height: size, fontSize: size * 0.36 }}
      className={cn("relative shrink-0 rounded-full overflow-hidden font-display font-semibold flex items-center justify-center", tint, ring && "ring-[3px] ring-coral-400 ring-offset-2 ring-offset-paper-50", className)}
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
  return <div className={cn("shimmer rounded-2xl bg-paper-200", className)} />;
}

export function Spinner({ className }: { className?: string }) {
  return <CircleNotch className={cn("size-6 animate-spin text-coral-500", className)} weight="bold" />;
}

export function EmptyState({ icon: Icon, title, body, action, tone = "coral" }: { icon: IconComponent; title: string; body?: string; action?: ReactNode; tone?: "coral" | "teal" | "sun" | "lavender" | "sky" }) {
  const t = { coral: "bg-coral-100 text-coral-500", teal: "bg-teal-100 text-teal-500", sun: "bg-sun-100 text-sun-600", lavender: "bg-lavender-100 text-lavender-500", sky: "bg-sky-100 text-sky-500" }[tone];
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={spring} className="relative flex flex-col items-center text-center px-8 py-12 gap-3">
      <div className={cn("relative size-20 rounded-[28px] flex items-center justify-center", t)}>
        <span className="blob absolute -inset-3 -z-10 opacity-60" style={{ background: "inherit" }} />
        <Icon className="size-9" weight="duotone" />
      </div>
      <h3 className="font-display text-xl font-semibold text-ink-900">{title}</h3>
      {body && <p className="text-ink-500 text-[14.5px] leading-relaxed max-w-xs font-medium">{body}</p>}
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
  return <motion.span className={cn("tabular-nums font-display font-semibold", className)}>{text}</motion.span>;
}

/* ------------------------------------------------------------------ */
/* Segmented control                                                   */
/* ------------------------------------------------------------------ */

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
  tone = "coral",
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; icon?: IconComponent }[];
  className?: string;
  tone?: "coral" | "teal" | "ink";
}) {
  const id = useId();
  const pill = { coral: "bg-coral-500", teal: "bg-teal-500", ink: "bg-ink-800" }[tone];
  return (
    <div className={cn("relative grid rounded-full bg-paper-100 p-1", className)} style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
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
            className={cn("relative z-10 h-11 rounded-full text-[14.5px] font-extrabold transition-colors flex items-center justify-center gap-1.5", active ? "text-white" : "text-ink-500")}
          >
            {active && <motion.span layoutId={`seg-${id}`} transition={spring} className={cn("absolute inset-0 rounded-full shadow-pillow", pill)} />}
            <span className="relative flex items-center gap-1.5">
              {o.icon && <o.icon className="size-[18px]" weight={active ? "fill" : "duotone"} />}
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
          animate={{ scale: n <= value ? 1 : 0.9, opacity: n <= value ? 1 : 0.45 }}
          transition={springBouncyLocal}
          onClick={() => {
            haptic.tick();
            onChange?.(n);
          }}
          aria-label={`${n} stars`}
        >
          <svg width={size} height={size} viewBox="0 0 24 24" fill={n <= value ? "#ffc53d" : "#f6e9d8"} stroke={n <= value ? "#e8ad1f" : "#ead9c3"} strokeWidth={1.6}>
            <path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.5L12 17.3l-5.9 3.2 1.3-6.5L2.5 9.4l6.6-.8z" strokeLinejoin="round" />
          </svg>
        </motion.button>
      ))}
    </div>
  );
}
const springBouncyLocal = { type: "spring", stiffness: 520, damping: 22 } as const;

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
            className="fixed inset-0 z-40 bg-ink-900/35 backdrop-blur-[2px]"
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
            className={cn("fixed inset-x-0 bottom-0 z-50 rounded-t-[32px] bg-paper-50 shadow-float", className)}
            style={{ paddingBottom: "calc(var(--safe-bottom) + 16px)" }}
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="h-1.5 w-12 rounded-full bg-paper-300" />
            </div>
            {(title || dismissible) && (
              <div className="flex items-center justify-between px-5 pt-1 pb-2">
                <h2 className="font-display text-xl font-semibold text-ink-900">{title}</h2>
                {dismissible && <IconButton icon={X} label="Close" size={36} variant="ghost" weight="bold" onClick={onClose} />}
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
                "pointer-events-auto w-full max-w-sm rounded-[22px] px-4 py-3 bg-white shadow-float border-l-[6px]",
                t.tone === "success" && "border-l-mint-500",
                t.tone === "error" && "border-l-rose-500",
                t.tone === "brand" && "border-l-sun-500",
                t.tone === "neutral" && "border-l-ink-300",
              )}
            >
              <p className="text-[14.5px] font-extrabold text-ink-900">{t.title}</p>
              {t.body && <p className="text-[13px] text-ink-500 mt-0.5 leading-snug font-medium">{t.body}</p>}
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
      className={cn("relative h-full w-full flex flex-col bg-paper-50", scroll ? "overflow-y-auto no-scrollbar" : "overflow-hidden", padded && "px-5", className)}
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
        {typeof title === "string" ? <h1 className="font-display text-[24px] font-semibold text-ink-900 truncate">{title}</h1> : title}
        {subtitle && <p className="text-[13.5px] text-ink-500 truncate font-medium">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

export function Divider({ className }: { className?: string }) {
  return <div className={cn("h-px bg-paper-200", className)} />;
}

export function Row({ icon: Icon, label, value, onClick, danger, right, tone = "coral" }: { icon?: IconComponent; label: string; value?: ReactNode; onClick?: () => void; danger?: boolean; right?: ReactNode; tone?: "coral" | "teal" | "sun" | "lavender" | "sky" }) {
  const t = { coral: "bg-coral-100 text-coral-600", teal: "bg-teal-100 text-teal-600", sun: "bg-sun-100 text-sun-600", lavender: "bg-lavender-100 text-lavender-600", sky: "bg-sky-100 text-sky-600" }[tone];
  return (
    <motion.button
      type="button"
      whileTap={onClick ? { scale: 0.985, backgroundColor: "rgba(63,42,20,0.04)" } : undefined}
      transition={spring}
      onClick={onClick}
      disabled={!onClick}
      className={cn("w-full flex items-center gap-3 px-1 py-3.5 text-left rounded-2xl", danger ? "text-rose-600" : "text-ink-800")}
    >
      {Icon && (
        <span className={cn("size-10 rounded-2xl flex items-center justify-center", danger ? "bg-rose-100 text-rose-500" : t)}>
          <Icon className="size-[20px]" weight="duotone" />
        </span>
      )}
      <span className="flex-1 text-[15.5px] font-bold">{label}</span>
      {value && <span className="text-[14px] text-ink-500 font-semibold">{value}</span>}
      {right}
    </motion.button>
  );
}
