import { describe, expect, it } from "@jest/globals";
import { findConflicts } from "../src/utils/routeOptimizer.js";

describe("findConflicts", () => {
  it("detects overlapping events", () => {
    const items = [
      { eventId: "a", startsAt: new Date("2026-01-01T10:00:00"), endsAt: new Date("2026-01-01T11:00:00") },
      { eventId: "b", startsAt: new Date("2026-01-01T10:30:00"), endsAt: new Date("2026-01-01T11:30:00") },
      { eventId: "c", startsAt: new Date("2026-01-01T12:00:00"), endsAt: new Date("2026-01-01T13:00:00") },
    ];
    expect(findConflicts(items)).toEqual([{ a: "a", b: "b" }]);
  });
  it("no conflicts for sequential events", () => {
    const items = [
      { eventId: "a", startsAt: new Date("2026-01-01T10:00:00"), endsAt: new Date("2026-01-01T11:00:00") },
      { eventId: "b", startsAt: new Date("2026-01-01T11:00:00"), endsAt: new Date("2026-01-01T12:00:00") },
    ];
    expect(findConflicts(items)).toEqual([]);
  });
});
