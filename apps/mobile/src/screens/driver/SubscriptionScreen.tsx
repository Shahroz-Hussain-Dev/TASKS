import { motion } from "framer-motion";
import { CalendarClock, Receipt, ShieldCheck } from "lucide-react";
import { SubscriptionForm } from "@/components/driver/SubscriptionForm";
import { RateRing } from "@/components/driver/RateRing";
import { Aurora } from "@/components/shared/Aurora";
import { BackButton } from "@/components/shared/BackButton";
import { OfflineBanner } from "@/components/shared/OfflineBanner";
import { AuthImage, Badge, Card, Money, Screen, Skeleton, Spinner, TopBar } from "@/components/ui";
import { formatDay, subscriptionDaysLeft, SUBSCRIPTION_METHODS, SUBSCRIPTION_STATUS_META, SUBSCRIPTION_WARN_DAYS } from "@/hooks/driver/onboarding";
import { useConfig } from "@/hooks/driver/useConfig";
import { useApplyDriver, useDriver } from "@/hooks/driver/useDriver";
import { item, stagger } from "@/lib/motion";
import { cn } from "@/lib/utils";

/** Current subscription, the latest receipt on file and the renewal flow. */
export default function SubscriptionScreen() {
  const { driver, query } = useDriver();
  const apply = useApplyDriver();
  const { settings } = useConfig();

  const sub = driver?.subscription ?? null;
  const daysLeft = subscriptionDaysLeft(driver);
  const frac = daysLeft !== null ? Math.min(1, Math.max(0, daysLeft / settings.subscriptionDays)) : 0;
  const warn = !driver?.subscriptionActive || (daysLeft !== null && daysLeft <= SUBSCRIPTION_WARN_DAYS);
  const methodLabel = sub ? (SUBSCRIPTION_METHODS.find((m) => m.value === sub.method)?.label ?? sub.method) : null;

  return (
    <Screen className="noise">
      <OfflineBanner />
      <Aurora variant="top" intensity={0.5} />
      <motion.div variants={stagger(0.07)} initial="hidden" animate="show" className="relative flex-1 flex flex-col gap-4 pb-4">
        <motion.div variants={item.down}>
          <TopBar left={<BackButton fallback="/d/earnings" />} title="Subscription" subtitle="One flat monthly fee, zero commission" />
        </motion.div>

        {!driver ? (
          <motion.div variants={item.up} className="flex flex-col gap-4">
            <Skeleton className="h-28 w-full rounded-3xl" />
            <Skeleton className="h-40 w-full rounded-3xl" />
            <div className="flex justify-center py-6">
              <Spinner />
            </div>
          </motion.div>
        ) : (
          <>
            {/* Status */}
            <motion.section variants={item.left}>
              <Card className={cn("p-4 flex items-center gap-4", warn && "border-amber-400/30")}>
                <RateRing value={frac} size={84} stroke={8} color={warn ? "#fbbf24" : "#34d399"}>
                  {daysLeft !== null && driver.subscriptionActive ? (
                    <>
                      <span className="font-display text-[20px] font-bold text-ink-50 tabular-nums leading-none">{Math.max(0, daysLeft)}</span>
                      <span className="text-[9.5px] text-ink-500 uppercase tracking-wide font-bold mt-0.5">days</span>
                    </>
                  ) : (
                    <CalendarClock className="size-6 text-amber-300" />
                  )}
                </RateRing>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-display text-[17px] font-semibold text-ink-50">{driver.subscriptionActive ? "Active" : sub?.status === "pending" ? "Under review" : sub ? "Expired" : "Not subscribed"}</p>
                    {sub && <Badge tone={SUBSCRIPTION_STATUS_META[sub.status].tone}>{SUBSCRIPTION_STATUS_META[sub.status].label}</Badge>}
                  </div>
                  <p className="text-[13.5px] text-ink-400 mt-0.5 leading-snug">
                    {driver.subscriptionActive && sub?.endsAt ? `Until ${formatDay(sub.endsAt)}` : sub?.status === "pending" ? "We're confirming your payment." : `PKR ${settings.driverSubscriptionPkr.toLocaleString("en-PK")} for ${settings.subscriptionDays} days.`}
                  </p>
                  {query.isFetching && <p className="text-[11.5px] text-ink-500 mt-1">Refreshing…</p>}
                </div>
              </Card>
            </motion.section>

            {/* Latest receipt */}
            {sub && (
              <motion.section variants={item.right}>
                <Card className="p-4 flex gap-3">
                  <div className="size-20 rounded-2xl overflow-hidden bg-ink-700 border border-white/6 shrink-0 relative">
                    <AuthImage src={sub.receiptUrl} alt="Payment receipt" className="absolute inset-0 w-full h-full" fallback={<Receipt className="absolute inset-0 m-auto size-6 text-ink-500" />} />
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col gap-1">
                    <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-ink-500">Latest payment</p>
                    <p className="font-display text-[17px] font-semibold text-ink-50">
                      <Money value={sub.amountPkr} /> <span className="text-[13px] text-ink-400 font-sans font-medium">via {methodLabel}</span>
                    </p>
                    {sub.transactionRef && <p className="text-[12.5px] text-ink-300 tabular-nums truncate">Ref {sub.transactionRef}</p>}
                    <p className="text-[12.5px] text-ink-400">Submitted {formatDay(sub.createdAt)}</p>
                    {sub.startsAt && sub.endsAt && (
                      <p className="text-[12.5px] text-ink-400">
                        Covers {formatDay(sub.startsAt)} – {formatDay(sub.endsAt)}
                      </p>
                    )}
                    {sub.reviewerNote && <p className="text-[12.5px] text-amber-300 leading-snug mt-0.5">{sub.reviewerNote}</p>}
                  </div>
                </Card>
              </motion.section>
            )}

            <motion.div variants={item.up} className="flex items-start gap-2.5 rounded-2xl bg-brand-500/8 border border-brand-500/15 px-3.5 py-3">
              <ShieldCheck className="size-4 text-brand-400 shrink-0 mt-0.5" />
              <p className="text-[13px] text-ink-200 leading-snug">Renewals extend from your current end date, so paying early never costs you days.</p>
            </motion.div>

            <SubscriptionForm key={sub?.id ?? "none"} driver={driver} mode="renew" onSaved={apply} />
          </>
        )}
      </motion.div>
    </Screen>
  );
}
