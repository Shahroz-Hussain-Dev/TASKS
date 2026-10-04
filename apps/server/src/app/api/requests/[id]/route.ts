import { cancelRequestSchema, updateOfferSchema } from "@raahi/shared";
import { audit } from "@/lib/audit";
import { requireCustomer } from "@/lib/auth";
import { idParam, parseOptionalBody } from "@/lib/driver/marketplace-routes";
import { clientIp, json, parseBody, route } from "@/lib/http";
import { cancelRequest, getCustomerRequest, updateOffer } from "@/lib/marketplace";
import { memoryLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/http";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/requests/[id] — polled every 2.5 s while the passenger waits for bids. */
export const GET = route<Ctx>(async (req, { params }) => {
  const { user } = await requireCustomer(req);
  const id = await idParam(params, "Ride request not found");
  return json(await getCustomerRequest(user, id));
});

/** PATCH /api/requests/[id] — raise (or lower) the offer; resets the request timer. */
export const PATCH = route<Ctx>(async (req, { params }) => {
  const { user } = await requireCustomer(req);
  const id = await idParam(params, "Ride request not found");
  memoryLimit(`request:offer:${user.id}`, 20, 60_000);
  const input = await parseBody(req, updateOfferSchema);
  const request = await updateOffer(user, id, input.offeredFarePkr);
  await audit({ actorId: user.id, actorRole: "customer", action: "request.update_offer", targetType: "ride_request", targetId: id, ip: clientIp(req), meta: { offeredFarePkr: input.offeredFarePkr } });
  return json(request);
});

/** DELETE /api/requests/[id] — cancel an open request; pending drivers are told. */
export const DELETE = route<Ctx>(async (req, { params }) => {
  const { user } = await requireCustomer(req);
  const id = await idParam(params, "Ride request not found");
  const input = await parseOptionalBody(req, cancelRequestSchema);
  const request = await cancelRequest(user, id, input?.reason);
  await audit({ actorId: user.id, actorRole: "customer", action: "request.cancel", targetType: "ride_request", targetId: id, ip: clientIp(req), meta: { reason: input?.reason ?? null } });
  return json(request);
});
