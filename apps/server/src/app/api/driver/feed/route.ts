import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { drivers } from "@/db/schema";
import { requireDriver } from "@/lib/auth";
import { json, route } from "@/lib/http";
import { assertDriverOperational, driverFeed } from "@/lib/marketplace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/http";

/** GET /api/driver/feed — nearby open requests with this driver's personal economics. Polled every 3 s while online. */
export const GET = route(async (req) => {
  const { driver } = await requireDriver(req);
  await assertDriverOperational(driver);
  const items = driver.isOnline ? await driverFeed(driver) : [];
  // Housekeeping inside the feed may have flipped a stale driver offline — report the truth.
  const db = await getDb();
  const [fresh] = await db.select({ isOnline: drivers.isOnline }).from(drivers).where(eq(drivers.id, driver.id)).limit(1);
  const online = fresh?.isOnline ?? driver.isOnline;
  return json({ items: online ? items : [], online, serverTime: new Date().toISOString() });
});
