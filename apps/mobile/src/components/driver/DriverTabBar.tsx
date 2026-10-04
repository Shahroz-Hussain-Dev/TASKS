import { motion } from "framer-motion";
import { History, Home, UserRound, Wallet, type LucideIcon } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { spring } from "@/lib/motion";
import { haptic } from "@/lib/native";
import { cn } from "@/lib/utils";

interface Tab {
  to: string;
  label: string;
  icon: LucideIcon;
}

const TABS: readonly Tab[] = [
  { to: "/d/home", label: "Home", icon: Home },
  { to: "/d/earnings", label: "Earnings", icon: Wallet },
  { to: "/d/rides", label: "Rides", icon: History },
  { to: "/profile", label: "Profile", icon: UserRound },
];

/** Floating glass tab bar for the driver shell with a sliding active pill. */
export function DriverTabBar({ badge }: { badge?: Partial<Record<string, number>> }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  return (
    <motion.nav initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }} transition={spring} className="absolute inset-x-0 bottom-0 z-30 px-4 pointer-events-none" style={{ paddingBottom: "calc(var(--safe-bottom) + 12px)" }} aria-label="Driver navigation">
      <div className="pointer-events-auto mx-auto max-w-md glass rounded-[26px] shadow-float p-1.5 grid grid-cols-4">
        {TABS.map((t) => {
          const active = pathname === t.to || (t.to !== "/profile" && pathname.startsWith(`${t.to}/`));
          const count = badge?.[t.to] ?? 0;
          return (
            <motion.button
              key={t.to}
              type="button"
              whileTap={{ scale: 0.92 }}
              transition={spring}
              aria-current={active ? "page" : undefined}
              onClick={() => {
                if (active) return;
                haptic.tick();
                navigate(t.to);
              }}
              className={cn("relative h-14 rounded-2xl flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold", active ? "text-ink-950" : "text-ink-300")}
            >
              {active && <motion.span layoutId="driver-tab-pill" className="absolute inset-0 rounded-2xl bg-brand-500 shadow-glow" transition={spring} />}
              <span className="relative">
                <t.icon className="size-[21px]" strokeWidth={2.2} />
                {count > 0 && !active && <span className="absolute -top-1.5 -right-2 min-w-4 h-4 px-1 rounded-full bg-amber-400 text-ink-950 text-[10px] font-bold flex items-center justify-center tabular-nums">{count > 9 ? "9+" : count}</span>}
              </span>
              <span className="relative">{t.label}</span>
            </motion.button>
          );
        })}
      </div>
    </motion.nav>
  );
}
