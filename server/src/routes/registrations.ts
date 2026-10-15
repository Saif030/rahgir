import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";

const router = Router();

// One-click registration: profile fields prefilled from user; only documents needed.
// POST /api/registrations/:eventId { documents?: string[] }
router.post("/:eventId", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const event = await prisma.event.findUnique({ where: { id: req.params.eventId } });
    if (!event) return res.status(404).json({ error: "Event not found" });
    if (event.status === "CANCELLED") return res.status(400).json({ error: "Event is cancelled" });
    if (event.registeredCount >= event.capacity)
      return res.status(409).json({ error: "Event is full" });
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    const documents = (req.body as { documents?: string[] }).documents ?? [];
    const reg = await prisma.registration.upsert({
      where: { eventId_userId: { eventId: event.id, userId: req.user!.id } },
      create: {
        eventId: event.id,
        userId: req.user!.id,
        documentsUrl: JSON.stringify(documents),
        autoFilled: JSON.stringify({ name: user?.name, email: user?.email }),
      },
      update: { documentsUrl: JSON.stringify(documents) },
      include: { event: true },
    });
    await prisma.event.update({
      where: { id: event.id },
      data: { registeredCount: { increment: 0 } }, // keep count consistent via aggregate below
    });
    const count = await prisma.registration.count({ where: { eventId: event.id } });
    await prisma.event.update({ where: { id: event.id }, data: { registeredCount: count } });
    res.status(201).json(reg);
  } catch (e) {
    next(e);
  }
});

// Organiser broadcast stub: logs mail/WhatsApp recipients (wire SMTP/Twilio in prod)
router.post("/:eventId/broadcast", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    if (req.user!.role !== "ORGANISER" && req.user!.role !== "ADMIN")
      return res.status(403).json({ error: "Forbidden" });
    const { message } = req.body as { message?: string };
    if (!message) return res.status(400).json({ error: "message required" });
    const regs = await prisma.registration.findMany({
      where: { eventId: req.params.eventId },
      include: { user: true },
    });
    const recipients = regs.map((r) => r.user.email);
    console.log(`[broadcast] event=${req.params.eventId} to=${recipients.length}: ${message}`);
    // TODO: Nodemailer SMTP + Twilio WhatsApp integration via env.
    res.json({ ok: true, recipients: recipients.length, provider: process.env.WHATSAPP_PROVIDER ?? "stub" });
  } catch (e) {
    next(e);
  }
});

export default router;
