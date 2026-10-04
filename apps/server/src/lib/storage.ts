import { createHash } from "node:crypto";
import sharp from "sharp";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { files, type FileRow } from "@/db/schema";
import { env } from "./env";
import { badRequest, notFound } from "./errors";
import { UPLOAD_LIMITS } from "@raahi/shared";

/**
 * File storage with two drivers:
 *  - "db": bytes in Postgres (zero-config default, fine for KYC-scale volumes)
 *  - "supabase": Supabase Storage via its REST API when SUPABASE_URL and
 *    SUPABASE_SERVICE_ROLE_KEY are configured (recommended for scale).
 * Every image is re-encoded with sharp: EXIF stripped, bounded dimensions,
 * JPEG/WebP output. That also guarantees the bytes really are an image.
 */

export type FileKind = "avatar" | "document" | "receipt" | "other";

function supabaseEnabled() {
  const e = env();
  return Boolean(e.SUPABASE_URL && e.SUPABASE_SERVICE_ROLE_KEY);
}

export async function normaliseImage(input: Buffer, kind: FileKind): Promise<{ buffer: Buffer; mime: string; width: number; height: number }> {
  if (input.byteLength > UPLOAD_LIMITS.maxBytes * 4) throw badRequest("Image is too large");
  let img = sharp(input, { failOn: "error", limitInputPixels: 40_000_000 }).rotate();
  const meta = await img.metadata().catch(() => null);
  if (!meta || !meta.width || !meta.height) throw badRequest("Upload a valid JPEG, PNG or WebP image");
  const max = kind === "avatar" ? 512 : UPLOAD_LIMITS.maxDimension;
  img = img.resize({ width: max, height: max, fit: "inside", withoutEnlargement: true });
  const buffer = await img.jpeg({ quality: kind === "document" || kind === "receipt" ? 82 : 80, mozjpeg: true }).toBuffer();
  const out = await sharp(buffer).metadata();
  return { buffer, mime: "image/jpeg", width: out.width ?? 0, height: out.height ?? 0 };
}

export async function saveImage(opts: { ownerId: string | null; kind: FileKind; input: Buffer; isPublic?: boolean }): Promise<FileRow> {
  const { buffer, mime, width, height } = await normaliseImage(opts.input, opts.kind);
  if (buffer.byteLength > UPLOAD_LIMITS.maxBytes) throw badRequest("Image is too large even after compression");
  const sha256 = createHash("sha256").update(buffer).digest("hex");
  const db = await getDb();

  if (supabaseEnabled()) {
    const e = env();
    const id = crypto.randomUUID();
    const path = `${opts.kind}/${id}.jpg`;
    const res = await fetch(`${e.SUPABASE_URL}/storage/v1/object/${e.SUPABASE_STORAGE_BUCKET}/${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${e.SUPABASE_SERVICE_ROLE_KEY}`, "Content-Type": mime, "x-upsert": "true" },
      body: new Uint8Array(buffer),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("[storage] supabase upload failed, falling back to db", res.status, text);
    } else {
      const [row] = await db
        .insert(files)
        .values({ id, ownerId: opts.ownerId, kind: opts.kind, mime, sizeBytes: buffer.byteLength, width, height, sha256, storage: "supabase", storagePath: path, isPublic: opts.isPublic ?? false })
        .returning();
      return row!;
    }
  }

  const [row] = await db
    .insert(files)
    .values({ ownerId: opts.ownerId, kind: opts.kind, mime, sizeBytes: buffer.byteLength, width, height, sha256, storage: "db", bytes: buffer, isPublic: opts.isPublic ?? false })
    .returning();
  return row!;
}

export async function getFileMeta(id: string): Promise<FileRow> {
  const db = await getDb();
  const [row] = await db
    .select({
      id: files.id,
      ownerId: files.ownerId,
      kind: files.kind,
      mime: files.mime,
      sizeBytes: files.sizeBytes,
      width: files.width,
      height: files.height,
      sha256: files.sha256,
      storage: files.storage,
      storagePath: files.storagePath,
      isPublic: files.isPublic,
      createdAt: files.createdAt,
    })
    .from(files)
    .where(eq(files.id, id))
    .limit(1);
  if (!row) throw notFound("File not found");
  return { ...row, bytes: null } as FileRow;
}

export async function readFileBytes(row: FileRow): Promise<Buffer> {
  if (row.storage === "supabase") {
    const e = env();
    const res = await fetch(`${e.SUPABASE_URL}/storage/v1/object/${e.SUPABASE_STORAGE_BUCKET}/${row.storagePath}`, {
      headers: { Authorization: `Bearer ${e.SUPABASE_SERVICE_ROLE_KEY}` },
    });
    if (!res.ok) throw notFound("File not found in storage");
    return Buffer.from(await res.arrayBuffer());
  }
  const db = await getDb();
  const [r] = await db.select({ bytes: files.bytes }).from(files).where(eq(files.id, row.id)).limit(1);
  if (!r?.bytes) throw notFound("File not found");
  return Buffer.from(r.bytes);
}

export async function deleteFile(id: string) {
  const db = await getDb();
  const row = await getFileMeta(id).catch(() => null);
  if (!row) return;
  if (row.storage === "supabase") {
    const e = env();
    await fetch(`${e.SUPABASE_URL}/storage/v1/object/${e.SUPABASE_STORAGE_BUCKET}/${row.storagePath}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${e.SUPABASE_SERVICE_ROLE_KEY}` },
    }).catch(() => {});
  }
  await db.delete(files).where(eq(files.id, id));
}

/** URL the clients use to fetch a file (auth header or admin cookie required unless public). */
export function fileUrl(id: string | null | undefined): string | null {
  return id ? `/api/files/${id}` : null;
}

export function fileUrlRequired(id: string): string {
  return `/api/files/${id}`;
}
