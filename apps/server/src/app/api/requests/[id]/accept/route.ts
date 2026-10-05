import { audit } from "@/lib/audit";
import { requireCustomer } from "@/lib/auth";
import { acceptBidSchema, idParam } from "@/lib/driver/marketplace-routes";
import { clientIp, json, parseBody, route } from "@/lib/http";
import { acceptBid } from "@/lib/marketplace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/http";

/** POST /api/requests/[id]/accept — the passenger picks a driver; atomically creates the ride. */
export const POST = route<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const { user } = await requireCustomer(req);
  const id = await idParam(params, "Ride request not found");
  const { bidId } = await parseBody(req, acceptBidSchema);
  const ride = await acceptBid(user, id, bidId);
  await audit({
    actorId: user.id,
    actorRole: "customer",
    action: "ride.create",
    targetType: "ride",
    targetId: ride.id,
    ip: clientIp(req),
    meta: { requestId: id, bidId, driverId: ride.driver.id, farePkr: ride.farePkr },
  });
  return json(ride, { status: 201 });
});
