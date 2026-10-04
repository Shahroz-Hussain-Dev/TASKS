import { and, desc, eq, ilike, or, type SQL } from "drizzle-orm";
import type { Paginated } from "@raahi/shared";
import { getDb } from "@/db";
import { auditLogs, users } from "@/db/schema";
import { countAll, likePattern, paginated, UUID_RE, type PageParams } from "./common";

/** Serialised audit entry. Mirrors the `audit_logs` row plus the actor's display name. */
export interface AuditLogDto {
  id: string;
  actorId: string | null;
  actorRole: string | null;
  actorName: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  meta: Record<string, unknown> | null;
  ip: string | null;
  createdAt: string;
}

type AuditRow = typeof auditLogs.$inferSelect;

export function toAuditLogDto(row: AuditRow, actorName: string | null): AuditLogDto {
  return {
    id: row.id,
    actorId: row.actorId,
    actorRole: row.actorRole,
    actorName,
    action: row.action,
    targetType: row.targetType,
    targetId: row.targetId,
    meta: (row.meta as Record<string, unknown> | null) ?? null,
    ip: row.ip,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Audit trail, newest first.
 *   q      — an id (matches actor or target), or free text matched against the action name and actor name
 *   status — restricts to one target type (driver, user, subscription, document, settings, support_ticket…)
 */
export async function listAudit(p: PageParams): Promise<Paginated<AuditLogDto>> {
  const db = await getDb();
  const conditions: SQL[] = [];
  if (p.status) conditions.push(eq(auditLogs.targetType, p.status));
  if (p.q) {
    if (UUID_RE.test(p.q)) {
      conditions.push(or(eq(auditLogs.actorId, p.q), eq(auditLogs.targetId, p.q), eq(auditLogs.id, p.q))!);
    } else {
      conditions.push(or(ilike(auditLogs.action, likePattern(p.q)), ilike(users.fullName, likePattern(p.q)))!);
    }
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const base = () => db.select({ log: auditLogs, actorName: users.fullName }).from(auditLogs).leftJoin(users, eq(users.id, auditLogs.actorId)).where(where);
  const [rows, [total]] = await Promise.all([
    base().orderBy(desc(auditLogs.createdAt)).limit(p.pageSize).offset(p.offset),
    db.select({ n: countAll }).from(auditLogs).leftJoin(users, eq(users.id, auditLogs.actorId)).where(where),
  ]);
  return paginated(
    rows.map((r) => toAuditLogDto(r.log, r.actorName)),
    total?.n,
    p,
  );
}
