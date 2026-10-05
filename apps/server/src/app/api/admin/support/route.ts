import { paginationSchema } from "@raahi/shared";
import { requireAdmin } from "@/lib/auth";
import { json, parseQuery, route } from "@/lib/http";
import { pageParams } from "@/lib/admin/common";
import { listSupportTickets } from "@/lib/admin/support";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/http";

/** GET /api/admin/support?status=open|awaiting_user|resolved|escalated&q= — tickets, escalated and open first. */
export const GET = route(async (req) => {
  await requireAdmin(req);
  return json(await listSupportTickets(pageParams(parseQuery(req, paginationSchema))));
});
