import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { issueTokens } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { setAdminCookie } from "@/lib/core/admin-cookie";
import { authenticateWithPassword } from "@/lib/core/credentials";
import { requestMeta } from "@/lib/core/request-meta";
import { json, parseBody, route } from "@/lib/http";
import { toUserDto } from "@/lib/mappers";
import { memoryLimit } from "@/lib/rate-limit";
import { adminLoginSchema } from "@raahi/shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/http";

export const POST = route(async (req) => {
  const meta = requestMeta(req);
  memoryLimit(`login:${meta.ip}`, 30, 60_000);
  const body = await parseBody(req, adminLoginSchema);
  const email = body.email.toLowerCase();
  const db = await getDb();

  const user = await authenticateWithPassword({
    identifier: email,
    role: "admin",
    password: body.password,
    ip: meta.ip,
    lookup: async () => {
      const [row] = await db
        .select()
        .from(users)
        .where(and(eq(users.email, email), eq(users.role, "admin")))
        .limit(1);
      return row;
    },
  });

  const tokens = await issueTokens(user, meta);
  await audit({ actorId: user.id, actorRole: "admin", action: "auth.admin_login", targetType: "user", targetId: user.id, ip: meta.ip });
  const res = json({ user: toUserDto(user), tokens });
  setAdminCookie(res, req, tokens.accessToken);
  return res;
});
