import { and, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { notifications } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { parseOptionalBody } from "@/lib/core/body";
import { json, route } from "@/lib/http";
import { uuidSchema } from "@raahi/shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/http";

/** Omit `ids` (or send no body at all) to mark every notification as read. */
const markReadSchema = z.object({ ids: z.array(uuidSchema).min(1).max(200).optional() });

export const POST = route(async (req) => {
  const { user } = await requireAuth(req);
  const { ids } = await parseOptionalBody(req, markReadSchema);
  const db = await getDb();
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, user.id), isNull(notifications.readAt), ids ? inArray(notifications.id, ids) : undefined));
  return json({ ok: true });
});
