import { describe, expect, it } from "vitest";
import { normalizePkPhone, formatPkPhone, normalizeCnic, formatCnic, normalizePlate } from "../phone";
import { haversineKm, decodePolyline, boundingBox } from "../geo";

describe("phone normalisation", () => {
  it("accepts every common Pakistani format", () => {
    for (const v of ["03001234567", "0300-1234567", "0300 1234567", "+92 300 1234567", "923001234567", "00923001234567", "3001234567"]) {
      expect(normalizePkPhone(v)).toBe("+923001234567");
    }
  });
  it("rejects garbage", () => {
    for (const v of ["", "12345", "04001234567", "+1 555 123 4567", "0300123456"]) {
      expect(normalizePkPhone(v)).toBeNull();
    }
  });
  it("formats back to local style", () => {
    expect(formatPkPhone("+923001234567")).toBe("0300 1234567");
  });
});

describe("cnic & plate", () => {
  it("normalises CNIC", () => {
    expect(normalizeCnic("35202-1234567-1")).toBe("3520212345671");
    expect(normalizeCnic("3520212345")).toBeNull();
    expect(formatCnic("3520212345671")).toBe("35202-1234567-1");
  });
  it("normalises plates", () => {
    expect(normalizePlate("lea 1234")).toBe("LEA 1234");
    expect(normalizePlate("  abc-123 ")).toBe("ABC-123");
    expect(normalizePlate("a")).toBeNull();
  });
});

describe("geo", () => {
  it("measures Lahore Liberty → Johar Town ≈ 7-8 km straight line", () => {
    const d = haversineKm({ lat: 31.5204, lng: 74.3587 }, { lat: 31.4697, lng: 74.2728 });
    expect(d).toBeGreaterThan(9);
    expect(d).toBeLessThan(11);
  });
  it("decodes polylines", () => {
    const pts = decodePolyline("_p~iF~ps|U_ulLnnqC_mqNvxq`@");
    expect(pts).toHaveLength(3);
    expect(pts[0]!.lat).toBeCloseTo(38.5, 3);
    expect(pts[0]!.lng).toBeCloseTo(-120.2, 3);
  });
  it("builds a bounding box", () => {
    const b = boundingBox({ lat: 31.5, lng: 74.3 }, 5);
    expect(b.maxLat - b.minLat).toBeCloseTo(0.0898, 3);
  });
});
