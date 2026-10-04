import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { ApiError, badRequest } from "@/lib/errors";
import { json, route } from "@/lib/http";
import { memoryLimit } from "@/lib/rate-limit";
import { fileUrlRequired, saveImage } from "@/lib/storage";
import { UPLOAD_LIMITS } from "@raahi/shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/http";

const kindSchema = z.enum(["avatar", "document", "receipt"]);

/** Raw upload ceiling before sharp re-encodes down to UPLOAD_LIMITS.maxBytes. */
const MAX_RAW_BYTES = UPLOAD_LIMITS.maxBytes * 4;
const ALLOWED_MIME: readonly string[] = UPLOAD_LIMITS.allowedMime;

function isFile(value: FormDataEntryValue | null): value is File {
  return typeof value === "object" && value !== null && typeof (value as File).arrayBuffer === "function";
}

export const POST = route(async (req) => {
  const { user } = await requireAuth(req);
  memoryLimit(`upload:${user.id}`, 40, 60_000);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw badRequest('Send the image as multipart/form-data with fields "file" and "kind"');
  }

  const kind = kindSchema.safeParse(form.get("kind"));
  if (!kind.success) throw badRequest('"kind" must be one of avatar, document or receipt');

  const entry = form.get("file");
  if (!isFile(entry)) throw badRequest('Attach the image in the "file" field');
  if (entry.size === 0) throw badRequest("The uploaded image is empty");
  if (entry.size > MAX_RAW_BYTES) {
    throw new ApiError(413, "payload_too_large", `Image is too large. Keep it under ${Math.round(MAX_RAW_BYTES / 1_000_000)} MB.`);
  }
  const declaredMime = entry.type.split(";")[0]?.trim().toLowerCase() ?? "";
  if (!ALLOWED_MIME.includes(declaredMime)) throw new ApiError(415, "unsupported_media_type", "Upload a JPEG, PNG or WebP image");

  // saveImage re-encodes through sharp (EXIF stripped, bounded size), which also proves the bytes are a real image.
  const input = Buffer.from(await entry.arrayBuffer());
  const row = await saveImage({ ownerId: user.id, kind: kind.data, input, isPublic: kind.data === "avatar" });

  return json(
    { file: { id: row.id, url: fileUrlRequired(row.id), width: row.width ?? 0, height: row.height ?? 0, sizeBytes: row.sizeBytes } },
    { status: 201 },
  );
});
