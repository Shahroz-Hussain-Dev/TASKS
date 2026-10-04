import { adminUserActionSchema } from "@raahi/shared";
import { json, parseBody, route } from "@/lib/http";
import { adminActor, uuidParam } from "@/lib/admin/common";
import { applyUserAction } from "@/lib/admin/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/http";

/** POST /api/admin/users/[id]/action — block (revokes every session) or unblock any customer or driver. */
export const POST = route<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const actor = await adminActor(req);
  const { id } = await params;
  const input = await parseBody(req, adminUserActionSchema);
  return json(await applyUserAction(actor, uuidParam(id, "User id"), input));
});
