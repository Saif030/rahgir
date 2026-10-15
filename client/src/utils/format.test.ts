import { describe, expect, it } from "vitest";
import { colorFor } from "../types";
import { fmtRange, fmtTime, isPast, minsBetween } from "../utils/format";

describe("category colors", () => {
  it("maps known categories and falls back", () => {
    expect(colorFor("Tech")).toBe("#2f6bff");
    expect(colorFor("Wellness")).toBe("#ef4444");
    expect(colorFor("Unknown")).toBe("#64748b");
  });
});

describe("time formatting", () => {
  it("computes durations", () => {
    expect(minsBetween("2026-01-01T10:00:00", "2026-01-01T11:30:00")).toBe(90);
  });
  it("formats ranges with times", () => {
    const r = fmtRange("2026-01-01T10:00:00", "2026-01-01T11:00:00");
    expect(r).toContain(fmtTime("2026-01-01T10:00:00"));
  });
});

describe("isPast", () => {
  it("returns true for ended events", () => {
    expect(isPast("2020-01-01T10:00:00Z", new Date("2026-01-01T00:00:00Z").getTime())).toBe(true);
  });
  it("returns false for future events", () => {
    expect(isPast("2030-01-01T10:00:00Z", new Date("2026-01-01T00:00:00Z").getTime())).toBe(false);
  });
  it("accepts Date objects", () => {
    expect(isPast(new Date("2020-01-01T00:00:00Z"), new Date("2026-01-01T00:00:00Z").getTime())).toBe(true);
  });
  it("returns false for invalid dates", () => {
    expect(isPast("not-a-date")).toBe(false);
  });
});
