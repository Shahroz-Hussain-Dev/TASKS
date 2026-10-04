import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { loginAttempts } from "@/db/schema";
import { tooMany } from "./errors";
import { ts } from "./sql";

/**
 * Two layers of rate limiting:
 *  1. In-memory token bucket per instance for cheap, bursty protection.
 *  2. Postgres-backed counters for login brute-force protection that must hold
 *     across all serverless instances.
 */

const buckets = new Map<string, { tokens: number; updated: number }>();

export function memoryLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const b = buckets.get(key) ?? { tokens: limit, updated: now };
  const refill = ((now - b.updated) / windowMs) * limit;
  b.tokens = Math.min(limit, b.tokens + refill);
  b.updated = now;
  if (b.tokens < 1) {
    buckets.set(key, b);
    throw tooMany();
  }
  b.tokens -= 1;
  buckets.set(key, b);
  if (buckets.size > 10_000) {
    // crude eviction
    for (const [k, v] of buckets) if (now - v.updated > windowMs * 2) buckets.delete(k);
  }
}

const LOGIN_WINDOW_MS = 15 * 60_000;
const LOGIN_MAX = 8;
const LOCK_MS = 15 * 60_000;

export async function assertLoginAllowed(key: string) {
  const db = await getDb();
  const [row] = await db.select().from(loginAttempts).where(sql`${loginAttempts.key} = ${key}`).limit(1);
  if (!row) return;
  if (row.lockedUntil && row.lockedUntil.getTime() > Date.now()) {
    const mins = Math.ceil((row.lockedUntil.getTime() - Date.now()) / 60_000);
    throw tooMany(`Too many failed attempts. Try again in ${mins} minute${mins === 1 ? "" : "s"}.`);
  }
}

export async function recordLoginFailure(key: string) {
  const db = await getDb();
  const now = new Date();
  await db
    .insert(loginAttempts)
    .values({ key, count: 1, windowStartedAt: now })
    .onConflictDoUpdate({
      target: loginAttempts.key,
      set: {
        count: sql`case when ${loginAttempts.windowStartedAt} < ${ts(new Date(Date.now() - LOGIN_WINDOW_MS))} then 1 else ${loginAttempts.count} + 1 end`,
        windowStartedAt: sql`case when ${loginAttempts.windowStartedAt} < ${ts(new Date(Date.now() - LOGIN_WINDOW_MS))} then ${ts(now)} else ${loginAttempts.windowStartedAt} end`,
        lockedUntil: sql`case when (case when ${loginAttempts.windowStartedAt} < ${ts(new Date(Date.now() - LOGIN_WINDOW_MS))} then 1 else ${loginAttempts.count} + 1 end) >= ${LOGIN_MAX} then ${ts(new Date(Date.now() + LOCK_MS))} else null end`,
      },
    });
}

export async function clearLoginFailures(key: string) {
  const db = await getDb();
  await db.delete(loginAttempts).where(sql`${loginAttempts.key} = ${key}`);
}
