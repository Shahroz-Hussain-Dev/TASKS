import { revokeSession, verifyAccessToken } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { ADMIN_COOKIE, clearAdminCookie } from "@/lib/core/admin-cookie";
import { clientIp, json, route } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/http";

export const POST = route(async (req) => {
  const cookieToken = req.cookies.get(ADMIN_COOKIE)?.value;
  const header = req.headers.get("authorization");
  const token = cookieToken ?? (header?.startsWith("Bearer ") ? header.slice(7).trim() : undefined);
  if (token) {
    try {
      const claims = await verifyAccessToken(token);
      await revokeSession(claims.sid);
      await audit({ actorId: claims.sub, actorRole: claims.role, action: "auth.admin_logout", targetType: "session", targetId: claims.sid, ip: clientIp(req) });
    } catch {
      // An expired or tampered cookie has nothing to revoke; clearing it is all that is needed.
    }
  }
  const res = json({ ok: true });
  clearAdminCookie(res, req);
  return res;
});
