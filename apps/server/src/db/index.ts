/**
 * Database client for Vercel serverless.
 *
 * - Uses postgres.js with a tiny pool (serverless functions are short-lived).
 * - Prepared statements are disabled because Supabase's transaction-mode
 *   pooler (port 6543) does not support them.
 * - Supabase direct hosts are IPv6-only, which Vercel cannot reach, so if
 *   DATABASE_URL points at db.<ref>.supabase.co we transparently rewrite it to
 *   the IPv4 Supavisor pooler. Candidate pooler hosts are tried in order and
 *   the first one that authenticates is cached for the life of the instance.
 * - On first use the schema is migrated automatically (guarded by an advisory
 *   lock) so a fresh deployment with only env vars set is fully functional.
 */
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres, { type Sql } from "postgres";
import * as schema from "./schema";
import { env } from "@/lib/env";

export type Db = PostgresJsDatabase<typeof schema>;

type Candidate = { url: string; label: string };

const SUPABASE_REGIONS = [
  "ap-south-1",
  "ap-southeast-1",
  "ap-northeast-1",
  "ap-southeast-2",
  "ap-northeast-2",
  "eu-central-1",
  "eu-west-1",
  "eu-west-2",
  "eu-west-3",
  "eu-north-1",
  "us-east-1",
  "us-east-2",
  "us-west-1",
  "us-west-2",
  "ca-central-1",
  "sa-east-1",
];

/** Build the ordered list of connection strings to try. */
export function connectionCandidates(primary: string, fallbacks: string | undefined): Candidate[] {
  const out: Candidate[] = [];
  const seen = new Set<string>();
  const push = (url: string, label: string) => {
    if (!seen.has(url)) {
      seen.add(url);
      out.push({ url, label });
    }
  };

  let u: URL | null = null;
  try {
    u = new URL(primary);
  } catch {
    push(primary, "primary");
  }

  if (u) {
    const direct = /^db\.([a-z0-9]{20})\.supabase\.co$/i.exec(u.hostname);
    if (direct) {
      // Direct host → pooler rewrite. Region hint: ?region=ap-south-1 or env fallback list.
      const ref = direct[1]!;
      const password = u.password;
      const regionHint = u.searchParams.get("region");
      const regions = regionHint ? [regionHint, ...SUPABASE_REGIONS.filter((r) => r !== regionHint)] : SUPABASE_REGIONS;
      for (const region of regions) {
        for (const prefix of ["aws-0", "aws-1"]) {
          push(
            `postgresql://postgres.${ref}:${password}@${prefix}-${region}.pooler.supabase.com:6543/postgres?sslmode=require`,
            `${prefix}-${region}`,
          );
        }
      }
    } else {
      push(u.toString(), "primary");
      // If the user gave an aws-0 pooler, also try aws-1 and vice versa.
      const pooler = /^(aws-[01])-([a-z0-9-]+)\.pooler\.supabase\.com$/i.exec(u.hostname);
      if (pooler) {
        const alt = new URL(u.toString());
        alt.hostname = `${pooler[1] === "aws-0" ? "aws-1" : "aws-0"}-${pooler[2]}.pooler.supabase.com`;
        push(alt.toString(), "pooler-alt");
      }
    }
  }
  for (const f of (fallbacks ?? "").split(",").map((s) => s.trim()).filter(Boolean)) push(f, "fallback");
  return out;
}

declare global {
  var __raahiDb: { sql: Sql; db: Db; url: string; migrated: Promise<void> | null } | undefined;
}

function makeSql(url: string): Sql {
  return postgres(url, {
    max: 3,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false,
    ssl: url.includes("sslmode=require") || url.includes("supabase") ? "require" : undefined,
    onnotice: () => {},
  });
}

async function probe(url: string): Promise<Sql> {
  const sql = makeSql(url);
  try {
    await sql`select 1`;
    return sql;
  } catch (e) {
    await sql.end({ timeout: 1 }).catch(() => {});
    throw e;
  }
}

async function connect(): Promise<{ sql: Sql; db: Db; url: string }> {
  const e = env();
  if (!e.DATABASE_URL) throw new Error("DATABASE_URL is not set");
  const candidates = connectionCandidates(e.DATABASE_URL, e.DATABASE_URL_FALLBACKS);
  const errors: string[] = [];
  for (const c of candidates) {
    try {
      const sql = await probe(c.url);
      if (candidates.length > 1) console.info(`[db] connected via ${c.label}`);
      return { sql, db: drizzle(sql, { schema }), url: c.url };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${c.label}: ${msg}`);
      // "Tenant or user not found" = wrong pooler host for this project → keep trying.
      // Wrong password or network blackhole → still keep trying, but cap total attempts.
      if (errors.length >= 6 && !/Tenant or user not found/i.test(msg)) break;
    }
  }
  throw new Error(`Could not connect to Postgres. Tried: ${errors.join(" | ")}`);
}

/** Lazily connect (and migrate once) — safe to call from every request. */
export async function getDb(): Promise<Db> {
  if (!globalThis.__raahiDb) {
    const conn = await connect();
    globalThis.__raahiDb = { ...conn, migrated: null };
  }
  const state = globalThis.__raahiDb;
  if (env().AUTO_MIGRATE && !state.migrated) {
    state.migrated = runMigrations(state.sql).catch((err) => {
      state.migrated = null; // allow retry on next request
      throw err;
    });
  }
  if (state.migrated) await state.migrated;
  return state.db;
}

export async function getSql(): Promise<Sql> {
  await getDb();
  return globalThis.__raahiDb!.sql;
}

async function runMigrations(sql: Sql) {
  const { migrate } = await import("drizzle-orm/postgres-js/migrator");
  const path = await import("node:path");
  const folder = path.join(process.cwd(), "drizzle");
  // Advisory lock so concurrent cold starts don't race the migrator.
  await sql`select pg_advisory_lock(727272)`;
  try {
    await migrate(drizzle(sql, { schema }), { migrationsFolder: folder });
    const { ensureSeed } = await import("./seed");
    await ensureSeed(drizzle(sql, { schema }));
  } finally {
    await sql`select pg_advisory_unlock(727272)`;
  }
}

export { schema };
