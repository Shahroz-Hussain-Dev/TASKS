import { useMapSurface } from "@/hooks/customer/useMapSurface";

/** Drop inside <MapView> on screens that have no other map-side component. */
export function MapSurfaceGuard() {
  useMapSurface();
  return null;
}
