import { placeBidSchema } from "@raahi/shared";
import { audit } from "@/lib/audit";
import { requireDriver } from "@/lib/auth";
import { idParam } from "@/lib/driver/marketplace-routes";
import { clientIp, json, parseBody, route } from "@/lib/http";
import { placeBid } from "@/lib/marketplace";
import { memoryLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/http";

/** POST /api/driver/requests/[id]/bids — accept the passenger's price or counter-offer. Re-posting updates the pending bid. */
export const POST = route<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const { user, driver } = await requireDriver(req);
  const id = await idParam(params, "Ride request not found");
  memoryLimit(`bid:${driver.id}`, 20, 60_000);
  const input = await parseBody(req, placeBidSchema);
  const bid = await placeBid(driver, id, input);
  await audit({ actorId: user.id, actorRole: "driver", action: "bid.place", targetType: "bid", targetId: bid.id, ip: clientIp(req), meta: { requestId: id, amountPkr: input.amountPkr, etaMin: input.etaMin } });
  return json(bid, { status: 201 });
});
