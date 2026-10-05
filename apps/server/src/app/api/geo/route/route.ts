import { badRequest } from "@/lib/errors";
import { clientIp, json, parseBody, route } from "@/lib/http";
import { quote } from "@/lib/marketplace";
import { memoryLimit } from "@/lib/rate-limit";
import { haversineKm, quoteSchema } from "@raahi/shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/http";

/** Same floor the marketplace applies when a request is posted, so the quote never promises a ride that cannot be requested. */
const MIN_TRIP_KM = 0.2;

export const POST = route(async (req) => {
  memoryLimit(`geo:route:${clientIp(req)}`, 60, 60_000);
  const body = await parseBody(req, quoteSchema);
  if (haversineKm(body.pickup, body.dropoff) < MIN_TRIP_KM) throw badRequest("Pickup and drop-off are too close together");
  return json(await quote(body.pickup, body.dropoff));
});
