import { getDb } from "@/db";
import { auditLogs, notifications } from "@/db/schema";

export async function audit(entry: {
  actorId?: string | null;
  actorRole?: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  meta?: Record<string, unknown>;
  ip?: string;
}) {
  try {
    const db = await getDb();
    await db.insert(auditLogs).values({
      actorId: entry.actorId ?? null,
      actorRole: entry.actorRole ?? null,
      action: entry.action,
      targetType: entry.targetType ?? null,
      targetId: entry.targetId ?? null,
      meta: entry.meta ?? null,
      ip: entry.ip ?? null,
    });
  } catch (err) {
    console.error("[audit] failed", err);
  }
}

/** In-app notification (polled by the clients). */
export async function notify(userId: string, n: { type: string; title: string; body: string; data?: Record<string, unknown> }) {
  try {
    const db = await getDb();
    await db.insert(notifications).values({ userId, type: n.type, title: n.title.slice(0, 120), body: n.body.slice(0, 300), data: n.data ?? null });
  } catch (err) {
    console.error("[notify] failed", err);
  }
}
