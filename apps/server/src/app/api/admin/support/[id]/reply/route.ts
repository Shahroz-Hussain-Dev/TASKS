import { adminReplySchema } from "@raahi/shared";
import { json, parseBody, route } from "@/lib/http";
import { adminActor, uuidParam } from "@/lib/admin/common";
import { replyToTicket } from "@/lib/admin/support";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/http";

/** POST /api/admin/support/[id]/reply — human reply; `resolve: true` closes the ticket. The user is notified. */
export const POST = route<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const actor = await adminActor(req);
  const { id } = await params;
  const input = await parseBody(req, adminReplySchema);
  return json(await replyToTicket(actor, uuidParam(id, "Ticket id"), input));
});
