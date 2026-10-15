import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { estimateLeg } from "./src/utils/geo.js";

const p = new PrismaClient();
const vs = await p.venue.findMany({ take: 8, select: { id: true, name: true } });
// pick two venues that are NOT a seeded pair (seeded pairs share index patterns;
// any pair works since live-first self-heals — use first + last for distance)
const a = vs[0];
const b = vs[vs.length - 1];
console.log("FROM:", a.name, "TO:", b.name);
const leg = await estimateLeg(a.id, b.id, "walking");
const coords = (leg.geometry as { coordinates?: unknown[] } | undefined)?.coordinates;
console.log(JSON.stringify({
  source: leg.source,
  travelMin: Number(leg.travelMin?.toFixed?.(2) ?? leg.travelMin),
  distanceM: Math.round(leg.distanceM),
  coordCount: Array.isArray(coords) ? coords.length : 0,
}));
await p.$disconnect();
