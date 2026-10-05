import { requireAuth } from "@/lib/auth";
import { json, route } from "@/lib/http";
import { listTickets } from "@/lib/support/assistant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/http";

/** GET /api/support/tickets — the signed-in user's own conversations, newest first, with every message. */
export const GET = route(async (req) => {
  const { user } = await requireAuth(req);
  return json({ items: await listTickets(user) });
});
