import { requireDriver } from "@/lib/auth";
import { paySubscriptionTestMode } from "@/lib/driver/onboarding";
import { clientIp, json, route } from "@/lib/http";
import { memoryLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/http";

/** POST /api/driver/subscription/pay — test mode: one tap activates the subscription, no receipt. */
export const POST = route(async (req) => {
  const { user, driver } = await requireDriver(req);
  memoryLimit(`subscription:pay:${driver.id}`, 6, 60_000);
  return json(await paySubscriptionTestMode({ user, driver, ip: clientIp(req) }));
});
