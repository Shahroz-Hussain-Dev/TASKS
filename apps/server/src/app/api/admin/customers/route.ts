import { paginationSchema } from "@raahi/shared";
import { requireAdmin } from "@/lib/auth";
import { json, parseQuery, route } from "@/lib/http";
import { pageParams } from "@/lib/admin/common";
import { listCustomers } from "@/lib/admin/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/http";

/** GET /api/admin/customers?q=&status=active|blocked — passengers with their ride count. */
export const GET = route(async (req) => {
  await requireAdmin(req);
  return json(await listCustomers(pageParams(parseQuery(req, paginationSchema))));
});
