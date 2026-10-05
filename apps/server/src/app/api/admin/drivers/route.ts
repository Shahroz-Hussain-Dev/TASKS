import { paginationSchema } from "@raahi/shared";
import { requireAdmin } from "@/lib/auth";
import { json, parseQuery, route } from "@/lib/http";
import { pageParams } from "@/lib/admin/common";
import { listDrivers } from "@/lib/admin/drivers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/http";

/** GET /api/admin/drivers?status=&q=&page=&pageSize= — drivers with their user; q searches name, phone and CNIC. */
export const GET = route(async (req) => {
  await requireAdmin(req);
  return json(await listDrivers(pageParams(parseQuery(req, paginationSchema))));
});
