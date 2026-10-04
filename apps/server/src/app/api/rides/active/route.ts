import { requireParty } from "@/lib/driver/marketplace-routes";
import { json, route } from "@/lib/http";
import { getActiveRideForUser } from "@/lib/marketplace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/http";

/** GET /api/rides/active — the ride in progress for this user, if any. */
export const GET = route(async (req) => {
  const { user, role } = await requireParty(req);
  return json({ ride: await getActiveRideForUser(user.id, role) });
});
