import { supportMessageSchema } from "@raahi/shared";
import { requireAuth } from "@/lib/auth";
import { clientIp, json, parseBody, route } from "@/lib/http";
import { memoryLimit } from "@/lib/rate-limit";
import { answerSupportMessage, streamSupportMessage } from "@/lib/support/assistant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export { OPTIONS } from "@/lib/http";

/**
 * POST /api/support/messages — send a message to the Raahi assistant.
 * With `Accept: text/event-stream` the reply streams as SSE; otherwise the
 * whole ticket is returned as JSON once the assistant has answered.
 */
export const POST = route(async (req) => {
  const { user, driver } = await requireAuth(req);
  memoryLimit(`support:${user.id}`, 20, 60_000);
  const input = await parseBody(req, supportMessageSchema);
  const actor = { user, driver, ip: clientIp(req) };

  const wantsStream = (req.headers.get("accept") ?? "").toLowerCase().includes("text/event-stream");
  if (!wantsStream) return json({ ticket: await answerSupportMessage(actor, input) });

  // route() adds the CORS headers; this only needs the SSE content type and anti-buffering hints.
  const stream = await streamSupportMessage(actor, input);
  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
});
