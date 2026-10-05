import { randomBytes } from "node:crypto";
import { and, eq, inArray, ne } from "drizzle-orm";
import { getDb } from "@/db";
import { bids, drivers, rideRequests, rides, users, type User } from "@/db/schema";
import { hashPassword, requireAuth, revokeAllSessions } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { loadDriverDto } from "@/lib/core/auth-response";
import { isUniqueViolation } from "@/lib/core/db-errors";
import { badRequest, conflict, forbidden } from "@/lib/errors";
import { clientIp, json, parseBody, route } from "@/lib/http";
import { toUserDto } from "@/lib/mappers";
import { deleteFile, getFileMeta } from "@/lib/storage";
import { ACTIVE_RIDE_STATUSES, updateProfileSchema } from "@raahi/shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/http";

const EMAIL_TAKEN = "This email is already linked to another account.";

async function profileResponse(user: User) {
  return json({ user: toUserDto(user), driver: await loadDriverDto(user) });
}

/** Remove an avatar file that nothing references any more; never touches documents or receipts. */
async function discardAvatar(fileId: string | null) {
  if (!fileId) return;
  const meta = await getFileMeta(fileId).catch(() => null);
  if (meta?.kind === "avatar") await deleteFile(fileId).catch(() => undefined);
}

export const GET = route(async (req) => {
  const { user } = await requireAuth(req);
  return profileResponse(user);
});

export const PATCH = route(async (req) => {
  const { user } = await requireAuth(req);
  const body = await parseBody(req, updateProfileSchema);
  const db = await getDb();

  const patch: Partial<typeof users.$inferInsert> = {};
  if (body.fullName !== undefined && body.fullName !== user.fullName) patch.fullName = body.fullName;

  if (body.email !== undefined && body.email !== user.email) {
    const [taken] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.email, body.email), eq(users.role, user.role), ne(users.id, user.id)))
      .limit(1);
    if (taken) throw conflict(EMAIL_TAKEN);
    patch.email = body.email;
  }

  let previousAvatar: string | null = null;
  if (body.avatarFileId !== undefined && body.avatarFileId !== user.avatarFileId) {
    if (body.avatarFileId !== null) {
      const file = await getFileMeta(body.avatarFileId).catch(() => null);
      if (!file || file.ownerId !== user.id || file.kind !== "avatar") throw badRequest("That photo could not be found. Upload it again.");
    }
    previousAvatar = user.avatarFileId;
    patch.avatarFileId = body.avatarFileId;
  }

  if (Object.keys(patch).length === 0) return profileResponse(user);

  let updated: User;
  try {
    const [row] = await db
      .update(users)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(users.id, user.id))
      .returning();
    updated = row ?? user;
  } catch (err) {
    if (isUniqueViolation(err)) throw conflict(EMAIL_TAKEN);
    throw err;
  }
  await discardAvatar(previousAvatar);
  await audit({
    actorId: user.id,
    actorRole: user.role,
    action: "profile.update",
    targetType: "user",
    targetId: user.id,
    meta: { fields: Object.keys(patch) },
    ip: clientIp(req),
  });
  return profileResponse(updated);
});

export const DELETE = route(async (req) => {
  const { user, driver } = await requireAuth(req);
  if (user.role === "admin") throw forbidden("Admin accounts are managed from the admin panel");
  const db = await getDb();

  const [activeRide] = await db
    .select({ id: rides.id })
    .from(rides)
    .where(and(driver ? eq(rides.driverId, driver.id) : eq(rides.customerId, user.id), inArray(rides.status, [...ACTIVE_RIDE_STATUSES])))
    .limit(1);
  if (activeRide) throw conflict("Finish or cancel your active ride before deleting your account", { rideId: activeRide.id });

  if (user.role === "customer") {
    const [openRequest] = await db
      .select({ id: rideRequests.id })
      .from(rideRequests)
      .where(and(eq(rideRequests.customerId, user.id), eq(rideRequests.status, "open")))
      .limit(1);
    if (openRequest) throw conflict("Cancel your open ride request before deleting your account", { requestId: openRequest.id });
  }

  const now = new Date();
  // Nobody can ever sign in to a deleted account: the hash is of a secret that is immediately discarded.
  const unusableHash = await hashPassword(randomBytes(32).toString("hex"));
  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({
        fullName: "Deleted user",
        phone: null,
        email: null,
        avatarFileId: null,
        passwordHash: unusableHash,
        isBlocked: true,
        blockedReason: "Account deleted by the user",
        updatedAt: now,
      })
      .where(eq(users.id, user.id));
    if (driver) {
      await tx
        .update(drivers)
        .set({
          isOnline: false,
          status: "suspended",
          statusReason: "Account deleted by the user",
          cnic: null,
          dateOfBirth: null,
          licenseNumber: null,
          licenseExpiry: null,
          emergencyContact: null,
          updatedAt: now,
        })
        .where(eq(drivers.id, driver.id));
      await tx
        .update(bids)
        .set({ status: "withdrawn", respondedAt: now })
        .where(and(eq(bids.driverId, driver.id), eq(bids.status, "pending")));
    }
  });
  await revokeAllSessions(user.id);
  await discardAvatar(user.avatarFileId);
  await audit({ actorId: user.id, actorRole: user.role, action: "account.delete", targetType: "user", targetId: user.id, ip: clientIp(req) });
  return json({ ok: true });
});
