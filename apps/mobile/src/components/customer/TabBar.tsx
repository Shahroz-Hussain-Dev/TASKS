import { motion } from "framer-motion";
import { ClockCounterClockwise, House, User } from "@phosphor-icons/react";
import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { IconComponent } from "@/components/ui";
import { springBouncy, springSoft } from "@/lib/motion";
import { haptic } from "@/lib/native";
import { cn } from "@/lib/utils";

/** Space screens must leave at the bottom so content clears the floating bar. */
export const TAB_BAR_CLEARANCE = 92;

interface Tab {
  id: "home" | "rides" | "profile";
  label: string;
  icon: IconComponent;
  to: string;
}

const TABS: Tab[] = [
  { id: "home", label: "Home", icon: House, to: "/c/home" },
  { id: "rides", label: "Rides", icon: ClockCounterClockwise, to: "/c/rides" },
  { id: "profile", label: "Profile", icon: User, to: "/profile" },
];

/** Paths where the bar is visible; every other passenger screen is a sub-screen. */
export const TAB_BAR_PATHS = new Set(["/c", "/c/", "/c/home", "/c/rides"]);

/**
 * The shell remounts on every route change (pages are keyed by path), so the
 * bar would otherwise rise from the bottom on each tab switch. It only does
 * so the first time it appears in a session; afterwards just the pill glides.
 */
let shownOnce = false;

/**
 * Floating white pillow tab bar. The coral pill shares a `layoutId` so it
 * glides between tabs; active icons switch to the filled weight.
 */
export function TabBar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const activeId: Tab["id"] = pathname.startsWith("/c/rides") ? "rides" : "home";
  const animateIn = !shownOnce;
  useEffect(() => {
    shownOnce = true;
  }, []);

  return (
    <motion.nav
      initial={animateIn ? { y: 72, opacity: 0 } : false}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 72, opacity: 0 }}
      transition={springSoft}
      aria-label="Main"
      className="fixed inset-x-0 z-30 flex justify-center px-6 pointer-events-none"
      style={{ bottom: "calc(var(--safe-bottom) + 14px)" }}
    >
      <div className="pillow pointer-events-auto rounded-full p-1.5 shadow-float flex items-center gap-1 w-full max-w-[380px] border border-paper-200">
        {TABS.map((t) => {
          const active = t.id === activeId;
          const Icon = t.icon;
          return (
            <motion.button
              key={t.id}
              type="button"
              whileTap={{ scale: 0.94 }}
              transition={springBouncy}
              aria-label={t.label}
              aria-current={active ? "page" : undefined}
              onClick={() => {
                haptic.tick();
                if (!active) navigate(t.to);
              }}
              className={cn("relative flex-1 h-12 rounded-full flex items-center justify-center gap-2 text-[14px] font-display font-semibold transition-colors", active ? "text-white" : "text-ink-500")}
            >
              {active && <motion.span layoutId="customer-tab-pill" transition={springSoft} className="absolute inset-0 rounded-full bg-coral-500 shadow-glow" />}
              <span className="relative inline-flex items-center gap-2">
                <Icon className="size-[22px]" weight={active ? "fill" : "duotone"} />
                {active && (
                  <motion.span initial={{ opacity: 0, x: -6, width: 0 }} animate={{ opacity: 1, x: 0, width: "auto" }} transition={springSoft} className="overflow-hidden whitespace-nowrap">
                    {t.label}
                  </motion.span>
                )}
              </span>
            </motion.button>
          );
        })}
      </div>
    </motion.nav>
  );
}
