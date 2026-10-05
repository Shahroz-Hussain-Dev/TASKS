import { searchPlaces } from "@/lib/geo-services";
import { clientIp, json, parseQuery, route } from "@/lib/http";
import { memoryLimit } from "@/lib/rate-limit";
import { geocodeSearchSchema } from "@raahi/shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/http";

export const GET = route(async (req) => {
  memoryLimit(`geo:search:${clientIp(req)}`, 60, 60_000);
  const q = parseQuery(req, geocodeSearchSchema);
  const near = q.lat !== undefined && q.lng !== undefined ? { lat: q.lat, lng: q.lng } : null;
  const items = await searchPlaces(q.q, near, q.limit ?? 6);
  return json({ items }, { headers: { "Cache-Control": "public, max-age=300" } });
});
