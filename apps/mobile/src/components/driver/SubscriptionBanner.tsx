import { AnimatePresence, motion } from "framer-motion";
import { CalendarCheck, CaretRight, ShieldSlash } from "@phosphor-icons/react";
import { useNavigate } from "react-router-dom";
import type { DriverDto } from "@raahi/shared";
import { subscriptionDaysLeft, SUBSCRIPTION_WARN_DAYS } from "@/hooks/driver/onboarding";
import { spring } from "@/lib/motion";
import { haptic } from "@/lib/native";
import { cn } from "@/lib/utils";

/**
 * Slides in under the status bar when the subscription has ≤ 5 days left or
 * has lapsed. Tapping it opens the renewal screen.
 */
export function SubscriptionBanner({ driver, className, offset = 0 }: { driver: DriverDto | null; className?: string; offset?: number }) {
  const navigate = useNavigate();
  const days = subscriptionDaysLeft(driver);
  const lapsed = Boolean(driver) && !driver?.subscriptionActive;
  const expiring = days !== null && days <= SUBSCRIPTION_WARN_DAYS && !lapsed;
  const show = lapsed || expiring;

  const text = lapsed
    ? driver?.subscription?.status === "pending"
      ? "Your receipt is being reviewed. You can go online once it's approved."
      : "Your subscription has ended. Renew to keep receiving requests."
    : days !== null && days <= 0
      ? "Your subscription ends today. Renew now."
      : `Subscription ends in ${days} day${days === 1 ? "" : "s"}. Renew now.`;

  return (
    <AnimatePresence>
      {show && (
        <motion.div key="sub" initial={{ opacity: 0, y: -24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={spring} className={cn("absolute inset-x-0 z-30 px-4 pointer-events-none", className)} style={{ top: `calc(var(--safe-top) + ${8 + offset}px)` }}>
          <motion.button
            type="button"
            whileTap={{ scale: 0.98 }}
            transition={spring}
            onClick={() => {
              haptic.light();
              navigate("/d/subscription");
            }}
            className={cn("pointer-events-auto mx-auto max-w-md w-full rounded-[22px] px-3.5 py-2.5 flex items-center gap-2.5 text-left shadow-pillow border-l-[5px]", lapsed ? "bg-rose-100 border-l-rose-500" : "bg-sun-100 border-l-sun-500")}
          >
            {lapsed ? <ShieldSlash className="size-[20px] text-rose-500 shrink-0" weight="duotone" /> : <CalendarCheck className="size-[20px] text-sun-600 shrink-0" weight="duotone" />}
            <span className="flex-1 text-[13px] font-bold text-ink-800 leading-snug">{text}</span>
            <CaretRight className="size-4 text-ink-400 shrink-0" weight="bold" />
          </motion.button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
