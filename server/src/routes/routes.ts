import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { estimateLeg } from "../utils/geo.js";
import { optimizeRoute } from "../utils/routeOptimizer.js";
import { validateBody } from "../middleware/validate.js";

const router = Router();

const optimizeSchema = z.object({
  eventIds: z.array(z.string()).min(1).max(30),
  startAt: z.string().datetime().optional(),
  bufferMin: z.number().min(0).max(120).optional(),
  mode: z.string().optional(),
  includeEateries: z.boolean().optional(),
});

router.post("/optimize", validateBody(optimizeSchema), async (req, res, next) => {
  try {
    const { eventIds, startAt, bufferMin, mode, includeEateries } = req.body as z.infer<typeof optimizeSchema>;
    const events = await prisma.event.findMany({
      where: { id: { in: eventIds } },
      include: { venue: true },
    });
    if (events.length !== eventIds.length)
      return res.status(404).json({ error: "One or more eventIds not found" });
    const result = await optimizeRoute(
      events.map((e) => ({ id: e.id, venueId: e.venueId, startsAt: new Date(e.startsAt), endsAt: new Date(e.endsAt) })),
      { startAt: startAt ? new Date(startAt) : undefined, bufferMin, mode },
    );

    // Optional eatery suggestion: for gaps >= 45 min, suggest venue with eateryNearby on/near path
    let eateryStops: { afterEventId: string; venueId: string; venueName: string; gapMin: number }[] = [];
    if (includeEateries) {
      const byId = new Map(events.map((e) => [e.id, e]));
      for (let i = 1; i < result.sequence.length; i++) {
        const prev = byId.get(result.sequence[i - 1])!;
        const cur = byId.get(result.sequence[i])!;
        const gapMin = (cur.startsAt.getTime() - prev.endsAt.getTime()) / 60000;
        if (gapMin >= 45) {
          const eatery = await prisma.venue.findFirst({ where: { eateryNearby: true } });
          if (eatery) eateryStops.push({ afterEventId: prev.id, venueId: eatery.id, venueName: eatery.name, gapMin });
        }
      }
    }

    res.json({ ...result, eateryStops });
  } catch (e) {
    next(e);
  }
});

router.get("/between/:v1/:v2", async (req, res, next) => {
  try {
    const mode = (req.query.mode as string) ?? "walking";
    const leg = await estimateLeg(req.params.v1, req.params.v2, mode);
    res.json({
      fromVenueId: req.params.v1,
      toVenueId: req.params.v2,
      mode,
      travelMin: leg.durationMin,
      distanceM: leg.distanceM,
      source: leg.source,
      geometry: leg.geometry ?? null,
      suggestedDepartOffsetMin: leg.durationMin + 15,
    });
  } catch (e) {
    next(e);
  }
});

export default router;
