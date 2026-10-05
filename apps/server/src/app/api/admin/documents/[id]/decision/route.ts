import { adminDocumentDecisionSchema } from "@raahi/shared";
import { json, parseBody, route } from "@/lib/http";
import { adminActor, uuidParam } from "@/lib/admin/common";
import { decideDocument } from "@/lib/admin/documents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/http";

/** POST /api/admin/documents/[id]/decision — manual verified / rejected verdict with an optional note for the driver. */
export const POST = route<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const actor = await adminActor(req);
  const { id } = await params;
  const input = await parseBody(req, adminDocumentDecisionSchema);
  return json(await decideDocument(actor, uuidParam(id, "Document id"), input));
});
