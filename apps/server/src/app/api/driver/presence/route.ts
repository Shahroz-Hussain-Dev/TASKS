import { driverPresenceSchema } from "@raahi/shared";
import { audit } from "@/lib/audit";
import { requireDriver } from "@/lib/auth";
import { clientIp, json, parseBody, route } from "@/lib/http";
import { setDriverOnline } from "@/lib/marketplace";
import { memoryLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/http";

/** POST /api/driver/presence — go online / offline. Going offline withdraws pending offers. */
export const POST = route(async (req) => {
  const { user, driver } = await requireDriver(req);
  memoryLimit(`presence:${driver.id}`, 20, 60_000);
  const { online } = await parseBody(req, driverPresenceSchema);
  const result = await setDriverOnline(driver, online);
  if (driver.isOnline !== online) {
    await audit({ actorId: user.id, actorRole: "driver", action: online ? "driver.online" : "driver.offline", targetType: "driver", targetId: driver.id, ip: clientIp(req) });
  }
  return json(result);
});
