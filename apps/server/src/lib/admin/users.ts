/**
 * Admin customer directory and account blocking.
 * Blocking is immediate: every session is revoked, a driver is taken offline
 * and their open offers are withdrawn.
 */
import { and, desc, eq, ilike, like, or, sql, type SQL } from "drizzle-orm";
import { normalizePkPhone, type Paginated, type UserDto } from "@raahi/shared";
import { getDb } from "@/db";
import { drivers, rides, users } from "@/db/schema";
import { audit, notify } from "@/lib/audit";
import { revokeAllSessions } from "@/lib/auth";
import { badRequest, forbidden, notFound } from "@/lib/errors";
import { toUserDto } from "@/lib/mappers";
import { countAll, likePattern, paginated, statusFilter, UUID_RE, type AdminActor, type PageParams } from "./common";
import { takeOffTheRoad } from "./drivers";

export type AdminCustomerItem = UserDto & { rides: number };

export interface UserActionInput {
  action: "block" | "unblock";
  reason?: string;
}

const CUSTOMER_FILTERS = ["active", "blocked"] as const;

/** Name / phone / email / id search shared by the customer list. */
function userSearchCondition(q: string): SQL {
  const phone = normalizePkPhone(q);
  const digits = q.replace(/\D/g, "");
  const parts: SQL[] = [ilike(users.fullName, likePattern(q)), ilike(users.email, likePattern(q))];
  if (phone) parts.push(eq(users.phone, phone));
  else if (digits.length >= 4) parts.push(like(users.phone, `%${digits}%`));
  if (UUID_RE.test(q)) parts.push(eq(users.id, q));
  return or(...parts)!;
}

export async function listCustomers(p: PageParams): Promise<Paginated<AdminCustomerItem>> {
  const db = await getDb();
  const filter = statusFilter(p.status, CUSTOMER_FILTERS);
  const conditions: SQL[] = [eq(users.role, "customer")];
  if (filter) conditions.push(eq(users.isBlocked, filter === "blocked"));
  if (p.q) conditions.push(userSearchCondition(p.q));
  const where = and(...conditions);

  const rideCounts = db
    .select({ customerId: rides.customerId, n: sql<number>`count(*)`.as("n") })
    .from(rides)
    .groupBy(rides.customerId)
    .as("ride_counts");

  const [rows, [total]] = await Promise.all([
    db
      .select({ user: users, rides: sql<number>`coalesce(${rideCounts.n}, 0)` })
      .from(users)
      .leftJoin(rideCounts, eq(rideCounts.customerId, users.id))
      .where(where)
      .orderBy(desc(users.createdAt))
      .limit(p.pageSize)
      .offset(p.offset),
    db.select({ n: countAll }).from(users).where(where),
  ]);
  return paginated(
    rows.map((r) => ({ ...toUserDto(r.user), rides: Number(r.rides ?? 0) })),
    total?.n,
    p,
  );
}

export async function applyUserAction(actor: AdminActor, userId: string, input: UserActionInput): Promise<UserDto> {
  const db = await getDb();
  const [target] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!target) throw notFound("User not found");
  if (target.id === actor.user.id) throw badRequest("You can't block your own account");
  if (target.role === "admin") throw forbidden("Admin accounts can't be blocked from the panel");
  const reason = input.reason?.trim() || null;
  const now = new Date();

  if (input.action === "block") {
    if (!target.isBlocked) {
      await db.update(users).set({ isBlocked: true, blockedReason: reason, updatedAt: now }).where(eq(users.id, userId));
      await revokeAllSessions(userId);
      if (target.role === "driver") {
        const [driver] = await db.select({ id: drivers.id }).from(drivers).where(eq(drivers.userId, userId)).limit(1);
        if (driver) {
          await takeOffTheRoad(driver.id, now);
          await db.update(drivers).set({ isOnline: false, updatedAt: now }).where(eq(drivers.id, driver.id));
        }
      }
    }
  } else if (target.isBlocked) {
    await db.update(users).set({ isBlocked: false, blockedReason: null, updatedAt: now }).where(eq(users.id, userId));
    await notify(userId, {
      type: "account_unblocked",
      title: "Your account is active again",
      body: "Thanks for your patience. You can sign in and use Raahi as usual.",
    });
  }

  await audit({
    actorId: actor.user.id,
    actorRole: "admin",
    action: `admin.user.${input.action}`,
    targetType: "user",
    targetId: userId,
    ip: actor.ip,
    meta: { role: target.role, wasBlocked: target.isBlocked, reason },
  });
  const [updated] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return toUserDto(updated!);
}
