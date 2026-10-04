import { rotateRefreshToken } from "@/lib/auth";
import { setAdminCookie } from "@/lib/core/admin-cookie";
import { requestMeta } from "@/lib/core/request-meta";
import { json, parseBody, route } from "@/lib/http";
import { memoryLimit } from "@/lib/rate-limit";
import { refreshSchema } from "@raahi/shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/http";

export const POST = route(async (req) => {
  const meta = requestMeta(req);
  memoryLimit(`refresh:${meta.ip}`, 60, 60_000);
  const { refreshToken } = await parseBody(req, refreshSchema);
  const { user, tokens } = await rotateRefreshToken(refreshToken, meta);
  const res = json({ tokens });
  // The admin panel authenticates with the cookie, so a refresh must renew it as well.
  if (user.role === "admin") setAdminCookie(res, req, tokens.accessToken);
  return res;
});
