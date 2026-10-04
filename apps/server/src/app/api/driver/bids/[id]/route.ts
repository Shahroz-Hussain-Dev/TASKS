import { audit } from "@/lib/audit";
import { requireDriver } from "@/lib/auth";
import { idParam } from "@/lib/driver/marketplace-routes";
import { clientIp, json, route } from "@/lib/http";
import { withdrawBid } from "@/lib/marketplace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/http";

/** DELETE /api/driver/bids/[id] — withdraw a pending offer. */
export const DELETE = route<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const { user, driver } = await requireDriver(req);
  const id = await idParam(params, "Offer not found");
  const result = await withdrawBid(driver, id);
  await audit({ actorId: user.id, actorRole: "driver", action: "bid.withdraw", targetType: "bid", targetId: id, ip: clientIp(req) });
  return json(result);
});
