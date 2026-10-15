import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRole, type AuthedRequest } from "../middleware/auth.js";
import { emitCrowd, getIO } from "../lib/socket.js";

const router = Router();

// Latest live density per venue (one round trip for map preload).
router.get("/", async (_req, res, next) => {
  try {
    const venues = await prisma.venue.findMany({ select: { id: true } });
    const rows = await Promise.all(
      venues.map((v) =>
        prisma.crowdSample.findFirst({ where: { venueId: v.id }, orderBy: { ts: "desc" } }),
      ),
    );
    res.json(
      rows
        .filter((s) => s !== null)
        .map((s) => ({ venueId: s!.venueId, density: s!.density, ts: s!.ts })),
    );
  } catch (e) {
    next(e);
  }
});

router.get("/venue/:venueId", async (req, res, next) => {
  try {
    const samples = await prisma.crowdSample.findMany({
      where: { venueId: req.params.venueId },
      orderBy: { ts: "desc" },
      take: 50,
    });
    const latest = samples[0] ?? null;
    res.json({ venueId: req.params.venueId, density: latest?.density ?? 0, samples });
  } catch (e) {
    next(e);
  }
});

router.post("/", requireAuth, requireRole("ORGANISER", "ADMIN"), async (req: AuthedRequest, res, next) => {
  try {
    const { venueId, eventId, density } = z
      .object({ venueId: z.string(), eventId: z.string().optional(), density: z.number().min(0).max(1) })
      .parse(req.body);
    const sample = await prisma.crowdSample.create({ data: { venueId, eventId, density } });
    const io = getIO(req);
    if (io) emitCrowd(io, venueId, { venueId, density, ts: sample.ts });
    res.status(201).json(sample);
  } catch (e) {
    next(e);
  }
});

export default router;
