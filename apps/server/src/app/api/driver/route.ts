import { requireDriver } from "@/lib/auth";
import { getDriverDto } from "@/lib/driver/onboarding";
import { json, route } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/http";

/** GET /api/driver — the driver's full profile: vehicle, documents, subscription and onboarding progress. */
export const GET = route(async (req) => {
  const { driver } = await requireDriver(req);
  return json(await getDriverDto(driver.id));
});
