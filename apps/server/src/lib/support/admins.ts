import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { notify } from "@/lib/audit";

export interface AdminNotification {
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

/** Fan an in-app notification out to every active admin account. */
export async function notifyAdmins(n: AdminNotification): Promise<void> {
  const db = await getDb();
  const admins = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.role, "admin"), eq(users.isBlocked, false)));
  await Promise.all(admins.map((a) => notify(a.id, n)));
}
