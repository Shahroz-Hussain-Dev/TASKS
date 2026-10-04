import type { User } from "@/db/schema";
import { verifyPassword } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { forbidden, unauthorized } from "@/lib/errors";
import { assertLoginAllowed, clearLoginFailures, recordLoginFailure } from "@/lib/rate-limit";

/**
 * A genuine cost-12 bcrypt hash that no account uses. When the identifier is
 * unknown we still compare against it, so a miss costs the same time as a
 * wrong password and account enumeration by timing is not possible.
 */
const TIMING_GUARD_HASH = "$2b$12$wtuULvpQQp88H6DnzYWbQOYPDutNy54235p/PrLnbiBnWIIMVum5m";

export interface PasswordLoginParams {
  /** The credential being tried — E.164 phone or lower-cased email. */
  identifier: string;
  role: User["role"];
  password: string;
  ip: string;
  lookup: () => Promise<User | undefined>;
}

/**
 * Shared password check for the mobile and admin login routes. Enforces the
 * cross-instance brute-force lock on both the identifier and the client IP,
 * records failures, clears the identifier's counter on success and refuses
 * blocked accounts.
 */
export async function authenticateWithPassword(p: PasswordLoginParams): Promise<User> {
  const identityKey = `login:${p.identifier}:${p.role}`;
  const ipKey = `ip:${p.ip}`;
  await Promise.all([assertLoginAllowed(identityKey), assertLoginAllowed(ipKey)]);

  const user = await p.lookup();
  const passwordOk = await verifyPassword(p.password, user?.passwordHash ?? TIMING_GUARD_HASH);
  if (!user || !passwordOk) {
    await Promise.all([recordLoginFailure(identityKey), recordLoginFailure(ipKey)]);
    await audit({
      actorRole: p.role,
      action: "auth.login_failed",
      targetType: "credential",
      meta: { identifier: p.identifier, role: p.role },
      ip: p.ip,
    });
    throw unauthorized(p.role === "admin" ? "Incorrect email or password" : "Incorrect phone number or password");
  }
  if (user.isBlocked) throw forbidden("This account has been blocked. Contact support.");
  await clearLoginFailures(identityKey);
  return user;
}
