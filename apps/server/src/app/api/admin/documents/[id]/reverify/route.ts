import { json, route } from "@/lib/http";
import { memoryLimit } from "@/lib/rate-limit";
import { adminActor, uuidParam } from "@/lib/admin/common";
import { reverifyDocument } from "@/lib/admin/documents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export { OPTIONS } from "@/lib/http";

/** POST /api/admin/documents/[id]/reverify — run the Gemini KYC check again and store the fresh verdict. */
export const POST = route<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const actor = await adminActor(req);
  memoryLimit(`admin-reverify:${actor.user.id}`, 30, 60_000);
  const { id } = await params;
  return json(await reverifyDocument(actor, uuidParam(id, "Document id")));
});
