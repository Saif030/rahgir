import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { cache } from "../lib/cache.js";
import { requireAuth, requireRole, type AuthedRequest } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { emitEventChanged, emitItineraryAffected, getIO } from "../lib/socket.js";

const router = Router();

export const CATEGORIES = ["Tech", "Design", "Business", "Networking", "Wellness"] as const;

const eventSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1),
  category: z.string().min(1),
  venueId: z.string().min(1),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  capacity: z.number().int().positive(),
  difficulty: z.string().optional(),
  speakerName: z.string().optional(),
  speakerBio: z.string().optional(),
  planOut: z.record(z.number()).optional(),
});

function serialize(e: {
  capacity: number;
  registeredCount: number;
  planOut: string;
  [k: string]: unknown;
}) {
  const ratio = e.capacity > 0 ? e.registeredCount / e.capacity : 0;
  return {
    ...e,
    planOut: JSON.parse(e.planOut as string),
    availability: ratio >= 1 ? "full" : ratio >= 0.8 ? "almost-full" : "available",
  };
}

// GET /api/events?category&search&q&date&time&capacity&difficulty&page&limit
router.get("/", async (req, res, next) => {
  try {
    const { category, search, q, date, time, capacity, difficulty, page, limit } = req.query as Record<
      string,
      string | undefined
    >;
    const term = search ?? q;
    const pg = Math.max(1, parseInt(page ?? "1", 10) || 1);
    const lim = Math.min(100, Math.max(1, parseInt(limit ?? "50", 10) || 50));
    const key = `events:list:${JSON.stringify({ category, term, date, time, capacity, difficulty, pg, lim })}`;
    const hit = await cache.get<unknown>(key);
    if (hit) return res.json(hit);

    const where: Record<string, unknown> = {};
    if (category) where.category = category;
    if (difficulty) where.difficulty = difficulty;
    if (capacity === "available") {
      // filter post-query (needs ratio); keep query broad
    }
    if (date) {
      const start = new Date(`${date}T00:00:00`);
      const end = new Date(`${date}T23:59:59`);
      where.startsAt = { gte: start, lte: end };
    }
    if (time) {
      // time=HH:MM — events overlapping that minute
      const day = (date as string) ?? new Date().toISOString().slice(0, 10);
      const t = new Date(`${day}T${time}:00`);
      where.startsAt = { ...(where.startsAt as object ?? {}), lte: t };
      where.endsAt = { gte: t };
    }
    if (term) {
      where.OR = [
        { title: { contains: term } },
        { description: { contains: term } },
        { speakerName: { contains: term } },
      ];
    }
    const [total, rows] = await Promise.all([
      prisma.event.count({ where: where as never }),
      prisma.event.findMany({
        where: where as never,
        include: { venue: true },
        orderBy: { startsAt: "asc" },
        skip: (pg - 1) * lim,
        take: lim,
      }),
    ]);
    let data = rows.map(serialize);
    if (capacity === "available") data = data.filter((d) => d.availability === "available");
    const out = { total, page: pg, limit: lim, data };
    await cache.set(key, out, 60);
    res.json(out);
  } catch (e) {
    next(e);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const e = await prisma.event.findUnique({ where: { id: req.params.id }, include: { venue: true } });
    if (!e) return res.status(404).json({ error: "Event not found" });
    res.json(serialize(e));
  } catch (e) {
    next(e);
  }
});

router.post("/", requireAuth, requireRole("ORGANISER", "ADMIN"), validateBody(eventSchema), async (req: AuthedRequest, res, next) => {
  try {
    const b = req.body as z.infer<typeof eventSchema>;
    if (new Date(b.endsAt) <= new Date(b.startsAt))
      return res.status(400).json({ error: "endsAt must be after startsAt" });
    const venue = await prisma.venue.findUnique({ where: { id: b.venueId } });
    if (!venue) return res.status(400).json({ error: "Unknown venueId" });
    const e = await prisma.event.create({
      data: {
        title: b.title,
        description: b.description,
        category: b.category,
        venueId: b.venueId,
        startsAt: new Date(b.startsAt),
        endsAt: new Date(b.endsAt),
        capacity: b.capacity,
        difficulty: b.difficulty ?? "Beginner",
        speakerName: b.speakerName,
        speakerBio: b.speakerBio,
        planOut: JSON.stringify(b.planOut ?? {}),
        createdById: req.user!.id,
      },
      include: { venue: true },
    });
    await cache.delPrefix("events:list:");
    res.status(201).json(serialize(e));
  } catch (e) {
    next(e);
  }
});

router.put("/:id", requireAuth, requireRole("ORGANISER", "ADMIN"), async (req: AuthedRequest, res, next) => {
  try {
    const existing = await prisma.event.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: "Event not found" });
    const patch = eventSchema.partial().parse(req.body);
    const data: Record<string, unknown> = { ...patch, version: { increment: 1 } };
    if (patch.startsAt) data.startsAt = new Date(patch.startsAt);
    if (patch.endsAt) data.endsAt = new Date(patch.endsAt);
    if (patch.planOut) data.planOut = JSON.stringify(patch.planOut);
    const statusChanged = (req.body as { status?: string }).status;
    if (statusChanged === "CANCELLED" || statusChanged === "MOVED" || statusChanged === "SCHEDULED") {
      data.status = statusChanged;
    }
    const e = await prisma.event.update({ where: { id: req.params.id }, data: data as never, include: { venue: true } });
    await cache.delPrefix("events:list:");
    const io = getIO(req);
    if (io) {
      const payload = { eventId: e.id, status: e.status, version: e.version };
      emitEventChanged(io, e.id, payload);
      // Notify all users with this event in an itinerary (spec: realtime affected alert)
      const items = await prisma.itineraryItem.findMany({
        where: { eventId: e.id },
        include: { itinerary: true },
      });
      const userIds = [...new Set(items.map((i) => i.itinerary.userId))];
      for (const uid of userIds) emitItineraryAffected(io, uid, { eventId: e.id, status: e.status });
    }
    res.json(serialize(e));
  } catch (e) {
    next(e);
  }
});

router.delete("/:id", requireAuth, requireRole("ORGANISER", "ADMIN"), async (req, res, next) => {
  try {
    await prisma.event.delete({ where: { id: req.params.id } });
    await cache.delPrefix("events:list:");
    const io = getIO(req);
    if (io) emitEventChanged(io, req.params.id, { eventId: req.params.id, status: "CANCELLED" });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default router;
