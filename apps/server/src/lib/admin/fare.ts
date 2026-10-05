import { z } from "zod";
import { computeFare, vehicleCategorySchema, type FareBreakdown } from "@raahi/shared";
import { getSettings } from "@/lib/settings";

/** Query parameters of GET /api/admin/fare/preview. */
export const farePreviewSchema = z.object({
  distanceKm: z.coerce.number().positive("distanceKm must be greater than 0").max(1000),
  durationMin: z.coerce.number().positive("durationMin must be greater than 0").max(2000),
  category: vehicleCategorySchema.default("car"),
  /** Try a different petrol price without saving it. */
  petrolPricePkr: z.coerce.number().min(50).max(2000).optional(),
  /** Model a specific vehicle instead of the category average. */
  kmPerLitre: z.coerce.number().min(3).max(80).optional(),
  driverFlatPkr: z.coerce.number().min(0).max(5000).optional(),
  perMinutePkr: z.coerce.number().min(0).max(100).optional(),
  recommendedFuelMultiplier: z.coerce.number().min(1).max(3).optional(),
  maxFareMultiplier: z.coerce.number().min(1.1).max(5).optional(),
});

/** Typed on zod's input side to match `parseQuery`; the category default is re-applied below. */
export type FarePreviewInput = z.input<typeof farePreviewSchema>;

/** What a passenger would see for this trip under the current (or hypothetical) settings. */
export async function previewFare(input: FarePreviewInput): Promise<FareBreakdown> {
  const current = await getSettings();
  return computeFare({
    distanceKm: input.distanceKm,
    durationMin: input.durationMin,
    category: input.category ?? "car",
    kmPerLitre: input.kmPerLitre,
    settings: {
      petrolPricePkr: input.petrolPricePkr ?? current.petrolPricePkr,
      driverFlatPkr: input.driverFlatPkr ?? current.driverFlatPkr,
      perMinutePkr: input.perMinutePkr ?? current.perMinutePkr,
      recommendedFuelMultiplier: input.recommendedFuelMultiplier ?? current.recommendedFuelMultiplier,
      maxFareMultiplier: input.maxFareMultiplier ?? current.maxFareMultiplier,
      roundToPkr: current.roundToPkr,
      absoluteMinimumFarePkr: current.absoluteMinimumFarePkr,
    },
  });
}
