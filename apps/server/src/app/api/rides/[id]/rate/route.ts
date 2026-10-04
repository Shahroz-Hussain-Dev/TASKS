import { rateRideSchema } from "@raahi/shared";
import { audit } from "@/lib/audit";
import { idParam, requireParty } from "@/lib/driver/marketplace-routes";
import { clientIp, json, parseBody, route } from "@/lib/http";
import { rateRide } from "@/lib/marketplace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/http";

/** POST /api/rides/[id]/rate — one rating per party per completed ride. */
export const POST = route<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const { user, role } = await requireParty(req);
  const id = await idParam(params, "Ride not found");
  const input = await parseBody(req, rateRideSchema);
  const ride = await rateRide(user.id, id, input.stars, input.comment, input.tags);
  await audit({ actorId: user.id, actorRole: role, action: "ride.rate", targetType: "ride", targetId: id, ip: clientIp(req), meta: { stars: input.stars, tags: input.tags ?? [] } });
  return json(ride);
});
