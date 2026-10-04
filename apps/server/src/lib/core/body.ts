import type { NextRequest } from "next/server";
import type { ZodSchema } from "zod";
import { badRequest } from "@/lib/errors";

/**
 * Like `parseBody`, but a missing or empty body is treated as `{}` so that
 * "all when omitted" endpoints accept a bare POST.
 */
export async function parseOptionalBody<T>(req: NextRequest, schema: ZodSchema<T>): Promise<T> {
  const text = (await req.text()).trim();
  let raw: unknown = {};
  if (text) {
    try {
      raw = JSON.parse(text);
    } catch {
      throw badRequest("Request body must be valid JSON");
    }
  }
  return schema.parse(raw);
}
