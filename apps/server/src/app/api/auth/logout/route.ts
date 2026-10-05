import { requireAuth, revokeSession } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { ADMIN_COOKIE, clearAdminCookie } from "@/lib/core/admin-cookie";
import { clientIp, json, route } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/http";

export const POST = route(async (req) => {
  const { user, claims } = await requireAuth(req);
  await revokeSession(claims.sid);
  await audit({ actorId: user.id, actorRole: user.role, action: "auth.logout", targetType: "session", targetId: claims.sid, ip: clientIp(req) });
  const res = json({ ok: true });
  if (req.cookies.has(ADMIN_COOKIE)) clearAdminCookie(res, req);
  return res;
});
