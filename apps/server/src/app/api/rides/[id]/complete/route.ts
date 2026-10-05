import { audit } from "@/lib/audit";
import { requireDriver } from "@/lib/auth";
import { idParam } from "@/lib/driver/marketplace-routes";
import { clientIp, json, route } from "@/lib/http";
import { completeRide } from "@/lib/marketplace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/http";

/** POST /api/rides/[id]/complete — trip finished; the full fare is credited to the driver. */
export const POST = route<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const { user, driver } = await requireDriver(req);
  const id = await idParam(params, "Ride not found");
  const ride = await completeRide(driver, id);
  await audit({ actorId: user.id, actorRole: "driver", action: "ride.complete", targetType: "ride", targetId: id, ip: clientIp(req), meta: { farePkr: ride.farePkr, distanceKm: ride.distanceKm } });
  return json(ride);
});
