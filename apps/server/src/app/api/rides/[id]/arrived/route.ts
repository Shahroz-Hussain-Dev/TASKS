import { audit } from "@/lib/audit";
import { requireDriver } from "@/lib/auth";
import { idParam } from "@/lib/driver/marketplace-routes";
import { clientIp, json, route } from "@/lib/http";
import { driverArrived } from "@/lib/marketplace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/http";

/** POST /api/rides/[id]/arrived — driver is at the pickup point. */
export const POST = route<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const { user, driver } = await requireDriver(req);
  const id = await idParam(params, "Ride not found");
  const ride = await driverArrived(driver, id);
  await audit({ actorId: user.id, actorRole: "driver", action: "ride.arrived", targetType: "ride", targetId: id, ip: clientIp(req) });
  return json(ride);
});
