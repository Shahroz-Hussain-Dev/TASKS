import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { Screen } from "@/components/ui";
import { LogoMark } from "@/components/Brand";
import { item, stagger } from "@/lib/motion";
import { Aurora } from "./Aurora";
import { BackButton } from "./BackButton";

/**
 * Layout for welcome-adjacent forms: aurora backdrop, back button from the
 * top, heading from the left, the form from below, footer fading in.
 */
export function AuthShell({ eyebrow, title, subtitle, children, footer, aside, backFallback = "/welcome" }: { eyebrow?: string; title: string; subtitle?: string; children: ReactNode; footer?: ReactNode; aside?: ReactNode; backFallback?: string }) {
  return (
    <Screen className="noise">
      <Aurora variant="top" intensity={0.9} />
      <motion.div variants={stagger(0.07, 0.04)} initial="hidden" animate="show" className="relative flex-1 flex flex-col">
        <motion.div variants={item.down} className="flex items-center justify-between min-h-12">
          <BackButton fallback={backFallback} />
          <LogoMark size={40} />
        </motion.div>

        <motion.header variants={item.left} className="mt-6 mb-7">
          {eyebrow && <p className="text-[12.5px] font-bold uppercase tracking-[0.18em] text-brand-400 mb-2">{eyebrow}</p>}
          <h1 className="font-display text-[30px] leading-[1.08] font-semibold text-ink-50">{title}</h1>
          {subtitle && <p className="text-ink-400 text-[15px] leading-relaxed mt-2 max-w-sm">{subtitle}</p>}
        </motion.header>

        {aside && <motion.div variants={item.right} className="mb-5">{aside}</motion.div>}

        <motion.div variants={item.up} className="flex flex-col gap-4">
          {children}
        </motion.div>

        {footer && (
          <motion.footer variants={item.fade} className="mt-auto pt-8 text-center text-[14px] text-ink-400">
            {footer}
          </motion.footer>
        )}
      </motion.div>
    </Screen>
  );
}
