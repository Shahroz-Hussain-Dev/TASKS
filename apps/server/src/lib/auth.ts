import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { getDb } from "@/db";
import { drivers, sessions, users, type Driver, type User } from "@/db/schema";
import { env } from "./env";
import { forbidden, unauthorized } from "./errors";
import type { UserRole } from "@raahi/shared";

export const ACCESS_TTL_SECONDS = 60 * 60; // 1 hour
export const REFRESH_TTL_DAYS = 60;

const secret = () => new TextEncoder().encode(env().JWT_SECRET);

export interface AccessClaims {
  sub: string;
  role: UserRole;
  sid: string;
}

export async function hashPassword(pw: string) {
  return bcrypt.hash(pw, 12);
}

export async function verifyPassword(pw: string, hash: string) {
  return bcrypt.compare(pw, hash);
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function signAccessToken(claims: AccessClaims) {
  return new SignJWT({ role: claims.role, sid: claims.sid })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setIssuer("raahi")
    .setAudience("raahi-app")
    .setExpirationTime(`${ACCESS_TTL_SECONDS}s`)
    .sign(secret());
}

export async function verifyAccessToken(token: string): Promise<AccessClaims> {
  const { payload } = await jwtVerify(token, secret(), { issuer: "raahi", audience: "raahi-app" });
  if (!payload.sub || typeof payload.role !== "string" || typeof payload.sid !== "string") throw unauthorized();
  return { sub: payload.sub, role: payload.role as UserRole, sid: payload.sid };
}

/** Create a session row + token pair for a user. */
export async function issueTokens(user: Pick<User, "id" | "role">, meta: { userAgent?: string | null; ip?: string | null }) {
  const db = await getDb();
  const refreshToken = randomBytes(48).toString("base64url");
  const expiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 86_400_000);
  const [session] = await db
    .insert(sessions)
    .values({
      userId: user.id,
      refreshTokenHash: hashToken(refreshToken),
      userAgent: meta.userAgent?.slice(0, 300) ?? null,
      ip: meta.ip?.slice(0, 64) ?? null,
      expiresAt,
      lastUsedAt: new Date(),
    })
    .returning({ id: sessions.id });
  const accessToken = await signAccessToken({ sub: user.id, role: user.role, sid: session!.id });
  return { accessToken, refreshToken, expiresIn: ACCESS_TTL_SECONDS };
}

/** Rotate a refresh token: revoke old session, create a new one. */
export async function rotateRefreshToken(refreshToken: string, meta: { userAgent?: string | null; ip?: string | null }) {
  const db = await getDb();
  const [session] = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.refreshTokenHash, hashToken(refreshToken)), isNull(sessions.revokedAt), gt(sessions.expiresAt, new Date())))
    .limit(1);
  if (!session) throw unauthorized("Your session has expired. Please sign in again.");
  const [user] = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
  if (!user || user.isBlocked) throw forbidden("This account has been blocked");
  await db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.id, session.id));
  const tokens = await issueTokens(user, meta);
  return { user, tokens };
}

export async function revokeSession(sessionId: string) {
  const db = await getDb();
  await db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.id, sessionId));
}

export async function revokeAllSessions(userId: string) {
  const db = await getDb();
  await db.update(sessions).set({ revokedAt: new Date() }).where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
}

export interface AuthContext {
  user: User;
  claims: AccessClaims;
  driver: Driver | null;
}

function bearer(req: NextRequest): string | null {
  const h = req.headers.get("authorization");
  if (h?.startsWith("Bearer ")) return h.slice(7).trim();
  // Admin panel uses an HttpOnly cookie.
  const cookie = req.cookies.get("raahi_admin")?.value;
  return cookie ?? null;
}

/** Authenticate the request. Throws 401/403. */
export async function requireAuth(req: NextRequest, roles?: UserRole[]): Promise<AuthContext> {
  const token = bearer(req);
  if (!token) throw unauthorized();
  let claims: AccessClaims;
  try {
    claims = await verifyAccessToken(token);
  } catch {
    throw unauthorized("Your session has expired. Please sign in again.");
  }
  const db = await getDb();
  const [row] = await db
    .select({ user: users, session: sessions })
    .from(users)
    .innerJoin(sessions, eq(sessions.id, claims.sid))
    .where(eq(users.id, claims.sub))
    .limit(1);
  if (!row || row.session.revokedAt || row.session.userId !== row.user.id) throw unauthorized("Your session has expired. Please sign in again.");
  if (row.user.isBlocked) throw forbidden("This account has been blocked. Contact support.");
  if (roles && !roles.includes(row.user.role)) throw forbidden();
  let driver: Driver | null = null;
  if (row.user.role === "driver") {
    const [d] = await db.select().from(drivers).where(eq(drivers.userId, row.user.id)).limit(1);
    driver = d ?? null;
  }
  // Touch last-used occasionally (cheap write, not every request).
  if (!row.session.lastUsedAt || Date.now() - row.session.lastUsedAt.getTime() > 5 * 60_000) {
    db.update(sessions).set({ lastUsedAt: new Date() }).where(eq(sessions.id, claims.sid)).catch(() => {});
    db.update(users).set({ lastSeenAt: new Date() }).where(eq(users.id, row.user.id)).catch(() => {});
  }
  return { user: row.user, claims, driver };
}

export const requireCustomer = (req: NextRequest) => requireAuth(req, ["customer"]);
export const requireAdmin = (req: NextRequest) => requireAuth(req, ["admin"]);
export async function requireDriver(req: NextRequest): Promise<AuthContext & { driver: Driver }> {
  const ctx = await requireAuth(req, ["driver"]);
  if (!ctx.driver) throw forbidden("Driver profile missing");
  return ctx as AuthContext & { driver: Driver };
}

/** Driver may operate the marketplace only when approved with an active subscription. */
export function assertDriverCanWork(driver: Driver, subscriptionActive: boolean) {
  if (driver.status !== "approved") throw forbidden("Your driver account is not approved yet");
  if (!subscriptionActive) throw forbidden("Your monthly subscription has expired. Renew to go online.");
}
