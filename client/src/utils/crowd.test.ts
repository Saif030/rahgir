import { describe, expect, it } from "vitest";
import { venueDensities, venueLoads } from "./crowd";

const ev = (over: Record<string, unknown> = {}) => ({
  venueId: "v1",
  registeredCount: 40,
  capacity: 100,
  endsAt: "2030-01-01T10:00:00Z",
  status: "SCHEDULED",
  ...over,
});

describe("venueLoads (registration-based crowd baseline)", () => {
  it("computes total load Σregistered/Σcapacity per venue", () => {
    const loads = venueLoads([
      ev({ venueId: "a", registeredCount: 30, capacity: 100 }),
      ev({ venueId: "a", registeredCount: 70, capacity: 100 }),
      ev({ venueId: "b", registeredCount: 90, capacity: 100 }),
    ]);
    expect(loads.a.density).toBeCloseTo(0.5, 5);
    expect(loads.a.registered).toBe(100);
    expect(loads.a.capacity).toBe(200);
    expect(loads.b.density).toBeCloseTo(0.9, 5);
  });

  it("skips past and cancelled events", () => {
    const loads = venueLoads([
      ev({ venueId: "a", registeredCount: 100, capacity: 100 }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ev({ venueId: "a", registeredCount: 100, capacity: 100, endsAt: "2020-01-01T00:00:00Z" } as any),
      ev({ venueId: "a", registeredCount: 100, capacity: 100, status: "CANCELLED" }),
    ]);
    expect(loads.a.registered).toBe(100);
    expect(loads.a.eventCount).toBe(1);
  });

  it("clamps to 0..1 and guards zero capacity", () => {
    const loads = venueLoads([
      ev({ venueId: "full", registeredCount: 500, capacity: 100 }),
      ev({ venueId: "zero", registeredCount: 10, capacity: 0 }),
    ]);
    expect(loads.full.density).toBe(1);
    expect(loads.zero.density).toBe(0);
  });

  it("venueDensities returns the density-only view", () => {
    expect(venueDensities([ev({ venueId: "a", registeredCount: 25, capacity: 100 })])).toEqual({ a: 0.25 });
    expect(venueDensities([])).toEqual({});
  });
});
