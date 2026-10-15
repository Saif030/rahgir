import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { findConflicts } from "../utils/routeOptimizer.js";
import { buildIcs } from "../utils/ics.js";

const router = Router();
router.use(requireAuth);

function serialize(it: {
  items: { event: { startsAt: Date; endsAt: Date; [k: string]: unknown }; [k: string]: unknown }[];
  [k: string]: unknown;
}) {
  const items = [...it.items].sort((a, b) => (a.order as number) - (b.order as number));
  const enriched = items.map((i) => {
    const ev = i.event as unknown as Record<string, unknown>;
    return {
      ...i,
      event: { ...ev, planOut: JSON.parse(ev.planOut as string) },
    };
  });
  const conflicts = findConflicts(
    enriched.map((i) => {
      const ev = i.event as unknown as { id: string; startsAt: Date; endsAt: Date };
      return { eventId: ev.id, startsAt: new Date(ev.startsAt), endsAt: new Date(ev.endsAt) };
    }),
  );
  const totalMin =
    enriched.length === 0
      ? 0
      : enriched.reduce((s, i) => {
          const ev = i.event as unknown as { startsAt: Date; endsAt: Date };
          return s + (new Date(ev.endsAt).getTime() - new Date(ev.startsAt).getTime()) / 60000;
        }, 0);
  const gaps: { from: string; to: string; gapMin: number }[] = [];
  for (let k = 1; k < enriched.length; k++) {
    const prev = enriched[k - 1].event as unknown as { id: string; endsAt: Date };
    const cur = enriched[k].event as unknown as { id: string; startsAt: Date };
    gaps.push({
      from: prev.id,
      to: cur.id,
      gapMin: (new Date(cur.startsAt).getTime() - new Date(prev.endsAt).getTime()) / 60000,
    });
  }
  return { ...it, items: enriched, conflicts, totalMin, gaps };
}

router.get("/", async (req: AuthedRequest, res, next) => {
  try {
    const rows = await prisma.itinerary.findMany({
      where: { userId: req.user!.id },
      include: { items: { include: { event: { include: { venue: true } } } } },
      orderBy: { createdAt: "desc" },
    });
    res.json(rows.map(serialize));
  } catch (e) {
    next(e);
  }
});

router.post("/", async (req: AuthedRequest, res, next) => {
  try {
    const { name } = z.object({ name: z.string().min(1).max(120) }).parse(req.body);
    const it = await prisma.itinerary.create({
      data: { userId: req.user!.id, name },
      include: { items: { include: { event: { include: { venue: true } } } } },
    });
    res.status(201).json(serialize(it));
  } catch (e) {
    next(e);
  }
});

async function ownOr404(itineraryId: string, userId: string) {
  const it = await prisma.itinerary.findUnique({
    where: { id: itineraryId },
    include: { items: { include: { event: { include: { venue: true } } } } },
  });
  if (!it || it.userId !== userId) return null;
  return it;
}

router.get("/:id", async (req: AuthedRequest, res, next) => {
  try {
    const it = await ownOr404(req.params.id, req.user!.id);
    if (!it) return res.status(404).json({ error: "Itinerary not found" });
    res.json(serialize(it));
  } catch (e) {
    next(e);
  }
});

router.put("/:id", async (req: AuthedRequest, res, next) => {
  try {
    const it = await ownOr404(req.params.id, req.user!.id);
    if (!it) return res.status(404).json({ error: "Itinerary not found" });
    const { name, order } = z
      .object({ name: z.string().min(1).max(120).optional(), order: z.array(z.string()).optional() })
      .parse(req.body);
    if (name) await prisma.itinerary.update({ where: { id: it.id }, data: { name } });
    if (order) {
      // Reorder items to match event id sequence (drag-and-drop)
      for (let i = 0; i < order.length; i++) {
        await prisma.itineraryItem
          .updateMany({ where: { itineraryId: it.id, eventId: order[i] }, data: { order: i } })
          .catch(() => null);
      }
    }
    const updated = await ownOr404(it.id, req.user!.id);
    res.json(serialize(updated!));
  } catch (e) {
    next(e);
  }
});

router.delete("/:id", async (req: AuthedRequest, res, next) => {
  try {
    const it = await ownOr404(req.params.id, req.user!.id);
    if (!it) return res.status(404).json({ error: "Itinerary not found" });
    await prisma.itinerary.delete({ where: { id: it.id } });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

router.post("/:id/events", async (req: AuthedRequest, res, next) => {
  try {
    const it = await ownOr404(req.params.id, req.user!.id);
    if (!it) return res.status(404).json({ error: "Itinerary not found" });
    const { eventId } = z.object({ eventId: z.string().min(1) }).parse(req.body);
    const ev = await prisma.event.findUnique({ where: { id: eventId } });
    if (!ev) return res.status(404).json({ error: "Event not found" });
    const maxOrder = it.items.reduce((m, i) => Math.max(m, i.order), -1);
    await prisma.itineraryItem.upsert({
      where: { itineraryId_eventId: { itineraryId: it.id, eventId } },
      create: { itineraryId: it.id, eventId, order: maxOrder + 1 },
      update: {},
    });
    const updated = await ownOr404(it.id, req.user!.id);
    res.status(201).json(serialize(updated!));
  } catch (e) {
    next(e);
  }
});

router.delete("/:id/events/:eventId", async (req: AuthedRequest, res, next) => {
  try {
    const it = await ownOr404(req.params.id, req.user!.id);
    if (!it) return res.status(404).json({ error: "Itinerary not found" });
    await prisma.itineraryItem
      .delete({ where: { itineraryId_eventId: { itineraryId: it.id, eventId: req.params.eventId } } })
      .catch(() => null);
    const updated = await ownOr404(it.id, req.user!.id);
    res.json(serialize(updated!));
  } catch (e) {
    next(e);
  }
});

router.get("/:id/export.ics", async (req: AuthedRequest, res, next) => {
  try {
    const it = await ownOr404(req.params.id, req.user!.id);
    if (!it) return res.status(404).json({ error: "Itinerary not found" });
    const icsText = await buildIcs(
      it.name,
      it.items.map((i) => ({
        title: i.event.title,
        description: i.event.description,
        location: i.event.venueId,
        start: new Date(i.event.startsAt),
        end: new Date(i.event.endsAt),
      })),
    );
    res.setHeader("Content-Type", "text/calendar");
    res.setHeader("Content-Disposition", `attachment; filename="${it.name.replace(/\W+/g, "-")}.ics"`);
    res.send(icsText);
  } catch (e) {
    next(e);
  }
});

export default router;
