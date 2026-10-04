/**
 * Admin side of support: the queue (escalated and open first) and human replies.
 */
import { and, asc, desc, eq, ilike, inArray, like, or, sql, type SQL } from "drizzle-orm";
import { SUPPORT_TICKET_STATUSES, normalizePkPhone, type Paginated, type SupportTicketDto } from "@raahi/shared";
import { getDb } from "@/db";
import { supportMessages, supportTickets, users } from "@/db/schema";
import { audit, notify } from "@/lib/audit";
import { notFound } from "@/lib/errors";
import { toSupportTicketDto } from "@/lib/mappers";
import { countAll, likePattern, paginated, statusFilter, UUID_RE, type AdminActor, type PageParams } from "./common";

export interface AdminReplyInput {
  body: string;
  resolve?: boolean;
}

const TICKET_FILTERS = [...SUPPORT_TICKET_STATUSES, "escalated"] as const;
const ticketWith = () => ({ user: true as const, messages: { orderBy: [asc(supportMessages.createdAt)] } });

export async function listSupportTickets(p: PageParams): Promise<Paginated<SupportTicketDto>> {
  const db = await getDb();
  const filter = statusFilter(p.status, TICKET_FILTERS);
  const conditions: SQL[] = [];
  if (filter === "escalated") conditions.push(and(eq(supportTickets.escalated, true), eq(supportTickets.status, "open"))!);
  else if (filter) conditions.push(eq(supportTickets.status, filter));
  if (p.q) {
    const phone = normalizePkPhone(p.q);
    const digits = p.q.replace(/\D/g, "");
    const userCond = phone ? eq(users.phone, phone) : digits.length >= 4 ? or(ilike(users.fullName, likePattern(p.q)), like(users.phone, `%${digits}%`)) : ilike(users.fullName, likePattern(p.q));
    const parts: SQL[] = [ilike(supportTickets.subject, likePattern(p.q)), inArray(supportTickets.userId, db.select({ id: users.id }).from(users).where(userCond))];
    if (UUID_RE.test(p.q)) parts.push(eq(supportTickets.id, p.q), eq(supportTickets.userId, p.q));
    conditions.push(or(...parts)!);
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const [rows, [total]] = await Promise.all([
    db.query.supportTickets.findMany({
      where,
      with: ticketWith(),
      // Humans asked for → anything else needing attention → by recency.
      orderBy: [
        sql`case when ${supportTickets.escalated} and ${supportTickets.status} = 'open' then 0 when ${supportTickets.status} = 'open' then 1 when ${supportTickets.status} = 'awaiting_user' then 2 else 3 end`,
        desc(supportTickets.lastMessageAt),
      ],
      limit: p.pageSize,
      offset: p.offset,
    }),
    db.select({ n: countAll }).from(supportTickets).where(where),
  ]);
  return paginated(rows.map(toSupportTicketDto), total?.n, p);
}

export async function replyToTicket(actor: AdminActor, ticketId: string, input: AdminReplyInput): Promise<SupportTicketDto> {
  const db = await getDb();
  const ticket = await db.query.supportTickets.findFirst({ where: eq(supportTickets.id, ticketId), with: { user: true } });
  if (!ticket) throw notFound("Support ticket not found");
  const now = new Date();
  const resolve = Boolean(input.resolve);

  await db.insert(supportMessages).values({ ticketId, sender: "admin", senderUserId: actor.user.id, body: input.body });
  await db
    .update(supportTickets)
    .set({ status: resolve ? "resolved" : "awaiting_user", resolvedAt: resolve ? now : null, lastMessageAt: now, updatedAt: now })
    .where(eq(supportTickets.id, ticketId));

  await notify(ticket.userId, {
    type: "support_reply",
    title: resolve ? "Raahi support resolved your request" : "Raahi support replied",
    body: input.body.length > 280 ? `${input.body.slice(0, 277).trimEnd()}…` : input.body,
    data: { ticketId },
  });
  await audit({
    actorId: actor.user.id,
    actorRole: "admin",
    action: resolve ? "admin.support.resolve" : "admin.support.reply",
    targetType: "support_ticket",
    targetId: ticketId,
    ip: actor.ip,
    meta: { userId: ticket.userId, escalated: ticket.escalated, previousStatus: ticket.status, length: input.body.length },
  });

  const updated = await db.query.supportTickets.findFirst({ where: eq(supportTickets.id, ticketId), with: ticketWith() });
  if (!updated) throw notFound("Support ticket not found");
  return toSupportTicketDto(updated);
}
