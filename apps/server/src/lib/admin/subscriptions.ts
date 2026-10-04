/**
 * Admin subscription review. Approving a receipt activates PKR 1,000 / month
 * access; an early renewal never loses days because the new period starts
 * where the current one ends.
 */
import { and, asc, desc, eq, gt, ilike, inArray, like, or, sql, type SQL } from "drizzle-orm";
import { SUBSCRIPTION_STATUSES, normalizePkPhone, type Paginated, type SubscriptionDto } from "@raahi/shared";
import { getDb } from "@/db";
import { drivers, subscriptions, users } from "@/db/schema";
import { audit, notify } from "@/lib/audit";
import { conflict, notFound } from "@/lib/errors";
import { toSubscriptionDto } from "@/lib/mappers";
import { getSettings } from "@/lib/settings";
import { countAll, likePattern, paginated, statusFilter, UUID_RE, type AdminActor, type PageParams } from "./common";
import { maybeAutoApprove } from "./drivers";

export type AdminSubscriptionItem = SubscriptionDto & { driver: { id: string; fullName: string; phone: string | null } };

export interface SubscriptionDecisionInput {
  decision: "approve" | "reject";
  note?: string;
}

const DAY_MS = 86_400_000;
const dateFmt = new Intl.DateTimeFormat("en-PK", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Karachi" });

export async function listSubscriptions(p: PageParams): Promise<Paginated<AdminSubscriptionItem>> {
  const db = await getDb();
  const status = statusFilter(p.status, SUBSCRIPTION_STATUSES);
  const conditions: SQL[] = [];
  if (status) conditions.push(eq(subscriptions.status, status));
  if (p.q) {
    const phone = normalizePkPhone(p.q);
    const digits = p.q.replace(/\D/g, "");
    const parts: SQL[] = [ilike(users.fullName, likePattern(p.q)), ilike(subscriptions.transactionRef, likePattern(p.q))];
    if (phone) parts.push(eq(users.phone, phone));
    else if (digits.length >= 4) parts.push(like(users.phone, `%${digits}%`));
    if (UUID_RE.test(p.q)) parts.push(eq(subscriptions.id, p.q), eq(subscriptions.driverId, p.q));
    conditions.push(or(...parts)!);
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const base = () =>
    db
      .select({ sub: subscriptions, driverId: drivers.id, fullName: users.fullName, phone: users.phone })
      .from(subscriptions)
      .innerJoin(drivers, eq(drivers.id, subscriptions.driverId))
      .innerJoin(users, eq(users.id, drivers.userId))
      .where(where);

  const [rows, [total]] = await Promise.all([
    // Receipts waiting for a decision float to the top; everything else newest first.
    base()
      .orderBy(sql`case when ${subscriptions.status} = 'pending' then 0 else 1 end`, desc(subscriptions.createdAt))
      .limit(p.pageSize)
      .offset(p.offset),
    db.select({ n: countAll }).from(subscriptions).innerJoin(drivers, eq(drivers.id, subscriptions.driverId)).innerJoin(users, eq(users.id, drivers.userId)).where(where),
  ]);
  return paginated(
    rows.map((r) => ({ ...toSubscriptionDto(r.sub), driver: { id: r.driverId, fullName: r.fullName, phone: r.phone } })),
    total?.n,
    p,
  );
}

export async function decideSubscription(actor: AdminActor, subscriptionId: string, input: SubscriptionDecisionInput): Promise<SubscriptionDto> {
  const db = await getDb();
  const sub = await db.query.subscriptions.findFirst({ where: eq(subscriptions.id, subscriptionId), with: { driver: true } });
  if (!sub) throw notFound("Subscription receipt not found");
  if (sub.status !== "pending") throw conflict(`This receipt has already been ${sub.status === "active" ? "approved" : sub.status}`);
  const note = input.note?.trim() || null;
  const now = new Date();

  if (input.decision === "reject") {
    const [updated] = await db
      .update(subscriptions)
      .set({ status: "rejected", reviewerNote: note, reviewedBy: actor.user.id, reviewedAt: now, updatedAt: now })
      .where(eq(subscriptions.id, subscriptionId))
      .returning();
    await notify(sub.driver.userId, {
      type: "subscription_rejected",
      title: "Receipt not accepted",
      body: note ?? "We couldn't match your payment receipt. Check the amount and account, then upload a clear screenshot again.",
      data: { subscriptionId },
    });
    await audit({ actorId: actor.user.id, actorRole: "admin", action: "admin.subscription.reject", targetType: "subscription", targetId: subscriptionId, ip: actor.ip, meta: { driverId: sub.driverId, amountPkr: sub.amountPkr, method: sub.method, note } });
    return toSubscriptionDto(updated!);
  }

  const settings = await getSettings();
  const updated = await db.transaction(async (tx) => {
    const active = await tx
      .select()
      .from(subscriptions)
      .where(and(eq(subscriptions.driverId, sub.driverId), eq(subscriptions.status, "active"), gt(subscriptions.endsAt, now)))
      .orderBy(asc(subscriptions.endsAt));
    const base = active.reduce((latest, s) => (s.endsAt && s.endsAt.getTime() > latest.getTime() ? s.endsAt : latest), now);
    const endsAt = new Date(base.getTime() + settings.subscriptionDays * DAY_MS);
    if (active.length > 0) {
      await tx
        .update(subscriptions)
        .set({ status: "expired", reviewerNote: "Rolled into a renewal", updatedAt: now })
        .where(inArray(subscriptions.id, active.map((s) => s.id)));
    }
    const [row] = await tx
      .update(subscriptions)
      .set({ status: "active", startsAt: now, endsAt, reviewerNote: note ?? "Approved by Raahi", reviewedBy: actor.user.id, reviewedAt: now, updatedAt: now })
      .where(eq(subscriptions.id, subscriptionId))
      .returning();
    return row!;
  });

  await notify(sub.driver.userId, {
    type: "subscription_active",
    title: "Subscription active",
    body: `Your payment is confirmed. Your Raahi driver subscription is active until ${dateFmt.format(updated.endsAt!)}. 100% of every fare is yours.`,
    data: { subscriptionId },
  });
  await audit({
    actorId: actor.user.id,
    actorRole: "admin",
    action: "admin.subscription.approve",
    targetType: "subscription",
    targetId: subscriptionId,
    ip: actor.ip,
    meta: { driverId: sub.driverId, amountPkr: sub.amountPkr, method: sub.method, expectedPkr: settings.driverSubscriptionPkr, endsAt: updated.endsAt?.toISOString() ?? null, note },
  });
  await maybeAutoApprove(actor, sub.driverId, "subscription");
  return toSubscriptionDto(updated);
}
