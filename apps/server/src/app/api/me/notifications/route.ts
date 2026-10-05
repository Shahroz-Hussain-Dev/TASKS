import { desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { notifications } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { json, parseQuery, route } from "@/lib/http";
import { toNotificationDto } from "@/lib/mappers";
import { paginationSchema, type NotificationDto, type Paginated } from "@raahi/shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/http";

export const GET = route(async (req) => {
  const { user } = await requireAuth(req);
  const query = parseQuery(req, paginationSchema);
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;
  const db = await getDb();

  const [rows, [counts]] = await Promise.all([
    db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, user.id))
      .orderBy(desc(notifications.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({
        total: sql<number>`count(*)`,
        unread: sql<number>`count(*) filter (where ${notifications.readAt} is null)`,
      })
      .from(notifications)
      .where(eq(notifications.userId, user.id)),
  ]);

  const body: Paginated<NotificationDto> & { unread: number } = {
    items: rows.map(toNotificationDto),
    page,
    pageSize,
    total: Number(counts?.total ?? 0),
    unread: Number(counts?.unread ?? 0),
  };
  return json(body);
});
