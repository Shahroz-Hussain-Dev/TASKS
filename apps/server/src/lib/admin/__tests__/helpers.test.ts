import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "@raahi/shared";
import { karachiDayKey, likePattern, recentDayKeys, startOfKarachiDay, startOfKarachiMonth, statusFilter, uuidParam, pageParams } from "@/lib/admin/common";
import { diffSettings } from "@/lib/admin/settings";
import { farePreviewSchema } from "@/lib/admin/fare";

describe("pagination", () => {
  it("applies defaults and computes the offset", () => {
    expect(pageParams({})).toEqual({ page: 1, pageSize: 20, offset: 0, q: undefined, status: undefined });
    expect(pageParams({ page: 3, pageSize: 25, q: "  ali ", status: "" })).toEqual({ page: 3, pageSize: 25, offset: 50, q: "ali", status: undefined });
  });
});

describe("search helpers", () => {
  it("escapes LIKE metacharacters", () => {
    expect(likePattern("100%_off\\")).toBe("%100\\%\\_off\\\\%");
  });

  it("validates status filters against the allowed list", () => {
    expect(statusFilter(undefined, ["a", "b"])).toBeUndefined();
    expect(statusFilter("b", ["a", "b"])).toBe("b");
    expect(() => statusFilter("zzz", ["a", "b"])).toThrowError(/must be one of: a, b/);
  });

  it("accepts only well-formed uuids as route ids", () => {
    expect(uuidParam("5F3C4E52-6B88-4E4D-9E5A-2B1F0C9D8E7A")).toBe("5f3c4e52-6b88-4e4d-9e5a-2b1f0c9d8e7a");
    expect(() => uuidParam("not-an-id", "Driver id")).toThrowError(/Driver id is not a valid identifier/);
  });
});

describe("Pakistan-local time", () => {
  // 2026-10-03 22:30 UTC is already 2026-10-04 03:30 in Karachi (UTC+5).
  const lateEvening = new Date("2026-10-03T22:30:00Z");

  it("derives the day key in Asia/Karachi", () => {
    expect(karachiDayKey(lateEvening)).toBe("2026-10-04");
  });

  it("starts the day at Pakistani midnight", () => {
    expect(startOfKarachiDay(lateEvening).toISOString()).toBe("2026-10-03T19:00:00.000Z");
    expect(startOfKarachiDay(lateEvening, 6).toISOString()).toBe("2026-09-27T19:00:00.000Z");
  });

  it("starts the month at Pakistani midnight on the 1st", () => {
    expect(startOfKarachiMonth(lateEvening).toISOString()).toBe("2026-09-30T19:00:00.000Z");
  });

  it("lists the last N day keys oldest first, ending today", () => {
    const keys = recentDayKeys(3, lateEvening);
    expect(keys).toEqual(["2026-10-02", "2026-10-03", "2026-10-04"]);
  });
});

describe("settings diff", () => {
  it("reports only changed fields, including nested payment details", () => {
    const after = {
      ...DEFAULT_SETTINGS,
      petrolPricePkr: 400,
      paymentInstructions: { ...DEFAULT_SETTINGS.paymentInstructions, jazzcash: "0301-1111111" },
    };
    expect(diffSettings(DEFAULT_SETTINGS, after)).toEqual({
      petrolPricePkr: { from: DEFAULT_SETTINGS.petrolPricePkr, to: 400 },
      "paymentInstructions.jazzcash": { from: DEFAULT_SETTINGS.paymentInstructions.jazzcash, to: "0301-1111111" },
    });
  });

  it("is empty when nothing changed", () => {
    expect(diffSettings(DEFAULT_SETTINGS, { ...DEFAULT_SETTINGS })).toEqual({});
  });
});

describe("fare preview query", () => {
  it("coerces query strings and defaults the category", () => {
    const parsed = farePreviewSchema.parse({ distanceKm: "12.5", durationMin: "30", petrolPricePkr: "400" });
    expect(parsed).toMatchObject({ distanceKm: 12.5, durationMin: 30, category: "car", petrolPricePkr: 400 });
  });

  it("rejects a zero-length trip", () => {
    expect(() => farePreviewSchema.parse({ distanceKm: "0", durationMin: "10" })).toThrow();
  });
});
