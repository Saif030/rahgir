import { describe, expect, it, afterAll } from "@jest/globals";
import { prisma } from "../src/lib/prisma.js";
import { optimizeRoute } from "../src/utils/routeOptimizer.js";

const createdVenueIds: string[] = [];

async function mkVenue(name: string, lat: number, lng: number) {
  const v = await prisma.venue.create({
    data: { name, building: "Test", lat, lng, capacity: 50 },
  });
  createdVenueIds.push(v.id);
  return v;
}

afterAll(async () => {
  if (createdVenueIds.length > 0) {
    await prisma.routeCache.deleteMany({
      where: { OR: [{ fromVenueId: { in: createdVenueIds } }, { toVenueId: { in: createdVenueIds } }] },
    });
    await prisma.venue.deleteMany({ where: { id: { in: createdVenueIds } } });
  }
  await prisma.$disconnect();
});

describe("optimizeRoute keeps every selected event", () => {
  it("returns all 3 stops (2 sharing one venue) with 3 legs", async () => {
    const a = await mkVenue(`Opt Test A ${Date.now()}`, 12.9716, 77.5946);
    const b = await mkVenue(`Opt Test B ${Date.now()}`, 12.9816, 77.6046);
    const t = (h: number) => new Date(`2026-06-01T${String(h).padStart(2, "0")}:00:00Z`);
    const events = [
      { id: "e1", venueId: a.id, startsAt: t(10), endsAt: new Date(t(10).getTime() + 45 * 60000) },
      { id: "e2", venueId: a.id, startsAt: t(12), endsAt: new Date(t(12).getTime() + 45 * 60000) },
      { id: "e3", venueId: b.id, startsAt: t(14), endsAt: new Date(t(14).getTime() + 45 * 60000) },
    ];
    const result = await optimizeRoute(events, { bufferMin: 15 });
    // No event may be dropped: 3 in → 3 out
    expect(result.sequence).toHaveLength(3);
    expect(new Set(result.sequence)).toEqual(new Set(["e1", "e2", "e3"]));
    // 1 anchor leg + (n - 1) travel legs
    expect(result.legs).toHaveLength(3);
    // Same-venue pair needs no travel
    const sameVenueLeg = result.legs.find(
      (l) => l.fromEventId === "e1" && l.toEventId === "e2",
    );
    expect(sameVenueLeg).toBeDefined();
    expect(sameVenueLeg!.travelMin).toBeCloseTo(0, 5);
  }, 30000);
});
