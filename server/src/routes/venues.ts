import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { cache } from "../lib/cache.js";
import { requireAuth, requireRole, type AuthedRequest } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";

const router = Router();

const venueSchema = z.object({
  name: z.string().min(1),
  building: z.string().min(1),
  floor: z.string().optional(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  capacity: z.number().int().positive(),
  amenities: z.array(z.string()).optional(),
  eateryNearby: z.boolean().optional(),
  indoorGraphId: z.string().optional(),
});

function serialize(v: { amenities: string; [k: string]: unknown }) {
  return { ...v, amenities: JSON.parse(v.amenities as string) };
}

router.get("/", async (_req, res, next) => {
  try {
    const hit = await cache.get("venues:list");
    if (hit) return res.json(hit);
    const rows = await prisma.venue.findMany({ orderBy: { name: "asc" } });
    const out = rows.map(serialize);
    await cache.set("venues:list", out, 600);
    res.json(out);
  } catch (e) {
    next(e);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const v = await prisma.venue.findUnique({ where: { id: req.params.id } });
    if (!v) return res.status(404).json({ error: "Venue not found" });
    const events = await prisma.event.findMany({
      where: { venueId: v.id, startsAt: { gte: new Date() } },
      orderBy: { startsAt: "asc" },
      take: 20,
    });
    res.json({ ...serialize(v), upcomingEvents: events });
  } catch (e) {
    next(e);
  }
});

router.post("/", requireAuth, requireRole("ORGANISER", "ADMIN"), validateBody(venueSchema), async (req: AuthedRequest, res, next) => {
  try {
    const b = req.body as z.infer<typeof venueSchema>;
    const v = await prisma.venue.create({
      data: { ...b, amenities: JSON.stringify(b.amenities ?? []) },
    });
    await cache.del("venues:list");
    res.status(201).json(serialize(v));
  } catch (e) {
    next(e);
  }
});

export default router;
