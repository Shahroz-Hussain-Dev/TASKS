import { audit } from "@/lib/audit";
import { requireDriver } from "@/lib/auth";
import { idParam } from "@/lib/driver/marketplace-routes";
import { clientIp, json, route } from "@/lib/http";
import { startRide } from "@/lib/marketplace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/http";

/** POST /api/rides/[id]/start — passenger on board, trip begins. */
export const POST = route<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const { user, driver } = await requireDriver(req);
  const id = await idParam(params, "Ride not found");
  const ride = await startRide(driver, id);
  await audit({ actorId: user.id, actorRole: "driver", action: "ride.start", targetType: "ride", targetId: id, ip: clientIp(req) });
  return json(ride);
});
