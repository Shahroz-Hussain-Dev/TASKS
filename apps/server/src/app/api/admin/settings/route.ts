import { adminSettingsSchema } from "@raahi/shared";
import { requireAdmin } from "@/lib/auth";
import { json, parseBody, route } from "@/lib/http";
import { adminActor } from "@/lib/admin/common";
import { readSettings, saveSettings } from "@/lib/admin/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/http";

/** GET /api/admin/settings — the live platform settings (cache bypassed). */
export const GET = route(async (req) => {
  await requireAdmin(req);
  return json(await readSettings());
});

/** PUT /api/admin/settings — partial update; every changed field is written to the audit log. */
export const PUT = route(async (req) => {
  const actor = await adminActor(req);
  const patch = await parseBody(req, adminSettingsSchema);
  return json(await saveSettings(actor, patch));
});
