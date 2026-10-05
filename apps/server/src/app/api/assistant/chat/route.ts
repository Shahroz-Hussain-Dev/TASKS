import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { json, parseBody, route } from "@/lib/http";
import { memoryLimit } from "@/lib/rate-limit";
import { converse } from "@/lib/assistant/brain";
import { latLngSchema } from "@raahi/shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export { OPTIONS } from "@/lib/http";

const bodySchema = z.object({
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().trim().min(1).max(1000) })).min(1).max(40),
  location: latLngSchema.nullable().optional(),
});

/**
 * POST /api/assistant/chat — one turn of the Buddy voice assistant.
 * Header `X-Assistant-Key` (optional) uses the user's own Gemini key.
 */
export const POST = route(async (req) => {
  const { user, driver } = await requireAuth(req);
  memoryLimit(`assistant:${user.id}`, 30, 60_000);
  const body = await parseBody(req, bodySchema);
  const last = body.messages[body.messages.length - 1]!;
  if (last.role !== "user") return json({ reply: "Go ahead, I'm listening.", actions: [], suggestions: [], trace: [] });
  const userKey = req.headers.get("x-assistant-key")?.trim();
  const apiKey = userKey && /^[A-Za-z0-9._-]{20,200}$/.test(userKey) ? userKey : undefined;
  const reply = await converse(body.messages, { user, driver, location: body.location ?? null }, apiKey);
  return json(reply);
});
