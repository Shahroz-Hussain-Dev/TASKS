import { paginationSchema } from "@raahi/shared";
import { requireAdmin } from "@/lib/auth";
import { json, parseQuery, route } from "@/lib/http";
import { pageParams } from "@/lib/admin/common";
import { listSubscriptions } from "@/lib/admin/subscriptions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/http";

/** GET /api/admin/subscriptions?status=&q= — receipts with the paying driver; pending ones first. */
export const GET = route(async (req) => {
  await requireAdmin(req);
  return json(await listSubscriptions(pageParams(parseQuery(req, paginationSchema))));
});
