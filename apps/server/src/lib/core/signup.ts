import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { drivers, users, type User } from "@/db/schema";
import { hashPassword, issueTokens } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { conflict } from "@/lib/errors";
import type { AuthResponse } from "@raahi/shared";
import { buildAuthResponse } from "./auth-response";
import { isUniqueViolation } from "./db-errors";
import type { RequestMeta } from "./request-meta";

export interface CreateAccountInput {
  role: "customer" | "driver";
  fullName: string;
  phone: string;
  email?: string;
  password: string;
  meta: RequestMeta;
}

const PHONE_TAKEN = "An account with this mobile number already exists. Sign in instead.";
const EMAIL_TAKEN = "This email is already linked to another account.";

/**
 * Create a customer or driver account and sign it in. Drivers also get their
 * onboarding profile row in the same transaction so `driver` is never null in
 * the response. Phone and email are unique per role, so one person can hold
 * both a passenger and a driver account with the same number.
 */
export async function createAccount(input: CreateAccountInput): Promise<AuthResponse> {
  const db = await getDb();
  const [phoneTaken] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.phone, input.phone), eq(users.role, input.role)))
    .limit(1);
  if (phoneTaken) throw conflict(PHONE_TAKEN);
  if (input.email) {
    const [emailTaken] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.email, input.email), eq(users.role, input.role)))
      .limit(1);
    if (emailTaken) throw conflict(EMAIL_TAKEN);
  }

  const passwordHash = await hashPassword(input.password);
  let user: User;
  try {
    user = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(users)
        .values({ role: input.role, fullName: input.fullName, phone: input.phone, email: input.email ?? null, passwordHash })
        .returning();
      if (input.role === "driver") await tx.insert(drivers).values({ userId: row!.id, status: "onboarding" });
      return row!;
    });
  } catch (err) {
    if (isUniqueViolation(err, "users_email_role_uq")) throw conflict(EMAIL_TAKEN);
    if (isUniqueViolation(err)) throw conflict(PHONE_TAKEN);
    throw err;
  }

  const tokens = await issueTokens(user, input.meta);
  await audit({ actorId: user.id, actorRole: user.role, action: "auth.signup", targetType: "user", targetId: user.id, meta: { role: user.role }, ip: input.meta.ip });
  return buildAuthResponse(user, tokens);
}
