import { paginationSchema } from "@raahi/shared";
import { requireAdmin } from "@/lib/auth";
import { json, parseQuery, route } from "@/lib/http";
import { pageParams } from "@/lib/admin/common";
import { listRides } from "@/lib/admin/rides";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/http";

/** GET /api/admin/rides?status=&q= — ride history; q matches passenger/driver name or phone, addresses, or ids. */
export const GET = route(async (req) => {
  await requireAdmin(req);
  return json(await listRides(pageParams(parseQuery(req, paginationSchema))));
});
