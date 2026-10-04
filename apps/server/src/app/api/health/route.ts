import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { json, route } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/http";

/** Health must answer quickly even when every pooler candidate is unreachable. */
const DB_PROBE_TIMEOUT_MS = 8_000;

async function probeDatabase(): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<false>((resolve) => {
    timer = setTimeout(() => resolve(false), DB_PROBE_TIMEOUT_MS);
  });
  const probe = (async () => {
    const db = await getDb();
    await db.execute(sql`select 1`);
    return true;
  })().catch(() => false);
  try {
    return await Promise.race([probe, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export const GET = route(async () => {
  const db = await probeDatabase();
  return json({ ok: true, db, time: new Date().toISOString() });
});
