// Geo + routing helpers. Road-following geometry first (Mapbox Directions,
// then free OSRM fallback); haversine straight-line estimate as last resort.
// RouteCache + in-memory cache persist full legs *including* geometry.
import { cache } from "../lib/cache.js";
import { prisma } from "../lib/prisma.js";

export const WALK_M_PER_MIN = 80; // ~4.8 km/h
export const DEFAULT_BUFFER_MIN = 15;

export function haversineM(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLng / 2);
  const a =
    s1 * s1 + Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * s2 * s2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function walkMinutesForDistance(meters: number): number {
  return meters / WALK_M_PER_MIN;
}

export interface LegEstimate {
  distanceM: number;
  durationMin: number;
  source: "mapbox" | "osrm" | "haversine" | "cache";
  geometry?: unknown;
}

/** A geometry is only usable for drawing when it's a LineString with ≥2 points. */
export function isUsableGeometry(g: unknown): g is { type: string; coordinates: number[][] } {
  if (!g || typeof g !== "object") return false;
  const geom = g as { type?: unknown; coordinates?: unknown };
  return (
    geom.type === "LineString" &&
    Array.isArray(geom.coordinates) &&
    geom.coordinates.length >= 2
  );
}

/** Parse a RouteCache.geometry JSON string; null when empty/legacy ("{}")/invalid. */
export function parseStoredGeometry(raw: string): { type: string; coordinates: number[][] } | null {
  if (!raw) return null;
  try {
    const g: unknown = JSON.parse(raw);
    return isUsableGeometry(g) ? g : null;
  } catch {
    return null;
  }
}

interface VenuePoint {
  lat: number;
  lng: number;
}

async function fetchMapboxLeg(
  from: VenuePoint,
  to: VenuePoint,
  token: string,
): Promise<LegEstimate | null> {
  try {
    const url =
      `https://api.mapbox.com/directions/v5/mapbox/walking/` +
      `${from.lng},${from.lat};${to.lng},${to.lat}?geometries=geojson&overview=full&access_token=${token}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = (await res.json()) as {
      routes?: { duration: number; distance: number; geometry: unknown }[];
    };
    const r = json.routes?.[0];
    if (!r || !isUsableGeometry(r.geometry)) return null;
    return {
      distanceM: r.distance,
      durationMin: r.duration / 60,
      source: "mapbox",
      geometry: r.geometry,
    };
  } catch {
    return null;
  }
}

async function fetchOsrmLeg(from: VenuePoint, to: VenuePoint): Promise<LegEstimate | null> {
  try {
    const url =
      `https://router.project-osrm.org/route/v1/foot/` +
      `${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = (await res.json()) as {
      code?: string;
      routes?: { duration: number; distance: number; geometry: unknown }[];
    };
    if (json.code && json.code !== "Ok") return null;
    const r = json.routes?.[0];
    if (!r || !isUsableGeometry(r.geometry)) return null;
    return {
      distanceM: r.distance,
      durationMin: r.duration / 60,
      source: "osrm",
      geometry: r.geometry,
    };
  } catch {
    return null;
  }
}

async function persistLeg(
  cacheKey: string,
  fromVenueId: string,
  toVenueId: string,
  mode: string,
  leg: LegEstimate,
  ttlSec: number,
): Promise<void> {
  await cache.set(cacheKey, leg, ttlSec);
  if (leg.source === "mapbox" || leg.source === "osrm") {
    await prisma.routeCache
      .upsert({
        where: { fromVenueId_toVenueId_mode: { fromVenueId, toVenueId, mode } },
        create: {
          fromVenueId,
          toVenueId,
          mode,
          durationSec: leg.durationMin * 60,
          distanceM: leg.distanceM,
          geometry: JSON.stringify(leg.geometry ?? {}),
        },
        update: {
          durationSec: leg.durationMin * 60,
          distanceM: leg.distanceM,
          geometry: JSON.stringify(leg.geometry ?? {}),
        },
      })
      .catch(() => null);
  }
}

export async function estimateLeg(
  fromVenueId: string,
  toVenueId: string,
  mode = "walking",
): Promise<LegEstimate> {
  const key = `routes:matrix:${mode}:${fromVenueId}:${toVenueId}`;

  const [from, to] = await Promise.all([
    prisma.venue.findUnique({ where: { id: fromVenueId } }),
    prisma.venue.findUnique({ where: { id: toVenueId } }),
  ]);
  if (!from || !to) throw new Error("Unknown venue id");

  // Reuse a cached road geometry when we have one (fast path, still road-following).
  const mem = await cache.get<LegEstimate>(key);
  if (mem && isUsableGeometry(mem.geometry)) return { ...mem, source: "cache" };

  // Live road geometry first (Mapbox), so pairs always upgrade to real paths.
  const token = process.env.MAPBOX_TOKEN;
  if (token) {
    const live = await fetchMapboxLeg(from, to, token);
    if (live) {
      await persistLeg(key, fromVenueId, toVenueId, mode, live, 3600);
      return live;
    }
  }

  // Persisted road geometry from an earlier live lookup.
  const persisted = await prisma.routeCache
    .findUnique({ where: { fromVenueId_toVenueId_mode: { fromVenueId, toVenueId, mode } } })
    .catch(() => null);
  const storedGeometry = persisted ? parseStoredGeometry(persisted.geometry) : null;
  if (persisted && storedGeometry) {
    const leg: LegEstimate = {
      distanceM: persisted.distanceM,
      durationMin: persisted.durationSec / 60,
      source: "cache",
      geometry: storedGeometry,
    };
    await cache.set(key, leg, 3600);
    return leg;
  }

  // Free OSRM fallback (no key) before giving up to a straight line.
  const osrm = await fetchOsrmLeg(from, to);
  if (osrm) {
    await persistLeg(key, fromVenueId, toVenueId, mode, osrm, 3600);
    return osrm;
  }

  // Distance-only legacy row (e.g. seeded "{}"): reuse its numbers, no path.
  if (persisted) {
    const leg: LegEstimate = {
      distanceM: persisted.distanceM,
      durationMin: persisted.durationSec / 60,
      source: "cache",
    };
    await cache.set(key, leg, 600);
    return leg;
  }
  if (mem) return mem;

  const distanceM = haversineM(from.lat, from.lng, to.lat, to.lng);
  const leg: LegEstimate = { distanceM, durationMin: walkMinutesForDistance(distanceM), source: "haversine" };
  await cache.set(key, leg, 600);
  return leg;
}
