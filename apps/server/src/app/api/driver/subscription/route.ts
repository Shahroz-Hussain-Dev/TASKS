import { subscriptionReceiptSchema } from "@raahi/shared";
import { requireDriver } from "@/lib/auth";
import { submitSubscription } from "@/lib/driver/onboarding";
import { clientIp, json, parseBody, route } from "@/lib/http";
import { memoryLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/http";

/** POST /api/driver/subscription — onboarding step 4 / renewal: submit the PKR 1,000 payment receipt. */
export const POST = route(async (req) => {
  const { user, driver } = await requireDriver(req);
  memoryLimit(`subscription:${driver.id}`, 6, 60_000);
  const input = await parseBody(req, subscriptionReceiptSchema);
  return json(await submitSubscription({ user, driver, ip: clientIp(req) }, input));
});
