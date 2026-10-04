import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { CalendarClock, ChevronRight, HandCoins, RefreshCw, Sparkles, Star, TrendingUp, Wallet } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { EarningsChart } from "@/components/driver/EarningsChart";
import { RateRing } from "@/components/driver/RateRing";
import { Aurora } from "@/components/shared/Aurora";
import { OfflineBanner } from "@/components/shared/OfflineBanner";
import { Badge, Button, Card, EmptyState, IconButton, Money, Screen, Skeleton, TopBar } from "@/components/ui";
import { dk } from "@/hooks/driver/keys";
import { TAB_BAR_CLEARANCE } from "@/hooks/driver/layout";
import { formatShortDay, subscriptionDaysLeft, SUBSCRIPTION_STATUS_META, SUBSCRIPTION_WARN_DAYS } from "@/hooks/driver/onboarding";
import { useConfig } from "@/hooks/driver/useConfig";
import { useDriver } from "@/hooks/driver/useDriver";
import { api } from "@/lib/api";
import { item, stagger } from "@/lib/motion";
import { cn, errorMessage } from "@/lib/utils";

/** Earnings dashboard: today's hero number, period tiles, a 30-day chart, performance rings and the subscription card. */
export default function EarningsScreen() {
  const navigate = useNavigate();
  const { driver } = useDriver();
  const { settings } = useConfig();
  const query = useQuery({ queryKey: dk.earnings, queryFn: () => api.driver.earnings(), staleTime: 30_000, refetchInterval: 60_000, refetchIntervalInBackground: false });
  const e = query.data;

  const daysLeft = subscriptionDaysLeft(driver);
  const subFrac = daysLeft !== null ? Math.min(1, Math.max(0, daysLeft / settings.subscriptionDays)) : 0;
  const subMeta = driver?.subscription ? SUBSCRIPTION_STATUS_META[driver.subscription.status] : null;
  const subWarn = !driver?.subscriptionActive || (daysLeft !== null && daysLeft <= SUBSCRIPTION_WARN_DAYS);

  return (
    <Screen className="noise">
      <OfflineBanner />
      <Aurora variant="top" intensity={0.6} />
      <motion.div variants={stagger(0.07)} initial="hidden" animate="show" className="relative flex-1 flex flex-col gap-4" style={{ paddingBottom: TAB_BAR_CLEARANCE }}>
        <motion.div variants={item.down}>
          <TopBar title="Earnings" subtitle="100% of every fare is yours" right={<IconButton icon={RefreshCw} label="Refresh" variant="ghost" size={40} className={cn(query.isRefetching && "animate-spin")} onClick={() => void query.refetch()} />} />
        </motion.div>

        {query.isLoading ? (
          <motion.div variants={item.up} className="flex flex-col gap-4">
            <Skeleton className="h-40 w-full rounded-[32px]" />
            <div className="grid grid-cols-3 gap-2">
              <Skeleton className="h-24 rounded-3xl" />
              <Skeleton className="h-24 rounded-3xl" />
              <Skeleton className="h-24 rounded-3xl" />
            </div>
            <Skeleton className="h-56 w-full rounded-3xl" />
            <Skeleton className="h-28 w-full rounded-3xl" />
          </motion.div>
        ) : query.isError || !e ? (
          <motion.div variants={item.up} className="flex-1 flex items-center justify-center">
            <EmptyState icon={Wallet} title="Couldn't load your earnings" body={errorMessage(query.error, "Check your connection and try again.")} action={<Button size="md" variant="secondary" onClick={() => void query.refetch()}>Try again</Button>} />
          </motion.div>
        ) : (
          <>
            {/* Hero */}
            <motion.section variants={item.left} className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-brand-700/60 via-ink-800 to-ink-800 border border-brand-500/25 p-5 shadow-glow">
              <motion.span aria-hidden className="absolute -right-8 -top-10 size-44 rounded-full bg-brand-400/20 blur-3xl" animate={{ scale: [1, 1.15, 1] }} transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }} />
              <div className="relative flex items-start justify-between gap-3">
                <div>
                  <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-brand-300">Today</p>
                  <Money value={e.todayPkr} className="block text-[40px] font-bold text-ink-50 leading-none mt-1" />
                  <p className="mt-2 text-[13.5px] text-ink-300">
                    {e.ridesToday} ride{e.ridesToday === 1 ? "" : "s"} today · {e.ridesWeek} this week
                  </p>
                </div>
                <span className="size-12 rounded-2xl glass flex items-center justify-center text-brand-300 shadow-card">
                  <HandCoins className="size-6" />
                </span>
              </div>
            </motion.section>

            {/* Period tiles */}
            <motion.div variants={item.up} className="grid grid-cols-3 gap-2">
              <Tile label="This week" value={e.weekPkr} sub={`${e.ridesWeek} ride${e.ridesWeek === 1 ? "" : "s"}`} />
              <Tile label="This month" value={e.monthPkr} />
              <Tile label="All time" value={e.totalPkr} sub={`${e.ridesTotal} ride${e.ridesTotal === 1 ? "" : "s"}`} />
            </motion.div>

            {/* Chart */}
            <motion.section variants={item.right}>
              <Card className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="size-4 text-brand-400" />
                    <h2 className="font-display text-[16px] font-semibold text-ink-50">Last 30 days</h2>
                  </div>
                  <span className="text-[12px] text-ink-500">Tap a bar for details</span>
                </div>
                {e.daily.length === 0 ? <p className="py-8 text-center text-[13.5px] text-ink-400">Your daily earnings will chart here after your first trip.</p> : <EarningsChart daily={e.daily} />}
              </Card>
            </motion.section>

            {/* Performance */}
            <motion.section variants={item.left}>
              <Card className="p-4 flex items-center gap-4">
                <RateRing value={e.acceptanceRate} size={84} color={e.acceptanceRate >= 0.7 ? "#34d399" : e.acceptanceRate >= 0.4 ? "#fbbf24" : "#fb7185"}>
                  <span className="font-display text-[18px] font-bold text-ink-50 tabular-nums leading-none">{Math.round(e.acceptanceRate * 100)}%</span>
                  <span className="text-[9.5px] text-ink-500 uppercase tracking-wide font-bold mt-0.5">accept</span>
                </RateRing>
                <div className="flex-1 grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-500">Rating</p>
                    <p className="mt-0.5 flex items-center gap-1 font-display text-[20px] font-bold text-ink-50 tabular-nums">
                      <Star className="size-4 text-amber-300 fill-amber-300" />
                      {e.ratingAvg > 0 ? e.ratingAvg.toFixed(1) : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-500">Trips</p>
                    <p className="mt-0.5 font-display text-[20px] font-bold text-ink-50 tabular-nums">{e.ridesTotal}</p>
                  </div>
                  <p className="col-span-2 text-[12.5px] text-ink-400 leading-snug flex items-start gap-1.5">
                    <Sparkles className="size-3.5 text-violet-400 shrink-0 mt-0.5" />
                    {e.acceptanceRate >= 0.7 ? "Great acceptance rate — passengers see you first." : "Accepting more requests moves you up when passengers compare offers."}
                  </p>
                </div>
              </Card>
            </motion.section>

            {/* Subscription */}
            <motion.section variants={item.up}>
              <Card onClick={() => navigate("/d/subscription")} className={cn("p-4 flex items-center gap-4", subWarn ? "border-amber-400/30" : "")}>
                <RateRing value={subFrac} size={72} stroke={7} color={subWarn ? "#fbbf24" : "#34d399"}>
                  <CalendarClock className={cn("size-5", subWarn ? "text-amber-300" : "text-brand-400")} />
                </RateRing>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-display text-[16px] font-semibold text-ink-50">Subscription</p>
                    {subMeta && <Badge tone={subMeta.tone}>{subMeta.label}</Badge>}
                  </div>
                  <p className="text-[13px] text-ink-400 mt-0.5 leading-snug">
                    {driver?.subscriptionActive && driver.subscription?.endsAt
                      ? daysLeft !== null && daysLeft <= 0
                        ? `Ends today (${formatShortDay(driver.subscription.endsAt)})`
                        : `${daysLeft} day${daysLeft === 1 ? "" : "s"} left · until ${formatShortDay(driver.subscription.endsAt)}`
                      : driver?.subscription?.status === "pending"
                        ? "Receipt under review"
                        : `Renew for PKR ${settings.driverSubscriptionPkr.toLocaleString("en-PK")} / ${settings.subscriptionDays} days`}
                  </p>
                  <p className={cn("mt-1 text-[13px] font-semibold", subWarn ? "text-amber-300" : "text-brand-400")}>{subWarn ? "Renew now" : "Manage"}</p>
                </div>
                <ChevronRight className="size-5 text-ink-500 shrink-0" />
              </Card>
            </motion.section>
          </>
        )}
      </motion.div>
    </Screen>
  );
}

function Tile({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="rounded-3xl bg-ink-800 border border-white/6 shadow-card px-3 py-3 min-w-0">
      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-500 truncate">{label}</p>
      <Money value={value} className="block text-[17px] font-bold text-ink-50 mt-1 truncate" />
      {sub && <p className="text-[11.5px] text-ink-400 mt-0.5 truncate">{sub}</p>}
    </div>
  );
}
