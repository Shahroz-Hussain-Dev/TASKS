import { reverseGeocode } from "@/lib/geo-services";
import { clientIp, json, parseQuery, route } from "@/lib/http";
import { memoryLimit } from "@/lib/rate-limit";
import { reverseGeocodeSchema } from "@raahi/shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/http";

export const GET = route(async (req) => {
  memoryLimit(`geo:reverse:${clientIp(req)}`, 60, 60_000);
  const { lat, lng } = parseQuery(req, reverseGeocodeSchema);
  const place = await reverseGeocode({ lat, lng });
  return json(place, { headers: { "Cache-Control": "public, max-age=3600" } });
});
