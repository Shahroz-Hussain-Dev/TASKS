import { and, eq, or } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { getDb } from "@/db";
import { drivers, rides, type FileRow } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { forbidden } from "@/lib/errors";

/**
 * Who may read a stored file:
 *  - public files (avatars): anyone, no credentials needed
 *  - the owner
 *  - admins, who review every driver document and subscription receipt
 *  - the counterpart of any ride shared with the owner (passenger ↔ driver),
 *    so each side can see the other's photo during and after a trip
 */
export async function assertCanViewFile(req: NextRequest, file: Pick<FileRow, "ownerId" | "isPublic" | "kind">): Promise<void> {
  if (file.isPublic) return;
  const { user } = await requireAuth(req);
  if (user.role === "admin") return;
  if (!file.ownerId) throw forbidden("You do not have access to this file");
  if (file.ownerId === user.id) return;
  // The ride counterpart may only see the other party's photo — never their CNIC, licence or receipts.
  if (file.kind !== "avatar") throw forbidden("You do not have access to this file");

  const db = await getDb();
  const [shared] = await db
    .select({ id: rides.id })
    .from(rides)
    .innerJoin(drivers, eq(drivers.id, rides.driverId))
    .where(
      or(
        and(eq(rides.customerId, user.id), eq(drivers.userId, file.ownerId)),
        and(eq(drivers.userId, user.id), eq(rides.customerId, file.ownerId)),
      ),
    )
    .limit(1);
  if (!shared) throw forbidden("You do not have access to this file");
}
