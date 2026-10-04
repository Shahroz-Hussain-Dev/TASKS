import { requireCustomer } from "@/lib/auth";
import { json, route } from "@/lib/http";
import { getActiveRideForUser, getCustomerActiveRequest } from "@/lib/marketplace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/http";

/** GET /api/requests/active — what the home screen should resume: an open request and/or an active ride. */
export const GET = route(async (req) => {
  const { user } = await requireCustomer(req);
  const [request, ride] = await Promise.all([getCustomerActiveRequest(user), getActiveRideForUser(user.id, "customer")]);
  return json({ request, ride });
});
