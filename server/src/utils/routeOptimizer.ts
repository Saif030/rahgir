// Time-windowed route optimizer: nearest-feasible + 2-opt with buffer.
// Respects event start/end times; reports infeasible legs as warnings.
import { estimateLeg, DEFAULT_BUFFER_MIN } from "./geo.js";

export interface OptimizerEvent {
  id: string;
  venueId: string;
  startsAt: Date;
  endsAt: Date;
}

export interface OptimizedLeg {
  fromEventId: string | null;
  toEventId: string;
  departAt: string;
  arriveAt: string;
  travelMin: number;
  distanceM: number;
  source: string;
  feasible: boolean;
}

export interface OptimizedRoute {
  sequence: string[];
  legs: OptimizedLeg[];
  totalTravelMin: number;
  warnings: string[];
}

/** Greedy by earliest feasible arrival, then 2-opt on travel time. */
export async function optimizeRoute(
  events: OptimizerEvent[],
  opts: { startAt?: Date; bufferMin?: number; mode?: string } = {},
): Promise<OptimizedRoute> {
  const bufferMin = opts.bufferMin ?? DEFAULT_BUFFER_MIN;
  const mode = opts.mode ?? "walking";
  if (events.length === 0) return { sequence: [], legs: [], totalTravelMin: 0, warnings: [] };

  const sorted = [...events].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  // Greedy: start from earliest event, repeatedly pick feasible event with min travel.
  const remaining = [...sorted];
  const sequence: OptimizerEvent[] = [];
  let cursor = opts.startAt ?? sorted[0].startsAt;
  // Start at earliest event regardless (anchor), then greedily extend.
  sequence.push(remaining.shift()!);
  cursor = new Date(sequence[0].endsAt.getTime() + bufferMin * 60000);

  while (remaining.length > 0) {
    let bestIdx = -1;
    let bestTravel = Infinity;
    let bestFeasible = false;
    for (let i = 0; i < remaining.length; i++) {
      const last = sequence[sequence.length - 1];
      const leg = await estimateLeg(last.venueId, remaining[i].venueId, mode);
      const arrive = new Date(cursor.getTime() + leg.durationMin * 60000);
      const feasible = arrive.getTime() <= remaining[i].startsAt.getTime();
      if ((feasible && !bestFeasible) || (feasible === bestFeasible && leg.durationMin < bestTravel)) {
        bestFeasible = feasible;
        bestTravel = leg.durationMin;
        bestIdx = i;
      }
    }
    const [next] = remaining.splice(bestIdx, 1);
    sequence.push(next);
    const lastLeg = await estimateLeg(sequence[sequence.length - 2].venueId, next.venueId, mode);
    cursor = new Date(Math.max(next.startsAt.getTime(), cursor.getTime() + lastLeg.durationMin * 60000));
    cursor = new Date(next.endsAt.getTime() + bufferMin * 60000);
  }

  // 2-opt improvement passes (keep time-window feasibility as hard constraint where possible)
  const travelOf = async (order: OptimizerEvent[]) => {
    let t = 0;
    for (let i = 1; i < order.length; i++) {
      t += (await estimateLeg(order[i - 1].venueId, order[i].venueId, mode)).durationMin;
    }
    return t;
  };

  let improved = true;
  let guard = 0;
  while (improved && guard++ < 4) {
    improved = false;
    const base = await travelOf(sequence);
    for (let i = 1; i < sequence.length - 1; i++) {
      for (let j = i + 1; j < sequence.length; j++) {
        const cand = [...sequence.slice(0, i), ...sequence.slice(i, j + 1).reverse(), ...sequence.slice(j + 1)];
        // keep chronological sanity: don't break hard start-time order badly; allow but penalize
        const t = await travelOf(cand);
        if (t + 1e-6 < base && chronologicalFeasible(cand, bufferMin)) {
          sequence.splice(0, sequence.length, ...cand);
          improved = true;
        }
      }
    }
  }

  // Build legs with departure/arrival times
  const legs: OptimizedLeg[] = [];
  const warnings: string[] = [];
  let totalTravelMin = 0;
  // First leg: arrive at first event start
  const first = sequence[0];
  legs.push({
    fromEventId: null,
    toEventId: first.id,
    departAt: first.startsAt.toISOString(),
    arriveAt: first.startsAt.toISOString(),
    travelMin: 0,
    distanceM: 0,
    source: "anchor",
    feasible: true,
  });
  for (let i = 1; i < sequence.length; i++) {
    const prev = sequence[i - 1];
    const cur = sequence[i];
    const leg = await estimateLeg(prev.venueId, cur.venueId, mode);
    const departAt = new Date(prev.endsAt.getTime() + bufferMin * 60000);
    const arriveAt = new Date(departAt.getTime() + leg.durationMin * 60000);
    const feasible = arriveAt.getTime() <= cur.startsAt.getTime();
    totalTravelMin += leg.durationMin;
    if (!feasible) {
      warnings.push(
        `Tight connection: "${prev.id}" ends ${prev.endsAt.toISOString()} but "${cur.id}" starts ${cur.startsAt.toISOString()} (~${leg.durationMin.toFixed(1)} min walk + ${bufferMin} min buffer).`,
      );
    }
    legs.push({
      fromEventId: prev.id,
      toEventId: cur.id,
      departAt: departAt.toISOString(),
      arriveAt: arriveAt.toISOString(),
      travelMin: leg.durationMin,
      distanceM: leg.distanceM,
      source: leg.source,
      feasible,
    });
  }

  return { sequence: sequence.map((e) => e.id), legs, totalTravelMin, warnings };
}

function chronologicalFeasible(order: OptimizerEvent[], bufferMin: number): boolean {
  for (let i = 1; i < order.length; i++) {
    const earliestArrive = order[i - 1].endsAt.getTime() + bufferMin * 60000;
    if (earliestArrive > order[i].startsAt.getTime()) return false;
  }
  return true;
}

export function findConflicts(
  items: { eventId: string; startsAt: Date; endsAt: Date }[],
): { a: string; b: string }[] {
  const out: { a: string; b: string }[] = [];
  const sorted = [...items].sort((x, y) => x.startsAt.getTime() - y.startsAt.getTime());
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      if (sorted[j].startsAt.getTime() < sorted[i].endsAt.getTime()) {
        out.push({ a: sorted[i].eventId, b: sorted[j].eventId });
      } else break;
    }
  }
  return out;
}
