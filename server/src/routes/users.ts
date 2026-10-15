import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

router.get("/profile", async (req: AuthedRequest, res, next) => {
  try {
    const u = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!u) return res.status(404).json({ error: "Not found" });
    res.json({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      interests: JSON.parse(u.interests),
      favoriteCategories: JSON.parse(u.favoriteCategories),
    });
  } catch (e) {
    next(e);
  }
});

router.put("/profile", async (req: AuthedRequest, res, next) => {
  try {
    const { name, interests, favoriteCategories } = z
      .object({
        name: z.string().min(1).max(120).optional(),
        interests: z.array(z.string()).optional(),
        favoriteCategories: z.array(z.string()).optional(),
      })
      .parse(req.body);
    const u = await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        ...(name ? { name } : {}),
        ...(interests ? { interests: JSON.stringify(interests) } : {}),
        ...(favoriteCategories ? { favoriteCategories: JSON.stringify(favoriteCategories) } : {}),
      },
    });
    res.json({ id: u.id, name: u.name, email: u.email, role: u.role });
  } catch (e) {
    next(e);
  }
});

// Attendance history = past registrations
router.get("/history", async (req: AuthedRequest, res, next) => {
  try {
    const regs = await prisma.registration.findMany({
      where: { userId: req.user!.id },
      include: { event: { include: { venue: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json(regs);
  } catch (e) {
    next(e);
  }
});

export default router;
