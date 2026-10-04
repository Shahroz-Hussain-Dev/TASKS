import { NextResponse } from "next/server";
import { ZodError } from "zod";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const badRequest = (message: string, details?: unknown) => new ApiError(400, "bad_request", message, details);
export const unauthorized = (message = "Please sign in to continue") => new ApiError(401, "unauthorized", message);
export const forbidden = (message = "You do not have access to this") => new ApiError(403, "forbidden", message);
export const notFound = (message = "Not found") => new ApiError(404, "not_found", message);
export const conflict = (message: string, details?: unknown) => new ApiError(409, "conflict", message, details);
export const tooMany = (message = "Too many requests. Please slow down.") => new ApiError(429, "rate_limited", message);
export const serverError = (message = "Something went wrong on our side") => new ApiError(500, "server_error", message);
export const serviceUnavailable = (message = "A service we depend on is unavailable") => new ApiError(503, "unavailable", message);

export function errorResponse(err: unknown): NextResponse {
  if (err instanceof ApiError) {
    return NextResponse.json(
      { error: { code: err.code, message: err.message, details: err.details ?? undefined } },
      { status: err.status },
    );
  }
  if (err instanceof ZodError) {
    const first = err.issues[0];
    return NextResponse.json(
      {
        error: {
          code: "validation_error",
          message: first ? `${first.path.length ? first.path.join(".") + ": " : ""}${first.message}` : "Invalid input",
          details: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
        },
      },
      { status: 400 },
    );
  }
  // Unknown error — log the stack server-side, hide it from the client.
  console.error("[api] unhandled error", err);
  const msg = err instanceof Error && /ECONNREFUSED|ENOTFOUND|Tenant or user not found|password authentication/i.test(err.message)
    ? "Database connection failed. Check DATABASE_URL."
    : "Something went wrong on our side";
  return NextResponse.json({ error: { code: "server_error", message: msg } }, { status: 500 });
}
