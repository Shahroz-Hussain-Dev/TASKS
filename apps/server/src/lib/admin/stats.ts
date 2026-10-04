import { and, eq, gte, gt, inArray, sql } from "drizzle-orm";
import { ts } from "@/lib/sql";
import { ACTIVE_RIDE_STATUSES, MARKET_RULES, VEHICLE_CATEGORIES, type AdminStatsDto, type VehicleCategory } from "@raahi/shared";
import { getDb } from "@/db";
import { drivers, rideRequests, rides, subscriptions, supportTickets, users } from "@/db/schema";
import { KARACHI_TZ, recentDayKeys, startOfKarachiDay, startOfKarachiMonth, toInt } from "./common";

const SERIES_DAYS = 14;
const CATEGORY_MIX_DAYS = 30;

/** Dashboard KPIs. Every number comes from one aggregate query per table; days are Pakistan-local. */
export async function adminStats(now = new Date()): Promise<AdminStatsDto> {
  const db = await getDb();
  const todayStart = startOfKarachiDay(now);
  const weekStart = startOfKarachiDay(now, 6);
  const seriesStart = startOfKarachiDay(now, SERIES_DAYS - 1);
  const mixStart = startOfKarachiDay(now, CATEGORY_MIX_DAYS - 1);
  const monthStart = startOfKarachiMonth(now);
  const staleCutoff = new Date(now.getTime() - MARKET_RULES.driverStaleSeconds * 1000);
  const dayOf = (column: typeof rides.completedAt | typeof users.createdAt) => sql<string>`to_char(${column} at time zone ${KARACHI_TZ}, 'YYYY-MM-DD')`;

  const [[people], [fleet], [requests], [trips], [revenue], [tickets], rideSeries, signupSeries, mix] = await Promise.all([
    db
      .select({
        customers: sql<number>`count(*) filter (where ${users.role} = 'customer')`,
      })
      .from(users),
    db
      .select({
        total: sql<number>`count(*)`,
        online: sql<number>`count(*) filter (where ${drivers.isOnline} and ${drivers.lastLocationAt} > ${ts(staleCutoff)})`,
        pending: sql<number>`count(*) filter (where ${drivers.status} = 'under_review')`,
      })
      .from(drivers),
    db
      .select({ open: sql<number>`count(*)` })
      .from(rideRequests)
      .where(and(eq(rideRequests.status, "open"), gt(rideRequests.expiresAt, now))),
    db
      .select({
        active: sql<number>`count(*) filter (where ${inArray(rides.status, [...ACTIVE_RIDE_STATUSES])})`,
        ridesToday: sql<number>`count(*) filter (where ${rides.status} = 'completed' and ${rides.completedAt} >= ${ts(todayStart)})`,
        ridesWeek: sql<number>`count(*) filter (where ${rides.status} = 'completed' and ${rides.completedAt} >= ${ts(weekStart)})`,
        gmvToday: sql<number>`coalesce(sum(${rides.farePkr}) filter (where ${rides.status} = 'completed' and ${rides.completedAt} >= ${ts(todayStart)}), 0)`,
        gmvWeek: sql<number>`coalesce(sum(${rides.farePkr}) filter (where ${rides.status} = 'completed' and ${rides.completedAt} >= ${ts(weekStart)}), 0)`,
      })
      .from(rides),
    db
      .select({ month: sql<number>`coalesce(sum(${subscriptions.amountPkr}), 0)` })
      .from(subscriptions)
      .where(and(inArray(subscriptions.status, ["active", "expired"]), gte(subscriptions.startsAt, monthStart))),
    db
      .select({ open: sql<number>`count(*)` })
      .from(supportTickets)
      .where(eq(supportTickets.status, "open")),
    db
      .select({ day: dayOf(rides.completedAt), rides: sql<number>`count(*)`, gmv: sql<number>`coalesce(sum(${rides.farePkr}), 0)` })
      .from(rides)
      .where(and(eq(rides.status, "completed"), gte(rides.completedAt, seriesStart)))
      .groupBy(sql`1`),
    db
      .select({ day: dayOf(users.createdAt), signups: sql<number>`count(*)` })
      .from(users)
      .where(and(inArray(users.role, ["customer", "driver"]), gte(users.createdAt, seriesStart)))
      .groupBy(sql`1`),
    db
      .select({ category: rides.category, rides: sql<number>`count(*)` })
      .from(rides)
      .where(and(inArray(rides.status, ["completed", ...ACTIVE_RIDE_STATUSES]), gte(rides.createdAt, mixStart)))
      .groupBy(rides.category),
  ]);

  const ridesByDay = new Map(rideSeries.map((r) => [r.day, { rides: toInt(r.rides), gmvPkr: toInt(r.gmv) }]));
  const signupsByDay = new Map(signupSeries.map((r) => [r.day, toInt(r.signups)]));
  const series = recentDayKeys(SERIES_DAYS, now).map((date) => {
    const r = ridesByDay.get(date);
    return { date, rides: r?.rides ?? 0, gmvPkr: r?.gmvPkr ?? 0, signups: signupsByDay.get(date) ?? 0 };
  });

  const mixByCategory = new Map<VehicleCategory, number>(mix.map((m) => [m.category, toInt(m.rides)]));
  const categoryMix = VEHICLE_CATEGORIES.map((category) => ({ category, rides: mixByCategory.get(category) ?? 0 }));

  return {
    customers: toInt(people?.customers),
    drivers: toInt(fleet?.total),
    driversOnline: toInt(fleet?.online),
    driversPendingReview: toInt(fleet?.pending),
    openRequests: toInt(requests?.open),
    activeRides: toInt(trips?.active),
    ridesToday: toInt(trips?.ridesToday),
    ridesWeek: toInt(trips?.ridesWeek),
    gmvTodayPkr: toInt(trips?.gmvToday),
    gmvWeekPkr: toInt(trips?.gmvWeek),
    subscriptionRevenueMonthPkr: toInt(revenue?.month),
    openTickets: toInt(tickets?.open),
    series,
    categoryMix,
  };
}
