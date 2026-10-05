import { driverDetailsSchema } from "@raahi/shared";
import { requireDriver } from "@/lib/auth";
import { updateDetails } from "@/lib/driver/onboarding";
import { clientIp, json, parseBody, route } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/http";

/** PUT /api/driver/details — onboarding step 1: CNIC, city, licence, emergency contact. */
export const PUT = route(async (req) => {
  const { user, driver } = await requireDriver(req);
  const input = await parseBody(req, driverDetailsSchema);
  return json(await updateDetails({ user, driver, ip: clientIp(req) }, input));
});
