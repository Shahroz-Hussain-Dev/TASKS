import { locationPingSchema } from "@raahi/shared";
import { requireDriver } from "@/lib/auth";
import { json, parseBody, route } from "@/lib/http";
import { recordDriverLocation } from "@/lib/marketplace";
import { memoryLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/http";

/** POST /api/driver/location — GPS ping every 5–10 s; appended to the ride trail when a ride is active. */
export const POST = route(async (req) => {
  const { driver } = await requireDriver(req);
  memoryLimit(`location:${driver.id}`, 30, 60_000);
  const input = await parseBody(req, locationPingSchema);
  return json(await recordDriverLocation(driver, input));
});
