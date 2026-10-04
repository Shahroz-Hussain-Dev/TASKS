import { requireDriver } from "@/lib/auth";
import { submitForReview } from "@/lib/driver/onboarding";
import { clientIp, json, route } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/http";

/** POST /api/driver/submit — onboarding step 5: go under review (instant approval when everything is verified). */
export const POST = route(async (req) => {
  const { user, driver } = await requireDriver(req);
  return json(await submitForReview({ user, driver, ip: clientIp(req) }));
});
