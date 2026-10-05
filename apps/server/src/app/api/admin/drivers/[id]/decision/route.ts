import { adminDriverDecisionSchema } from "@raahi/shared";
import { json, parseBody, route } from "@/lib/http";
import { adminActor, uuidParam } from "@/lib/admin/common";
import { decideDriver } from "@/lib/admin/drivers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/http";

/** POST /api/admin/drivers/[id]/decision — approve / reject / suspend / reinstate. Approval needs an active subscription. */
export const POST = route<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const actor = await adminActor(req);
  const { id } = await params;
  const input = await parseBody(req, adminDriverDecisionSchema);
  return json(await decideDriver(actor, uuidParam(id, "Driver id"), input));
});
