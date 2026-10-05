import type { DriverEarningsDto } from "@raahi/shared";
import { requireDriver } from "@/lib/auth";
import { json, route } from "@/lib/http";
import { ratingAvg } from "@/lib/mappers";
import { driverEarnings } from "@/lib/marketplace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/http";

/** GET /api/driver/earnings — today / week / month totals, 30-day series, acceptance rate and rating. */
export const GET = route(async (req) => {
  const { user, driver } = await requireDriver(req);
  const earnings = await driverEarnings(driver);
  const dto: DriverEarningsDto = { ...earnings, ratingAvg: ratingAvg(user.ratingSum, user.ratingCount) };
  return json(dto);
});
