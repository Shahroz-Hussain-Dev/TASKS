import { json, route } from "@/lib/http";
import { getSettings } from "@/lib/settings";
import type { PublicConfigDto } from "@raahi/shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/http";

/** Oldest mobile build allowed to talk to this API; bump to force an update. */
const MIN_APP_VERSION = "1.0.0";

export const GET = route(async () => {
  const s = await getSettings();
  const dto: PublicConfigDto = {
    settings: {
      petrolPricePkr: s.petrolPricePkr,
      driverFlatPkr: s.driverFlatPkr,
      driverSubscriptionPkr: s.driverSubscriptionPkr,
      subscriptionDays: s.subscriptionDays,
      paymentInstructions: s.paymentInstructions,
      bidTtlSeconds: s.bidTtlSeconds,
      requestTtlSeconds: s.requestTtlSeconds,
      supportPhone: s.supportPhone,
      supportEmail: s.supportEmail,
      commissionPercent: s.commissionPercent,
    },
    serverTime: new Date().toISOString(),
    minAppVersion: MIN_APP_VERSION,
  };
  return json(dto);
});
