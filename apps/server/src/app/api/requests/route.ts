import { createRideRequestSchema } from "@raahi/shared";
import { audit } from "@/lib/audit";
import { requireCustomer } from "@/lib/auth";
import { clientIp, json, parseBody, route } from "@/lib/http";
import { createRequest } from "@/lib/marketplace";
import { memoryLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/http";

/** POST /api/requests — the passenger posts their offer to nearby drivers. */
export const POST = route(async (req) => {
  const { user } = await requireCustomer(req);
  memoryLimit(`request:create:${user.id}`, 10, 60_000);
  const input = await parseBody(req, createRideRequestSchema);
  // zod has already applied the default; the fallback only narrows the inferred type.
  const request = await createRequest(user, { ...input, passengers: input.passengers ?? 1 });
  await audit({
    actorId: user.id,
    actorRole: "customer",
    action: "request.create",
    targetType: "ride_request",
    targetId: request.id,
    ip: clientIp(req),
    meta: { category: request.category, offeredFarePkr: request.offeredFarePkr, distanceKm: request.distanceKm },
  });
  return json(request, { status: 201 });
});
