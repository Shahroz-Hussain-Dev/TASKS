import { adminSubscriptionDecisionSchema } from "@raahi/shared";
import { json, parseBody, route } from "@/lib/http";
import { adminActor, uuidParam } from "@/lib/admin/common";
import { decideSubscription } from "@/lib/admin/subscriptions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/http";

/** POST /api/admin/subscriptions/[id]/decision — approve (activates the period) or reject a receipt. */
export const POST = route<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const actor = await adminActor(req);
  const { id } = await params;
  const input = await parseBody(req, adminSubscriptionDecisionSchema);
  return json(await decideSubscription(actor, uuidParam(id, "Subscription id"), input));
});
