import { attachDocumentSchema } from "@raahi/shared";
import { requireDriver } from "@/lib/auth";
import { attachDocument } from "@/lib/driver/onboarding";
import { clientIp, json, parseBody, route } from "@/lib/http";
import { memoryLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/http";

/** POST /api/driver/documents — onboarding step 3: attach an uploaded photo and verify it with Gemini. */
export const POST = route(async (req) => {
  const { user, driver } = await requireDriver(req);
  memoryLimit(`kyc:${driver.id}`, 12, 60_000);
  const input = await parseBody(req, attachDocumentSchema);
  return json(await attachDocument({ user, driver, ip: clientIp(req) }, input));
});
