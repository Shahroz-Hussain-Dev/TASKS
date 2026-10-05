import { assertCanViewFile } from "@/lib/core/file-access";
import { notFound } from "@/lib/errors";
import { route } from "@/lib/http";
import { getFileMeta, readFileBytes } from "@/lib/storage";
import { uuidSchema } from "@raahi/shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/http";

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** RFC 9110 If-None-Match: a list of (possibly weak) tags, or "*". */
function etagMatches(header: string | null, etag: string): boolean {
  if (!header) return false;
  const trimmed = header.trim();
  if (trimmed === "*") return true;
  return trimmed
    .split(",")
    .map((tag) => tag.trim().replace(/^W\//, ""))
    .includes(etag);
}

export const GET = route<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) throw notFound("File not found");

  const meta = await getFileMeta(id);
  await assertCanViewFile(req, meta);

  // Stored bytes never change, so the content hash is a perfect validator.
  const etag = `"${meta.sha256}"`;
  const headers: Record<string, string> = {
    ETag: etag,
    "Cache-Control": meta.isPublic ? "public, max-age=86400, immutable" : "private, max-age=3600",
    "Last-Modified": meta.createdAt.toUTCString(),
  };
  if (!meta.isPublic) headers.Vary = "Authorization, Cookie";

  if (etagMatches(req.headers.get("if-none-match"), etag)) return new Response(null, { status: 304, headers });

  const bytes = await readFileBytes(meta);
  const extension = EXTENSION_BY_MIME[meta.mime] ?? "bin";
  return new Response(new Uint8Array(bytes), {
    status: 200,
    headers: {
      ...headers,
      "Content-Type": meta.mime,
      "Content-Length": String(bytes.byteLength),
      "Content-Disposition": `inline; filename="${meta.kind}-${meta.id}.${extension}"`,
      "X-Content-Type-Options": "nosniff",
    },
  });
});
