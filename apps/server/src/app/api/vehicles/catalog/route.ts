import { z } from "zod";
import { json, parseQuery, route } from "@/lib/http";
import { VEHICLE_CATALOG, VEHICLE_CATEGORIES, vehicleCategorySchema, vehiclesForCategory, type VehicleModel } from "@raahi/shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/http";

/** `category=` (empty) is treated like an absent filter so a cleared picker still works. */
const querySchema = z.object({
  category: z
    .union([vehicleCategorySchema, z.literal("")], {
      errorMap: () => ({ message: `Choose one of ${VEHICLE_CATEGORIES.join(", ")}` }),
    })
    .optional(),
  q: z.string().trim().max(60).optional(),
});

export const GET = route(async (req) => {
  const { category, q } = parseQuery(req, querySchema);
  let items: VehicleModel[] = category ? vehiclesForCategory(category) : VEHICLE_CATALOG;
  if (q) {
    const needle = q.toLowerCase();
    items = items.filter((v) => `${v.make} ${v.model}`.toLowerCase().includes(needle));
  }
  // The catalogue ships with the build, so clients and CDNs may hold it for a while.
  return json({ items }, { headers: { "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400" } });
});
