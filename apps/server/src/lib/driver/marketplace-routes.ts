/**
 * Helpers shared by the marketplace route handlers (requests, rides, driver).
 *
 * They keep the route files thin: authentication of "a party to a ride",
 * UUID-safe path params, and the handful of request shapes that have no
 * counterpart in the shared schema package.
 */
import type { NextRequest } from "next/server";
import { z, type ZodSchema } from "zod";
import { CANCEL_REASONS_CUSTOMER, CANCEL_REASONS_DRIVER, uuidSchema } from "@raahi/shared";
import { requireAuth, type AuthContext } from "@/lib/auth";
import { badRequest, notFound } from "@/lib/errors";

/** The two sides of a ride. Admins use their own endpoints. */
export type PartyRole = "customer" | "driver";

export interface PartyContext extends AuthContext {
  role: PartyRole;
}

/** Authenticate a customer or a driver and expose the narrowed role for the marketplace helpers. */
export async function requireParty(req: NextRequest): Promise<PartyContext> {
  const ctx = await requireAuth(req, ["customer", "driver"]);
  const role: PartyRole = ctx.user.role === "driver" ? "driver" : "customer";
  return { ...ctx, role };
}

/**
 * Resolve the `[id]` segment and make sure it is a well-formed UUID before it
 * reaches Postgres (a malformed id would otherwise surface as a 500).
 */
export async function idParam(params: Promise<{ id: string }>, missingMessage = "Not found"): Promise<string> {
  const { id } = await params;
  const parsed = uuidSchema.safeParse(id);
  if (!parsed.success) throw notFound(missingMessage);
  return parsed.data;
}

/**
 * Parse a JSON body that is allowed to be absent (e.g. a DELETE with an optional reason).
 * Returns undefined for an empty body, otherwise the validated value.
 */
export async function parseOptionalBody<T>(req: NextRequest, schema: ZodSchema<T>): Promise<T | undefined> {
  const raw = await req.text();
  if (!raw.trim()) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw badRequest("Request body must be valid JSON");
  }
  return schema.parse(parsed);
}

/** Body of `POST /api/requests/[id]/accept`. */
export const acceptBidSchema = z.object({ bidId: uuidSchema });

/** Cancellation reasons are role-specific ("Other" exists in both lists). */
export function assertCancelReasonForRole(reason: string, role: PartyRole): void {
  const allowed: readonly string[] = role === "customer" ? CANCEL_REASONS_CUSTOMER : CANCEL_REASONS_DRIVER;
  if (!allowed.includes(reason)) throw badRequest("Choose a cancellation reason from the list");
}
