import { vehicleUpsertSchema } from "@raahi/shared";
import { requireDriver } from "@/lib/auth";
import { upsertVehicle } from "@/lib/driver/onboarding";
import { clientIp, json, parseBody, route } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/http";

/** PUT /api/driver/vehicle — onboarding step 2: catalogue model (fills km/L) or a custom model. */
export const PUT = route(async (req) => {
  const { user, driver } = await requireDriver(req);
  const input = await parseBody(req, vehicleUpsertSchema);
  return json(await upsertVehicle({ user, driver, ip: clientIp(req) }, input));
});
