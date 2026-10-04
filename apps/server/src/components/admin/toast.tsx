"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { springSoft } from "./motion";

type ToastKind = "success" | "error" | "info";

interface Toast {
  id: number;
  kind: ToastKind;
  title: string;
  description?: string;
}

interface ToastApi {
  push: (kind: ToastKind, title: string, description?: string) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
}

const ToastCtx = createContext<ToastApi | null>(null);

const ICONS: Record<ToastKind, typeof CheckCircle2> = { success: CheckCircle2, error: AlertTriangle, info: Info };
const TONES: Record<ToastKind, string> = {
  success: "text-brand-400 bg-brand-500/15",
  error: "text-rose-400 bg-rose-500/15",
  info: "text-sky-400 bg-sky-400/15",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const push = useCallback(
    (kind: ToastKind, title: string, description?: string) => {
      const id = ++counter.current;
      setToasts((t) => [...t.slice(-3), { id, kind, title, description }]);
      window.setTimeout(() => dismiss(id), kind === "error" ? 6500 : 4200);
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      push,
      success: (t, d) => push("success", t, d),
      error: (t, d) => push("error", t, d),
      info: (t, d) => push("info", t, d),
    }),
    [push],
  );

  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed bottom-5 right-5 z-[100] flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2">
        <AnimatePresence initial={false}>
          {toasts.map((t) => {
            const Icon = ICONS[t.kind];
            return (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, x: 40, scale: 0.96 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 40, scale: 0.96, transition: { duration: 0.18 } }}
                transition={springSoft}
                role="status"
                className="glass pointer-events-auto flex items-start gap-3 rounded-2xl p-3.5 shadow-float"
              >
                <span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl ${TONES[t.kind]}`}>
                  <Icon size={18} strokeWidth={2.2} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink-50">{t.title}</p>
                  {t.description ? <p className="mt-0.5 text-[13px] leading-snug text-ink-300">{t.description}</p> : null}
                </div>
                <button type="button" onClick={() => dismiss(t.id)} aria-label="Dismiss" className="rounded-lg p-1 text-ink-400 hover:bg-white/5 hover:text-ink-100">
                  <X size={16} />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
