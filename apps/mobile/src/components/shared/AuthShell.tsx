import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { Screen } from "@/components/ui";
import { Wordmark } from "@/components/Brand";
import { item, stagger } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { Aurora } from "./Aurora";
import { BackButton } from "./BackButton";

/**
 * Layout for welcome-adjacent forms: cream paper with morphing tint blobs,
 * back button from the top, heading from the left, a white pillow card that
 * rises in with the form, footer fading in last.
 */
export function AuthShell({
  eyebrow,
  title,
  subtitle,
  children,
  footer,
  aside,
  backFallback = "/welcome",
  tone = "coral",
}: {
  eyebrow?: string;
  title: ReactNode;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  aside?: ReactNode;
  backFallback?: string;
  tone?: "coral" | "teal";
}) {
  return (
    <Screen>
      <Aurora variant="top" intensity={1} />
      <motion.div variants={stagger(0.07, 0.04)} initial="hidden" animate="show" className="relative flex-1 flex flex-col">
        <motion.div variants={item.down} className="flex items-center justify-between min-h-12">
          <BackButton fallback={backFallback} />
          <Wordmark size={26} />
        </motion.div>

        <motion.header variants={item.left} className="mt-6 mb-6">
          {eyebrow && (
            <p className={cn("inline-flex items-center gap-2 text-[12px] font-extrabold uppercase tracking-[0.18em] mb-3 rounded-full px-3 py-1", tone === "teal" ? "bg-teal-100 text-teal-700" : "bg-coral-100 text-coral-700")}>
              <span className={cn("size-1.5 rounded-full", tone === "teal" ? "bg-teal-500" : "bg-coral-500")} />
              {eyebrow}
            </p>
          )}
          <h1 className="font-display text-[32px] leading-[1.06] font-semibold text-ink-900 tracking-tight">{title}</h1>
          {subtitle && <p className="text-ink-500 text-[15px] leading-relaxed mt-2.5 max-w-sm font-medium">{subtitle}</p>}
        </motion.header>

        {aside && (
          <motion.div variants={item.right} className="mb-5">
            {aside}
          </motion.div>
        )}

        <motion.div variants={item.up} className="pillow p-5 flex flex-col gap-4">
          {children}
        </motion.div>

        {footer && (
          <motion.footer variants={item.fade} className="mt-auto pt-8 text-center text-[14.5px] text-ink-500 font-semibold">
            {footer}
          </motion.footer>
        )}
      </motion.div>
    </Screen>
  );
}
