import { sendMessageSchema } from "@raahi/shared";
import { idParam, requireParty } from "@/lib/driver/marketplace-routes";
import { json, parseBody, route } from "@/lib/http";
import { toChatMessageDto } from "@/lib/mappers";
import { listMessages, sendMessage } from "@/lib/marketplace";
import { memoryLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/http";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/rides/[id]/messages — chat thread (marks the viewer's side as read). Polled every 2 s while open. */
export const GET = route<Ctx>(async (req, { params }) => {
  const { user, role } = await requireParty(req);
  const id = await idParam(params, "Ride not found");
  const rows = await listMessages(id, user.id, role);
  return json({ items: rows.map(toChatMessageDto) });
});

/** POST /api/rides/[id]/messages — send a message to the other party of an active ride. */
export const POST = route<Ctx>(async (req, { params }) => {
  const { user, role } = await requireParty(req);
  const id = await idParam(params, "Ride not found");
  memoryLimit(`chat:${user.id}`, 30, 60_000);
  const input = await parseBody(req, sendMessageSchema);
  const message = await sendMessage(id, user.id, role, input.body);
  return json(toChatMessageDto(message), { status: 201 });
});
