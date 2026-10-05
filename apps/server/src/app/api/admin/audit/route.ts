import { paginationSchema } from "@raahi/shared";
import { requireAdmin } from "@/lib/auth";
import { json, parseQuery, route } from "@/lib/http";
import { listAudit } from "@/lib/admin/audit";
import { pageParams } from "@/lib/admin/common";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/http";

/** GET /api/admin/audit?q=&status=<targetType> — who did what, newest first. */
export const GET = route(async (req) => {
  await requireAdmin(req);
  return json(await listAudit(pageParams(parseQuery(req, paginationSchema))));
});
