/**
 * Admin driver management: review queue, full profile, and the four
 * decisions (approve / reject / suspend / reinstate).
 */
import { and, asc, desc, eq, ilike, inArray, like, or, type SQL } from "drizzle-orm";
import {
  DOCUMENT_META,
  DOCUMENT_TYPES,
  DRIVER_STATUSES,
  normalizePkPhone,
  type DriverDto,
  type Paginated,
  type RideDto,
  type UserDto,
} from "@raahi/shared";
import { getDb, type Db } from "@/db";
import { auditLogs, bids, driverDocuments, drivers, rides, subscriptions, users, type Driver, type DriverDocument, type Subscription, type User, type Vehicle } from "@/db/schema";
import { audit, notify } from "@/lib/audit";
import { badRequest, conflict, notFound } from "@/lib/errors";
import { isSubscriptionActive, toDriverDto, toRideDto, toUserDto, type RideWithRelations } from "@/lib/mappers";
import { toAuditLogDto, type AuditLogDto } from "./audit";
import { countAll, likePattern, paginated, statusFilter, UUID_RE, type AdminActor, type PageParams } from "./common";

export type AdminDriverItem = DriverDto & { user: UserDto };
export interface AdminDriverDetail extends AdminDriverItem {
  rides: RideDto[];
  audit: AuditLogDto[];
}

export interface DriverDecisionInput {
  decision: "approve" | "reject" | "suspend" | "reinstate";
  reason?: string;
}

export type DriverFull = Driver & { user: User; vehicle: Vehicle | null; documents: DriverDocument[]; subscriptions: Subscription[] };

const REQUIRED_DOCS = DOCUMENT_TYPES.filter((t) => DOCUMENT_META[t].required);
const DETAIL_RIDES = 10;
const DETAIL_AUDIT = 30;

export const driverWith = () => ({
  user: true as const,
  vehicle: true as const,
  documents: { orderBy: [asc(driverDocuments.type)] },
  subscriptions: { orderBy: [desc(subscriptions.createdAt)] },
});

export async function loadDriverFull(driverId: string): Promise<DriverFull> {
  const db = await getDb();
  const row = await db.query.drivers.findFirst({ where: eq(drivers.id, driverId), with: driverWith() });
  if (!row) throw notFound("Driver not found");
  return row;
}

export const toAdminDriverItem = (d: DriverFull): AdminDriverItem => ({ ...toDriverDto(d), user: toUserDto(d.user) });

/* ------------------------------------------------------------------ */
/* Queries                                                             */
/* ------------------------------------------------------------------ */

/** Search drivers by name, phone (any PK format) or CNIC digits. */
export function driverSearchCondition(db: Db, q: string): SQL | undefined {
  const conditions: SQL[] = [];
  const phone = normalizePkPhone(q);
  const digits = q.replace(/\D/g, "");
  const userMatch = db
    .select({ id: users.id })
    .from(users)
    .where(
      phone
        ? eq(users.phone, phone)
        : digits.length >= 4
          ? or(ilike(users.fullName, likePattern(q)), like(users.phone, `%${digits}%`))
          : ilike(users.fullName, likePattern(q)),
    );
  conditions.push(inArray(drivers.userId, userMatch));
  if (digits.length >= 4) conditions.push(like(drivers.cnic, `%${digits}%`));
  if (UUID_RE.test(q)) conditions.push(eq(drivers.id, q));
  return or(...conditions);
}

export async function listDrivers(p: PageParams): Promise<Paginated<AdminDriverItem>> {
  const db = await getDb();
  const status = statusFilter(p.status, DRIVER_STATUSES);
  const conditions: SQL[] = [];
  if (status) conditions.push(eq(drivers.status, status));
  if (p.q) {
    const search = driverSearchCondition(db, p.q);
    if (search) conditions.push(search);
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  // The review queue is served oldest-first so nobody waits longer than they must.
  const orderBy = status === "under_review" ? [asc(drivers.submittedAt), asc(drivers.createdAt)] : [desc(drivers.createdAt)];

  const [rows, [total]] = await Promise.all([
    db.query.drivers.findMany({ where, with: driverWith(), orderBy, limit: p.pageSize, offset: p.offset }),
    db.select({ n: countAll }).from(drivers).where(where),
  ]);
  return paginated(rows.map(toAdminDriverItem), total?.n, p);
}

export async function getDriverDetail(driverId: string): Promise<AdminDriverDetail> {
  const db = await getDb();
  const driver = await loadDriverFull(driverId);
  const [recentRides, trail] = await Promise.all([
    db.query.rides.findMany({
      where: eq(rides.driverId, driverId),
      with: { customer: true, driver: { with: { user: true, vehicle: true } }, ratings: true },
      orderBy: [desc(rides.createdAt)],
      limit: DETAIL_RIDES,
    }),
    db
      .select({ log: auditLogs, actorName: users.fullName })
      .from(auditLogs)
      .leftJoin(users, eq(users.id, auditLogs.actorId))
      .where(
        or(
          and(eq(auditLogs.targetType, "driver"), eq(auditLogs.targetId, driverId)),
          and(eq(auditLogs.targetType, "user"), eq(auditLogs.targetId, driver.userId)),
          and(eq(auditLogs.actorId, driver.userId)),
        ),
      )
      .orderBy(desc(auditLogs.createdAt))
      .limit(DETAIL_AUDIT),
  ]);
  return {
    ...toAdminDriverItem(driver),
    rides: recentRides.map((r) => toRideDto(r as RideWithRelations, r.customerId)),
    audit: trail.map((t) => toAuditLogDto(t.log, t.actorName)),
  };
}

/* ------------------------------------------------------------------ */
/* Decisions                                                           */
/* ------------------------------------------------------------------ */

export async function decideDriver(actor: AdminActor, driverId: string, input: DriverDecisionInput): Promise<DriverDto> {
  const db = await getDb();
  const driver = await loadDriverFull(driverId);
  const now = new Date();
  const reason = input.reason?.trim() || undefined;
  const subscriptionActive = driver.subscriptions.some((s) => isSubscriptionActive(s, now));
  const review = { reviewedAt: now, reviewedBy: actor.user.id, updatedAt: now };

  switch (input.decision) {
    case "approve": {
      if (driver.status === "approved") throw conflict("This driver is already approved");
      if (driver.status === "suspended") throw conflict("This driver is suspended. Use Reinstate to put them back on the road.");
      if (!subscriptionActive) {
        throw conflict(
          "This driver has no active subscription. Approve their pending receipt first, or ask them to pay the monthly subscription — approval is blocked until it is active.",
          { driverId, subscription: driver.subscriptions[0]?.status ?? "none" },
        );
      }
      await db.update(drivers).set({ status: "approved", statusReason: null, submittedAt: driver.submittedAt ?? now, ...review }).where(eq(drivers.id, driverId));
      await notify(driver.userId, {
        type: "driver_approved",
        title: "You're approved 🎉",
        body: "Welcome to Raahi. Go online and start earning — 100% of every fare is yours.",
      });
      break;
    }
    case "reject": {
      if (!reason) throw badRequest("Give the driver a reason so they know what to fix");
      if (driver.status === "rejected") throw conflict("This driver has already been rejected");
      await takeOffTheRoad(driverId, now);
      await db.update(drivers).set({ status: "rejected", statusReason: reason, isOnline: false, ...review }).where(eq(drivers.id, driverId));
      await notify(driver.userId, {
        type: "driver_rejected",
        title: "Application not approved",
        body: `${reason} Open the app to fix this and resubmit.`.slice(0, 300),
      });
      break;
    }
    case "suspend": {
      if (!reason) throw badRequest("Give a reason for the suspension — the driver will see it");
      if (driver.status === "suspended") throw conflict("This driver is already suspended");
      await takeOffTheRoad(driverId, now);
      await db.update(drivers).set({ status: "suspended", statusReason: reason, isOnline: false, ...review }).where(eq(drivers.id, driverId));
      await notify(driver.userId, {
        type: "driver_suspended",
        title: "Account suspended",
        body: `${reason} Contact Raahi support to resolve this.`.slice(0, 300),
      });
      break;
    }
    case "reinstate": {
      if (driver.status !== "suspended") throw conflict("Only suspended drivers can be reinstated");
      await db.update(drivers).set({ status: "approved", statusReason: null, ...review }).where(eq(drivers.id, driverId));
      await notify(driver.userId, {
        type: "driver_reinstated",
        title: "You're back on the road",
        body: subscriptionActive
          ? "Your account has been reinstated. Go online whenever you're ready."
          : "Your account has been reinstated. Renew your monthly subscription to go online.",
      });
      break;
    }
  }

  await audit({
    actorId: actor.user.id,
    actorRole: "admin",
    action: `admin.driver.${input.decision}`,
    targetType: "driver",
    targetId: driverId,
    ip: actor.ip,
    meta: { previousStatus: driver.status, reason: reason ?? null, subscriptionActive },
  });
  return toDriverDto(await loadDriverFull(driverId));
}

/** Withdraw open offers so passengers are not left waiting on a driver who can no longer drive. */
export async function takeOffTheRoad(driverId: string, now = new Date()): Promise<void> {
  const db = await getDb();
  await db.update(bids).set({ status: "withdrawn", respondedAt: now, updatedAt: now }).where(and(eq(bids.driverId, driverId), eq(bids.status, "pending")));
}

/**
 * A driver waiting for review whose documents are all verified and whose
 * subscription is active needs no human: approve them on the spot.
 */
export async function maybeAutoApprove(actor: AdminActor, driverId: string, trigger: string): Promise<boolean> {
  const full = await loadDriverFull(driverId);
  if (full.status !== "under_review") return false;
  const docsVerified = REQUIRED_DOCS.every((t) => full.documents.some((d) => d.type === t && d.status === "verified"));
  const subscriptionActive = full.subscriptions.some((s) => isSubscriptionActive(s));
  if (!docsVerified || !subscriptionActive) return false;
  const db = await getDb();
  const now = new Date();
  await db.update(drivers).set({ status: "approved", statusReason: null, reviewedAt: now, reviewedBy: actor.user.id, updatedAt: now }).where(eq(drivers.id, driverId));
  await notify(full.userId, {
    type: "driver_approved",
    title: "You're approved 🎉",
    body: "Every document checked out and your subscription is active. Go online and start earning — 100% of each fare is yours.",
  });
  await audit({ actorId: actor.user.id, actorRole: "admin", action: "admin.driver.auto_approve", targetType: "driver", targetId: driverId, ip: actor.ip, meta: { trigger } });
  return true;
}
