import { describe, expect, it } from "vitest";
import { computeFare, driverEconomics, isWithinFareBounds, formatPkr } from "../fare";
import { DEFAULT_SETTINGS } from "../constants";

describe("fare engine", () => {
  const s = DEFAULT_SETTINGS;

  it("never lets the minimum fall below fuel cost + driver flat", () => {
    const f = computeFare({ distanceKm: 10, durationMin: 25, category: "car", settings: s });
    // 10 km / 14 km/L * 392.76 = 280.5 fuel → +100 = 380.5 → ceil to 390
    expect(f.fuelCostPkr).toBe(281);
    expect(f.minimumFarePkr).toBeGreaterThanOrEqual(f.fuelCostPkr + s.driverFlatPkr);
    expect(f.minimumFarePkr).toBe(390);
  });

  it("orders min <= recommended <= max", () => {
    for (const km of [0.5, 2, 7, 15, 40, 120]) {
      for (const category of ["bike", "rickshaw", "car", "car_ac", "car_premium"] as const) {
        const f = computeFare({ distanceKm: km, durationMin: km * 3, category, settings: s });
        expect(f.minimumFarePkr).toBeLessThanOrEqual(f.recommendedFarePkr);
        expect(f.recommendedFarePkr).toBeLessThan(f.maximumFarePkr);
        expect(f.minimumFarePkr % s.roundToPkr).toBe(0);
        expect(f.maximumFarePkr % s.roundToPkr).toBe(0);
      }
    }
  });

  it("applies the absolute minimum for very short trips", () => {
    const f = computeFare({ distanceKm: 0.4, durationMin: 2, category: "bike", settings: s });
    // 0.4 km on a bike costs ~PKR 3.5 of fuel + 100 flat → 110 after rounding up; never below the absolute floor.
    expect(f.minimumFarePkr).toBeGreaterThanOrEqual(s.absoluteMinimumFarePkr);
    expect(f.minimumFarePkr).toBe(110);
    const floored = computeFare({ distanceKm: 0.4, durationMin: 2, category: "bike", settings: { ...s, absoluteMinimumFarePkr: 150 } });
    expect(floored.minimumFarePkr).toBe(150);
    expect(floored.recommendedFarePkr).toBeGreaterThanOrEqual(150);
  });

  it("uses the driver's own vehicle economy when provided", () => {
    const corolla = computeFare({ distanceKm: 12, durationMin: 30, category: "car", kmPerLitre: 12, settings: s });
    const aqua = computeFare({ distanceKm: 12, durationMin: 30, category: "car", kmPerLitre: 24, settings: s });
    expect(aqua.fuelCostPkr).toBeLessThan(corolla.fuelCostPkr);
    expect(driverEconomics(600, aqua).netEarningPkr).toBeGreaterThan(driverEconomics(600, corolla).netEarningPkr);
  });

  it("charges more for comfort tiers", () => {
    const eco = computeFare({ distanceKm: 8, durationMin: 20, category: "car", settings: s });
    const ac = computeFare({ distanceKm: 8, durationMin: 20, category: "car_ac", settings: s });
    const premium = computeFare({ distanceKm: 8, durationMin: 20, category: "car_premium", settings: s });
    expect(ac.recommendedFarePkr).toBeGreaterThan(eco.recommendedFarePkr);
    expect(premium.recommendedFarePkr).toBeGreaterThan(ac.recommendedFarePkr);
  });

  it("reacts to petrol price changes", () => {
    const cheap = computeFare({ distanceKm: 10, durationMin: 25, category: "car", settings: { ...s, petrolPricePkr: 250 } });
    const dear = computeFare({ distanceKm: 10, durationMin: 25, category: "car", settings: { ...s, petrolPricePkr: 450 } });
    expect(dear.minimumFarePkr).toBeGreaterThan(cheap.minimumFarePkr);
  });

  it("flags bids below break-even", () => {
    const f = computeFare({ distanceKm: 10, durationMin: 25, category: "car", settings: s });
    expect(driverEconomics(f.fuelCostPkr + 20, f).belowBreakEven).toBe(true);
    expect(driverEconomics(f.recommendedFarePkr, f).belowBreakEven).toBe(false);
  });

  it("validates bounds strictly with integers", () => {
    expect(isWithinFareBounds(400, 390, 800)).toBe(true);
    expect(isWithinFareBounds(389, 390, 800)).toBe(false);
    expect(isWithinFareBounds(400.5, 390, 800)).toBe(false);
    expect(isWithinFareBounds(Number.NaN, 390, 800)).toBe(false);
  });

  it("formats PKR", () => {
    expect(formatPkr(450)).toBe("PKR 450");
    expect(formatPkr(1500, { compact: true })).toBe("PKR 1.5k");
  });
});
