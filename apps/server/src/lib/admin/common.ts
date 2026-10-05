/**
 * Helpers shared by every admin service: the acting admin, pagination,
 * search patterns and Pakistan-local day boundaries for reports.
 */
import { sql } from "drizzle-orm";
import type { NextRequest } from "next/server";
import type { z } from "zod";
import { type Paginated, type paginationSchema } from "@raahi/shared";
import type { User } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { badRequest } from "@/lib/errors";
import { clientIp } from "@/lib/http";

export interface AdminActor {
  user: User;
  ip: string;
}

export async function adminActor(req: NextRequest): Promise<AdminActor> {
  const { user } = await requireAdmin(req);
  return { user, ip: clientIp(req) };
}

/** `parseQuery` is typed on zod's input side, so defaults are re-applied here (they already ran at runtime). */
export type PaginationQuery = z.input<typeof paginationSchema>;

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;

export interface PageParams {
  page: number;
  pageSize: number;
  offset: number;
  q: string | undefined;
  status: string | undefined;
}

export function pageParams(query: PaginationQuery): PageParams {
  const page = query.page ?? DEFAULT_PAGE;
  const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
  const q = query.q?.trim();
  const status = query.status?.trim();
  return {
    page,
    pageSize,
    offset: (page - 1) * pageSize,
    q: q ? q : undefined,
    status: status ? status : undefined,
  };
}

export function paginated<T>(items: T[], total: unknown, p: PageParams): Paginated<T> {
  return { items, page: p.page, pageSize: p.pageSize, total: toInt(total) };
}

/** postgres.js returns bigint aggregates as strings. */
export const toInt = (v: unknown): number => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

export const countAll = sql<number>`count(*)`;

/** `%term%` with LIKE metacharacters escaped so a search for "100%" means exactly that. */
export function likePattern(term: string): string {
  return `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Validate an optional `status` filter against the allowed enum; 400 with the allowed values otherwise. */
export function statusFilter<T extends string>(value: string | undefined, allowed: readonly T[], label = "status"): T | undefined {
  if (value === undefined) return undefined;
  if ((allowed as readonly string[]).includes(value)) return value as T;
  throw badRequest(`${label} must be one of: ${allowed.join(", ")}`);
}

/* ------------------------------------------------------------------ */
/* Pakistan Standard Time helpers (UTC+5, no daylight saving)          */
/* ------------------------------------------------------------------ */

export const KARACHI_TZ = "Asia/Karachi";
const PKT_OFFSET = "+05:00";
const DAY_MS = 86_400_000;

const dayKeyFmt = new Intl.DateTimeFormat("en-CA", { timeZone: KARACHI_TZ, year: "numeric", month: "2-digit", day: "2-digit" });

/** YYYY-MM-DD of the given instant in Pakistan. */
export function karachiDayKey(d: Date): string {
  return dayKeyFmt.format(d);
}

/** Midnight (PKT) that starts the Pakistani calendar day containing `d`, shifted by `daysBack`. */
export function startOfKarachiDay(d: Date, daysBack = 0): Date {
  const midnight = new Date(`${karachiDayKey(d)}T00:00:00${PKT_OFFSET}`);
  return new Date(midnight.getTime() - daysBack * DAY_MS);
}

/** Midnight (PKT) on the first day of the Pakistani calendar month containing `d`. */
export function startOfKarachiMonth(d: Date): Date {
  return new Date(`${karachiDayKey(d).slice(0, 7)}-01T00:00:00${PKT_OFFSET}`);
}

/** The last `days` Pakistani day keys ending today, oldest first. */
export function recentDayKeys(days: number, now = new Date()): string[] {
  const out: string[] = [];
  for (let i = days - 1; i >= 0; i--) out.push(karachiDayKey(new Date(now.getTime() - i * DAY_MS)));
  return out;
}

/** Route ids come straight from the URL; reject garbage before it reaches Postgres. */
export function uuidParam(value: string, label = "id"): string {
  if (!UUID_RE.test(value)) throw badRequest(`${label} is not a valid identifier`);
  return value.toLowerCase();
}
