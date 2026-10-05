import { requireDriver } from "@/lib/auth";
import { json, route } from "@/lib/http";
import { driverPendingBids } from "@/lib/marketplace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/http";

/** GET /api/driver/bids — offers this driver has out that passengers haven't answered yet. */
export const GET = route(async (req) => {
  const { driver } = await requireDriver(req);
  return json({ items: await driverPendingBids(driver) });
});
