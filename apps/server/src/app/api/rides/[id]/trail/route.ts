import { idParam, requireParty } from "@/lib/driver/marketplace-routes";
import { json, route } from "@/lib/http";
import { rideTrail } from "@/lib/marketplace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/http";

/** GET /api/rides/[id]/trail — the driver's recorded GPS breadcrumb for this ride. */
export const GET = route<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const { user } = await requireParty(req);
  const id = await idParam(params, "Ride not found");
  return json({ points: await rideTrail(id, user.id) });
});
