import { requireAdmin } from "@/lib/auth";
import { json, parseQuery, route } from "@/lib/http";
import { farePreviewSchema, previewFare } from "@/lib/admin/fare";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/http";

/** GET /api/admin/fare/preview?distanceKm=&durationMin=&category=&petrolPricePkr= — what-if fare calculator. */
export const GET = route(async (req) => {
  await requireAdmin(req);
  return json(await previewFare(parseQuery(req, farePreviewSchema)));
});
