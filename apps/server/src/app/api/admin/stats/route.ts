import { requireAdmin } from "@/lib/auth";
import { json, route } from "@/lib/http";
import { adminStats } from "@/lib/admin/stats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/http";

/** GET /api/admin/stats — dashboard KPIs, 14-day series (Pakistan time) and category mix. */
export const GET = route(async (req) => {
  await requireAdmin(req);
  return json(await adminStats());
});
