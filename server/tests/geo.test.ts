import { describe, expect, it, afterEach, afterAll } from "@jest/globals";
import { prisma } from "../src/lib/prisma.js";
import {
  haversineM,
  walkMinutesForDistance,
  estimateLeg,
  isUsableGeometry,
  parseStoredGeometry,
} from "../src/utils/geo.js";

describe("geo utils", () => {
  it("haversine ~111km per degree latitude", () => {
    const d = haversineM(0, 0, 1, 0);
    expect(d).toBeGreaterThan(110_000);
    expect(d).toBeLessThan(112_000);
  });
  it("zero distance for same point", () => {
    expect(haversineM(12.9, 77.5, 12.9, 77.5)).toBeCloseTo(0, 5);
  });
  it("walk minutes scale linearly", () => {
    expect(walkMinutesForDistance(80)).toBeCloseTo(1, 5);
    expect(walkMinutesForDistance(160)).toBeCloseTo(2, 5);
  });
});

describe("geometry validation", () => {
  it("accepts a LineString with ≥2 points", () => {
    expect(isUsableGeometry({ type: "LineString", coordinates: [[0, 0], [1, 1]] })).toBe(true);
  });
  it("rejects empty / legacy / malformed geometry", () => {
    expect(isUsableGeometry(null)).toBe(false);
    expect(isUsableGeometry({})).toBe(false);
    expect(isUsableGeometry({ type: "LineString", coordinates: [[0, 0]] })).toBe(false);
    expect(parseStoredGeometry("")).toBeNull();
    expect(parseStoredGeometry("{}")).toBeNull();
    expect(parseStoredGeometry("not-json")).toBeNull();
  });
});

describe("estimateLeg road geometry", () => {
  const realFetch = global.fetch;
  const realToken = process.env.MAPBOX_TOKEN;
  const createdVenueIds: string[] = [];
  let fetchCalls = 0;

  const lineGeom = {
    type: "LineString",
    coordinates: [
      [77.5946, 12.9716],
      [77.596, 12.973],
      [77.598, 12.975],
    ],
  };

  function stubFetch(handler: (url: string) => unknown) {
    fetchCalls = 0;
    global.fetch = (async (url: unknown) => {
      fetchCalls++;
      return handler(url as string);
    }) as unknown as typeof fetch;
  }

  async function mkVenue(name: string, lat: number, lng: number) {
    const v = await prisma.venue.create({ data: { name, building: "GeoTest", lat, lng, capacity: 10 } });
    createdVenueIds.push(v.id);
    return v;
  }

  afterEach(() => {
    global.fetch = realFetch;
    if (realToken === undefined) delete process.env.MAPBOX_TOKEN;
    else process.env.MAPBOX_TOKEN = realToken;
  });

  afterAll(async () => {
    global.fetch = realFetch;
    if (createdVenueIds.length > 0) {
      await prisma.routeCache.deleteMany({
        where: { OR: [{ fromVenueId: { in: createdVenueIds } }, { toVenueId: { in: createdVenueIds } }] },
      });
      await prisma.venue.deleteMany({ where: { id: { in: createdVenueIds } } });
    }
    await prisma.$disconnect();
  });

  it("upgrades a legacy '{}' cache row with live Mapbox geometry", async () => {
    process.env.MAPBOX_TOKEN = "test-token";
    const a = await mkVenue(`Geo A ${Date.now()}`, 12.9716, 77.5946);
    const b = await mkVenue(`Geo B ${Date.now()}`, 12.9816, 77.6046);
    await prisma.routeCache.create({
      data: { fromVenueId: a.id, toVenueId: b.id, mode: "walking", durationSec: 600, distanceM: 800, geometry: "{}" },
    });
    stubFetch(async () => ({
      ok: true,
      json: async () => ({ routes: [{ duration: 480, distance: 640, geometry: lineGeom }] }),
    }));
    const leg = await estimateLeg(a.id, b.id, "walking");
    expect(leg.source).toBe("mapbox");
    expect(isUsableGeometry(leg.geometry)).toBe(true);
    expect(leg.distanceM).toBe(640);
    // persisted row is healed with real geometry
    const row = await prisma.routeCache.findUnique({
      where: { fromVenueId_toVenueId_mode: { fromVenueId: a.id, toVenueId: b.id, mode: "walking" } },
    });
    expect(parseStoredGeometry(row!.geometry)).not.toBeNull();
  }, 30000);

  it("serves road geometry from cache without refetching", async () => {
    process.env.MAPBOX_TOKEN = "test-token";
    const a = await mkVenue(`Geo C ${Date.now()}`, 12.9716, 77.5946);
    const b = await mkVenue(`Geo D ${Date.now()}`, 12.975, 77.6);
    stubFetch(async () => ({
      ok: true,
      json: async () => ({ routes: [{ duration: 300, distance: 400, geometry: lineGeom }] }),
    }));
    const first = await estimateLeg(a.id, b.id, "walking");
    expect(first.source).toBe("mapbox");
    const second = await estimateLeg(a.id, b.id, "walking");
    expect(second.source).toBe("cache");
    expect(isUsableGeometry(second.geometry)).toBe(true);
    expect(fetchCalls).toBe(1);
  }, 30000);

  it("falls back to haversine when all providers fail", async () => {
    delete process.env.MAPBOX_TOKEN;
    const a = await mkVenue(`Geo E ${Date.now()}`, 12.9716, 77.5946);
    const b = await mkVenue(`Geo F ${Date.now()}`, 12.9816, 77.6046);
    stubFetch(async () => {
      throw new Error("offline");
    });
    const leg = await estimateLeg(a.id, b.id, "walking");
    expect(leg.source).toBe("haversine");
    expect(leg.geometry).toBeUndefined();
    expect(leg.distanceM).toBeGreaterThan(0);
  }, 30000);
});
