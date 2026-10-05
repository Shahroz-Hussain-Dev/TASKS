import { paginationSchema } from "@raahi/shared";
import { requireParty } from "@/lib/driver/marketplace-routes";
import { json, parseQuery, route } from "@/lib/http";
import { listRidesForUser } from "@/lib/marketplace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/http";

/** GET /api/rides?page&pageSize — ride history for the signed-in passenger or driver. */
export const GET = route(async (req) => {
  const { user, role } = await requireParty(req);
  const { page, pageSize } = parseQuery(req, paginationSchema);
  // zod has already applied the defaults; the fallbacks only narrow the inferred type.
  return json(await listRidesForUser(user.id, role, page ?? 1, pageSize ?? 20));
});
