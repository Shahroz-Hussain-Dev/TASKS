import { rideCancelSchema } from "@raahi/shared";
import { audit } from "@/lib/audit";
import { assertCancelReasonForRole, idParam, requireParty } from "@/lib/driver/marketplace-routes";
import { clientIp, json, parseBody, route } from "@/lib/http";
import { cancelRide } from "@/lib/marketplace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/http";

/** POST /api/rides/[id]/cancel — either party cancels an active ride (passengers only before the trip starts). */
export const POST = route<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const { user, role } = await requireParty(req);
  const id = await idParam(params, "Ride not found");
  const input = await parseBody(req, rideCancelSchema);
  assertCancelReasonForRole(input.reason, role);
  const ride = await cancelRide(user.id, role, id, input.reason, input.details);
  await audit({ actorId: user.id, actorRole: role, action: "ride.cancel", targetType: "ride", targetId: id, ip: clientIp(req), meta: { reason: input.reason, details: input.details ?? null, previousStatus: ride.startedAt ? "in_progress" : ride.arrivedAt ? "arrived" : "assigned" } });
  return json(ride);
});
