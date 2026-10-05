import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { hashPassword, issueTokens, requireAuth, revokeAllSessions, verifyPassword } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { setAdminCookie } from "@/lib/core/admin-cookie";
import { requestMeta } from "@/lib/core/request-meta";
import { badRequest } from "@/lib/errors";
import { json, parseBody, route } from "@/lib/http";
import { memoryLimit } from "@/lib/rate-limit";
import { changePasswordSchema } from "@raahi/shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/http";

export const POST = route(async (req) => {
  const { user } = await requireAuth(req);
  // A stolen access token must not become a password oracle.
  memoryLimit(`password:${user.id}`, 10, 15 * 60_000);
  const body = await parseBody(req, changePasswordSchema);

  if (!(await verifyPassword(body.currentPassword, user.passwordHash))) throw badRequest("Your current password is incorrect");
  if (body.currentPassword === body.newPassword) throw badRequest("Choose a new password that is different from your current one");

  const db = await getDb();
  const passwordHash = await hashPassword(body.newPassword);
  await db.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, user.id));

  // Every other device is signed out; this device continues with a fresh session.
  await revokeAllSessions(user.id);
  const meta = requestMeta(req);
  const tokens = await issueTokens(user, meta);
  await audit({ actorId: user.id, actorRole: user.role, action: "auth.password_change", targetType: "user", targetId: user.id, ip: meta.ip });

  const res = json({ ok: true, tokens });
  if (user.role === "admin") setAdminCookie(res, req, tokens.accessToken);
  return res;
});
