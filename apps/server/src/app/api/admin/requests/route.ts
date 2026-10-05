import { paginationSchema } from "@raahi/shared";
import { requireAdmin } from "@/lib/auth";
import { json, parseQuery, route } from "@/lib/http";
import { pageParams } from "@/lib/admin/common";
import { listRequests } from "@/lib/admin/rides";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/http";

/** GET /api/admin/requests?status=&q= — ride requests with every bid they received. */
export const GET = route(async (req) => {
  await requireAdmin(req);
  return json(await listRequests(pageParams(parseQuery(req, paginationSchema))));
});
