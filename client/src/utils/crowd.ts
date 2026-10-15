import { isPast } from "./format";

export interface VenueLoad {
  registered: number;
  capacity: number;
  /** 0..1 total load (Σ registered / Σ capacity) */
  density: number;
  eventCount: number;
}

interface LoadInput {
  venueId: string;
  registeredCount: number;
  capacity: number;
  endsAt: string | Date;
  status: string;
}

/**
 * Registration-based crowd baseline per venue (total load).
 * Skips past + cancelled events so stale registrations don't drive "live" crowd.
 * Pure — unit-tested in crowd.test.ts.
 */
export function venueLoads(events: LoadInput[]): Record<string, VenueLoad> {
  const acc = new Map<string, { registered: number; capacity: number; eventCount: number }>();
  for (const e of events) {
    if (e.status === "CANCELLED") continue;
    if (isPast(e.endsAt)) continue;
    const cur = acc.get(e.venueId) ?? { registered: 0, capacity: 0, eventCount: 0 };
    cur.registered += Math.max(0, e.registeredCount || 0);
    cur.capacity += Math.max(0, e.capacity || 0);
    cur.eventCount += 1;
    acc.set(e.venueId, cur);
  }
  const out: Record<string, VenueLoad> = {};
  for (const [venueId, v] of acc) {
    const density = v.capacity > 0 ? Math.min(1, Math.max(0, v.registered / v.capacity)) : 0;
    out[venueId] = { registered: v.registered, capacity: v.capacity, density, eventCount: v.eventCount };
  }
  return out;
}

/** Density-only view for map rendering. */
export function venueDensities(events: LoadInput[]): Record<string, number> {
  const loads = venueLoads(events);
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(loads)) out[k] = v.density;
  return out;
}
