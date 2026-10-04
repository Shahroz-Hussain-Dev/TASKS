"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Activity, ArrowRight, Banknote, Car, CarTaxiFront, LifeBuoy, Radio, Users, Wallet } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { adminApi } from "@/lib/admin-client";
import { CategoryDonut, RidesAreaChart } from "@/components/admin/charts";
import { Counter } from "@/components/admin/Counter";
import { cn, DRIVER_STATUS_LABEL, DRIVER_STATUS_TONE, fmtDateTime, pkr, timeAgo, TICKET_STATUS_LABEL, TICKET_STATUS_TONE } from "@/components/admin/format";
import { item, stagger } from "@/components/admin/motion";
import { Avatar, Badge, Card, EmptyState, ErrorState, PageHeader, Skeleton } from "@/components/admin/ui";

interface Kpi {
  label: string;
  value: number;
  format?: (n: number) => string;
  sub?: string;
  icon: typeof Users;
  tone: string;
  href?: string;
}

export default function DashboardPage() {
  const stats = useQuery({ queryKey: ["admin", "stats"], queryFn: ({ signal }) => adminApi.stats(signal), refetchInterval: 30_000 });
  const pending = useQuery({ queryKey: ["admin", "drivers", { status: "under_review", page: 1, pageSize: 6 }], queryFn: ({ signal }) => adminApi.drivers.list({ status: "under_review", page: 1, pageSize: 6 }, signal), refetchInterval: 30_000 });
  const tickets = useQuery({ queryKey: ["admin", "support", { status: "open", page: 1, pageSize: 6 }], queryFn: ({ signal }) => adminApi.support.list({ status: "open", page: 1, pageSize: 6 }, signal), refetchInterval: 30_000 });

  const s = stats.data;
  const kpis: Kpi[] = s
    ? [
        { label: "Rides today", value: s.ridesToday, sub: `${s.ridesWeek.toLocaleString("en-PK")} this week`, icon: Car, tone: "text-brand-400 bg-brand-500/15", href: "/admin/rides" },
        { label: "GMV today", value: s.gmvTodayPkr, format: (n) => pkr(n), sub: `${pkr(s.gmvWeekPkr)} this week · 100% to drivers`, icon: Banknote, tone: "text-amber-300 bg-amber-400/15", href: "/admin/rides" },
        { label: "Drivers online", value: s.driversOnline, sub: `${s.drivers.toLocaleString("en-PK")} registered`, icon: Radio, tone: "text-sky-400 bg-sky-400/15", href: "/admin/live" },
        { label: "Active rides", value: s.activeRides, sub: `${s.openRequests} open requests`, icon: Activity, tone: "text-violet-400 bg-violet-400/15", href: "/admin/live" },
        { label: "Pending review", value: s.driversPendingReview, sub: "drivers waiting for a decision", icon: CarTaxiFront, tone: "text-amber-300 bg-amber-400/15", href: "/admin/drivers" },
        { label: "Customers", value: s.customers, sub: "passenger accounts", icon: Users, tone: "text-ink-100 bg-white/8", href: "/admin/customers" },
        { label: "Subscriptions", value: s.subscriptionRevenueMonthPkr, format: (n) => pkr(n), sub: "collected this month", icon: Wallet, tone: "text-brand-400 bg-brand-500/15", href: "/admin/subscriptions" },
        { label: "Open tickets", value: s.openTickets, sub: "need a human reply", icon: LifeBuoy, tone: "text-rose-400 bg-rose-500/15", href: "/admin/support" },
      ]
    : [];

  return (
    <div>
      <PageHeader title="Dashboard" subtitle={s ? `Live snapshot · updated ${timeAgo(new Date())}` : "Live snapshot of the Raahi marketplace"} />

      {stats.isError ? (
        <Card>
          <ErrorState error={stats.error} onRetry={() => stats.refetch()} />
        </Card>
      ) : (
        <motion.div variants={stagger(0.05)} initial="hidden" animate="show" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.isPending
            ? Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="rounded-3xl border border-white/6 bg-ink-800 p-5">
                  <Skeleton className="h-9 w-9 rounded-xl" />
                  <Skeleton className="mt-5 h-8 w-24" />
                  <Skeleton className="mt-2 h-3 w-32" />
                </div>
              ))
            : kpis.map((k) => <KpiTile key={k.label} kpi={k} />)}
        </motion.div>
      )}

      <motion.div variants={stagger(0.08, 0.25)} initial="hidden" animate="show" className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <motion.div variants={item.up} className="xl:col-span-2">
          <Card title="Rides & GMV" subtitle="Completed rides per day, Pakistan time">
            {stats.isPending ? <Skeleton className="h-[300px]" /> : s ? <RidesAreaChart series={s.series} /> : null}
          </Card>
        </motion.div>
        <motion.div variants={item.right}>
          <Card title="Category mix" subtitle="Rides by vehicle type, last 30 days">
            {stats.isPending ? <Skeleton className="h-[200px]" /> : s ? <CategoryDonut mix={s.categoryMix} /> : null}
          </Card>
        </motion.div>
      </motion.div>

      <motion.div variants={stagger(0.08, 0.4)} initial="hidden" animate="show" className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <motion.div variants={item.up}>
          <Card
            padded={false}
            title="Pending approvals"
            subtitle="Oldest submissions first"
            action={
              <Link href="/admin/drivers?status=under_review" className="inline-flex items-center gap-1 text-[13px] font-semibold text-brand-400 hover:text-brand-300">
                Review queue <ArrowRight size={14} />
              </Link>
            }
          >
            {pending.isPending ? (
              <ListSkeleton />
            ) : pending.isError ? (
              <ErrorState error={pending.error} onRetry={() => pending.refetch()} />
            ) : pending.data.items.length === 0 ? (
              <EmptyState title="Queue is clear" description="No drivers are waiting for review right now." className="py-10" />
            ) : (
              <ul className="divide-y divide-white/5">
                {pending.data.items.map((d) => (
                  <li key={d.id}>
                    <Link href={`/admin/drivers/${d.id}`} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-white/3">
                      <Avatar name={d.user.fullName} src={d.user.avatarUrl} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-semibold text-ink-50">{d.user.fullName}</p>
                        <p className="truncate text-[12.5px] text-ink-400">
                          {d.vehicle ? `${d.vehicle.make} ${d.vehicle.model} · ${d.vehicle.plate}` : "No vehicle yet"} · {d.documents.filter((x) => x.status === "verified").length}/{d.documents.length} docs verified
                        </p>
                      </div>
                      <Badge tone={DRIVER_STATUS_TONE[d.status]}>{DRIVER_STATUS_LABEL[d.status]}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </motion.div>

        <motion.div variants={item.up}>
          <Card
            padded={false}
            title="Open tickets"
            subtitle="Escalated conversations first"
            action={
              <Link href="/admin/support" className="inline-flex items-center gap-1 text-[13px] font-semibold text-brand-400 hover:text-brand-300">
                Support inbox <ArrowRight size={14} />
              </Link>
            }
          >
            {tickets.isPending ? (
              <ListSkeleton />
            ) : tickets.isError ? (
              <ErrorState error={tickets.error} onRetry={() => tickets.refetch()} />
            ) : tickets.data.items.length === 0 ? (
              <EmptyState title="Inbox is empty" description="Every support conversation has been answered." className="py-10" />
            ) : (
              <ul className="divide-y divide-white/5">
                {tickets.data.items.map((t) => {
                  const last = t.messages[t.messages.length - 1];
                  return (
                    <li key={t.id}>
                      <Link href={`/admin/support?ticket=${t.id}`} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-white/3">
                        <Avatar name={t.user?.fullName} src={t.user?.avatarUrl} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[14px] font-semibold text-ink-50">{t.subject}</p>
                          <p className="truncate text-[12.5px] text-ink-400">
                            {t.user?.fullName ?? "Unknown user"} · {last ? last.body : "No messages yet"}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          {t.escalated ? <Badge tone="rose" dot>Escalated</Badge> : <Badge tone={TICKET_STATUS_TONE[t.status]}>{TICKET_STATUS_LABEL[t.status]}</Badge>}
                          <span className="text-[11.5px] text-ink-500">{fmtDateTime(t.updatedAt)}</span>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </motion.div>
      </motion.div>
    </div>
  );
}

function KpiTile({ kpi }: { kpi: Kpi }) {
  const Icon = kpi.icon;
  const body: ReactNode = (
    <>
      <div className="flex items-start justify-between">
        <span className={cn("grid h-10 w-10 place-items-center rounded-xl", kpi.tone)}>
          <Icon size={20} strokeWidth={2.1} />
        </span>
        {kpi.href ? <ArrowRight size={16} className="text-ink-600 transition-transform group-hover:translate-x-0.5 group-hover:text-ink-300" /> : null}
      </div>
      <p className="mt-4 font-display text-[28px] font-semibold leading-none tracking-tight text-ink-50">
        <Counter value={kpi.value} format={kpi.format} />
      </p>
      <p className="mt-1.5 text-[12.5px] font-semibold uppercase tracking-wide text-ink-400">{kpi.label}</p>
      {kpi.sub ? <p className="mt-1 text-[12.5px] text-ink-500">{kpi.sub}</p> : null}
    </>
  );
  const className = "group block rounded-3xl border border-white/6 bg-ink-800 p-5 shadow-card transition-colors hover:border-white/10";
  return (
    <motion.div variants={item.up} whileHover={{ y: -2 }}>
      {kpi.href ? (
        <Link href={kpi.href} className={className}>
          {body}
        </Link>
      ) : (
        <div className={className}>{body}</div>
      )}
    </motion.div>
  );
}

function ListSkeleton() {
  return (
    <div className="divide-y divide-white/5">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-5 py-3">
          <Skeleton className="h-9 w-9 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-40" />
            <Skeleton className="h-3 w-56" />
          </div>
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
      ))}
    </div>
  );
}
