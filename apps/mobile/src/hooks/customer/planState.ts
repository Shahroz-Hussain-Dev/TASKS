/**
 * Navigation state handed from Home (recent destination / quick category) to
 * the Plan screen. Lives in router state, so it is validated on the way in.
 */
import { VEHICLE_CATEGORIES, isValidLatLng, type Place, type VehicleCategory } from "@raahi/shared";

export interface PlanRideState {
  pickup?: Place;
  dropoff?: Place;
  category?: VehicleCategory;
}

const asPlace = (v: unknown): Place | undefined => {
  if (!v || typeof v !== "object") return undefined;
  const p = v as Partial<Place>;
  if (!isValidLatLng({ lat: p.lat, lng: p.lng }) || typeof p.lat !== "number" || typeof p.lng !== "number") return undefined;
  if (typeof p.address !== "string" || !p.address) return undefined;
  return { lat: p.lat, lng: p.lng, address: p.address, name: typeof p.name === "string" && p.name ? p.name : undefined };
};

const asCategory = (v: unknown): VehicleCategory | undefined => (typeof v === "string" && (VEHICLE_CATEGORIES as readonly string[]).includes(v) ? (v as VehicleCategory) : undefined);

export function readPlanState(state: unknown): PlanRideState {
  if (!state || typeof state !== "object") return {};
  const s = state as Record<string, unknown>;
  return { pickup: asPlace(s.pickup), dropoff: asPlace(s.dropoff), category: asCategory(s.category) };
}
