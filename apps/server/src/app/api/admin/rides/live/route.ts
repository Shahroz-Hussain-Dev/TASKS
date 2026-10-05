import { requireAdmin } from "@/lib/auth";
import { json, route } from "@/lib/http";
import { liveBoard } from "@/lib/admin/rides";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/http";

/** GET /api/admin/rides/live — online drivers with positions, open requests and rides in progress. */
export const GET = route(async (req) => {
  await requireAdmin(req);
  return json(await liveBoard());
});
