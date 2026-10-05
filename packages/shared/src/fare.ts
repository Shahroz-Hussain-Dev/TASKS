import { VEHICLE_CATEGORY_META, type PlatformSettings, type VehicleCategory } from "./constants";

/**
 * Raahi fare engine.
 *
 * The passenger names a price, but the marketplace needs guard-rails so that
 * no ride can ever be posted below what it costs the driver to drive it, and
 * no passenger can be gouged. The engine therefore derives three numbers for
 * every request:
 *
 *   fuelCost      = distance / fuel-economy × current petrol price (OGRA)
 *   minimumFare   = fuelCost + driver flat (PKR 100 by default)          ← the floor
 *   recommended   = fuelCost × 1.15 + driver flat + per-minute × duration ← "fair"
 *   maximumFare   = recommended × 1.6                                    ← the ceiling
 *
 * Fuel economy comes from the requested vehicle category average (passenger
 * side) or from the driver's actual registered vehicle (driver side), so a
 * driver in a 24 km/L Aqua sees a different personal break-even than a driver
 * in a 12 km/L Corolla for the same request.
 */

export interface FareInput {
  distanceKm: number;
  durationMin: number;
  category: VehicleCategory;
  /** Override fuel economy with a specific vehicle (driver side). */
  kmPerLitre?: number;
  settings: Pick<
    PlatformSettings,
    | "petrolPricePkr"
    | "driverFlatPkr"
    | "perMinutePkr"
    | "recommendedFuelMultiplier"
    | "maxFareMultiplier"
    | "roundToPkr"
    | "absoluteMinimumFarePkr"
  >;
}

export interface FareBreakdown {
  distanceKm: number;
  durationMin: number;
  category: VehicleCategory;
  kmPerLitre: number;
  petrolPricePkr: number;
  litresNeeded: number;
  fuelCostPkr: number;
  driverFlatPkr: number;
  timeCostPkr: number;
  comfortMultiplier: number;
  /** Absolute floor — a bid below this is rejected by the API. */
  minimumFarePkr: number;
  /** Suggested fair price shown pre-filled to the passenger. */
  recommendedFarePkr: number;
  /** Ceiling — an offer above this is rejected by the API. */
  maximumFarePkr: number;
}

export function roundTo(value: number, step: number): number {
  if (!Number.isFinite(value)) return 0;
  const s = step > 0 ? step : 1;
  return Math.round(value / s) * s;
}

export function ceilTo(value: number, step: number): number {
  if (!Number.isFinite(value)) return 0;
  const s = step > 0 ? step : 1;
  return Math.ceil(value / s) * s;
}

export function computeFare(input: FareInput): FareBreakdown {
  const meta = VEHICLE_CATEGORY_META[input.category];
  const distanceKm = Math.max(0.3, input.distanceKm);
  const durationMin = Math.max(1, input.durationMin);
  const kmPerLitre = input.kmPerLitre && input.kmPerLitre > 0 ? input.kmPerLitre : meta.avgKmPerLitre;
  const s = input.settings;

  const litresNeeded = distanceKm / kmPerLitre;
  const fuelCostPkr = litresNeeded * s.petrolPricePkr;
  const timeCostPkr = durationMin * s.perMinutePkr;
  const comfortMultiplier = meta.comfortMultiplier;

  const rawMin = (fuelCostPkr + s.driverFlatPkr) * comfortMultiplier;
  const rawRecommended = (fuelCostPkr * s.recommendedFuelMultiplier + s.driverFlatPkr + timeCostPkr) * comfortMultiplier;
  const rawMax = rawRecommended * s.maxFareMultiplier;

  const minimumFarePkr = Math.max(s.absoluteMinimumFarePkr, ceilTo(rawMin, s.roundToPkr));
  const recommendedFarePkr = Math.max(minimumFarePkr, roundTo(rawRecommended, s.roundToPkr));
  const maximumFarePkr = Math.max(recommendedFarePkr + s.roundToPkr, roundTo(rawMax, s.roundToPkr));

  return {
    distanceKm: round2(distanceKm),
    durationMin: Math.round(durationMin),
    category: input.category,
    kmPerLitre,
    petrolPricePkr: s.petrolPricePkr,
    litresNeeded: round2(litresNeeded),
    fuelCostPkr: Math.round(fuelCostPkr),
    driverFlatPkr: s.driverFlatPkr,
    timeCostPkr: Math.round(timeCostPkr),
    comfortMultiplier,
    minimumFarePkr,
    recommendedFarePkr,
    maximumFarePkr,
  };
}

/** Driver-side profit view for a concrete bid amount. */
export interface DriverEconomics {
  bidPkr: number;
  fuelCostPkr: number;
  netEarningPkr: number;
  /** PKR earned per minute of the trip — handy for comparing requests. */
  earningPerMinutePkr: number;
  belowBreakEven: boolean;
}

export function driverEconomics(bidPkr: number, breakdown: FareBreakdown): DriverEconomics {
  const net = bidPkr - breakdown.fuelCostPkr;
  return {
    bidPkr,
    fuelCostPkr: breakdown.fuelCostPkr,
    netEarningPkr: Math.round(net),
    earningPerMinutePkr: round2(net / Math.max(1, breakdown.durationMin)),
    belowBreakEven: net < breakdown.driverFlatPkr,
  };
}

/** Validate that an amount is an allowed offer/bid for a request. */
export function isWithinFareBounds(amount: number, min: number, max: number): boolean {
  return Number.isFinite(amount) && Number.isInteger(amount) && amount >= min && amount <= max;
}

export function formatPkr(amount: number, opts: { compact?: boolean } = {}): string {
  if (!Number.isFinite(amount)) return "PKR —";
  if (opts.compact && Math.abs(amount) >= 1000) {
    return `PKR ${(amount / 1000).toFixed(amount % 1000 === 0 ? 0 : 1)}k`;
  }
  return `PKR ${Math.round(amount).toLocaleString("en-PK")}`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
