import { quoteSchema } from "@raahi/shared";
import { requireCustomer } from "@/lib/auth";
import { json, parseBody, route } from "@/lib/http";
import { quote } from "@/lib/marketplace";
import { memoryLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/http";

/** POST /api/rides/quote — route + fare range for every category, before the passenger names a price. */
export const POST = route(async (req) => {
  const { user } = await requireCustomer(req);
  memoryLimit(`quote:${user.id}`, 60, 60_000);
  const input = await parseBody(req, quoteSchema);
  return json(await quote(input.pickup, input.dropoff));
});
