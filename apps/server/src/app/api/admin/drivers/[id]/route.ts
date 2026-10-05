import { requireAdmin } from "@/lib/auth";
import { json, route } from "@/lib/http";
import { uuidParam } from "@/lib/admin/common";
import { getDriverDetail } from "@/lib/admin/drivers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/http";

/** GET /api/admin/drivers/[id] — full driver profile with documents, subscription, last 10 rides and audit trail. */
export const GET = route<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  await requireAdmin(req);
  const { id } = await params;
  return json(await getDriverDetail(uuidParam(id, "Driver id")));
});
