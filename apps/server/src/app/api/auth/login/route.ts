import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { issueTokens } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { buildAuthResponse } from "@/lib/core/auth-response";
import { authenticateWithPassword } from "@/lib/core/credentials";
import { requestMeta } from "@/lib/core/request-meta";
import { json, parseBody, route } from "@/lib/http";
import { memoryLimit } from "@/lib/rate-limit";
import { loginSchema } from "@raahi/shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/http";

export const POST = route(async (req) => {
  const meta = requestMeta(req);
  memoryLimit(`login:${meta.ip}`, 30, 60_000);
  const body = await parseBody(req, loginSchema);
  const db = await getDb();

  const user = await authenticateWithPassword({
    identifier: body.phone,
    role: body.role,
    password: body.password,
    ip: meta.ip,
    lookup: async () => {
      const [row] = await db
        .select()
        .from(users)
        .where(and(eq(users.phone, body.phone), eq(users.role, body.role)))
        .limit(1);
      return row;
    },
  });

  const tokens = await issueTokens(user, meta);
  await audit({ actorId: user.id, actorRole: user.role, action: "auth.login", targetType: "user", targetId: user.id, ip: meta.ip });
  return json(await buildAuthResponse(user, tokens));
});
