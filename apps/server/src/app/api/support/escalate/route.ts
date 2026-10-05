import { supportEscalateSchema } from "@raahi/shared";
import { requireAuth } from "@/lib/auth";
import { clientIp, json, parseBody, route } from "@/lib/http";
import { memoryLimit } from "@/lib/rate-limit";
import { escalateTicket } from "@/lib/support/assistant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/http";

/** POST /api/support/escalate — "Talk to a human": flags the ticket and alerts every admin. */
export const POST = route(async (req) => {
  const { user, driver } = await requireAuth(req);
  memoryLimit(`support-escalate:${user.id}`, 5, 60_000);
  const { ticketId } = await parseBody(req, supportEscalateSchema);
  return json(await escalateTicket({ user, driver, ip: clientIp(req) }, ticketId));
});
