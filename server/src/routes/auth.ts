import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { signAccess, signRefresh, verifyRefresh } from "../lib/jwt.js";
import { validateBody } from "../middleware/validate.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";

const router = Router();

const registerSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  role: z.enum(["ATTENDEE", "ORGANISER", "ADMIN"]).optional(),
  interests: z.array(z.string()).optional(),
  favoriteCategories: z.array(z.string()).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function sha256(s: string): string {
  return crypto.createHash("sha256").update(s).digest("hex");
}

function refreshExpiry(): Date {
  return new Date(Date.now() + 7 * 24 * 3600 * 1000);
}

router.post("/register", validateBody(registerSchema), async (req, res, next) => {
  try {
    const { name, email, password, role, interests, favoriteCategories } = req.body as z.infer<
      typeof registerSchema
    >;
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: "Email already registered" });
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: role ?? "ATTENDEE",
        interests: JSON.stringify(interests ?? []),
        favoriteCategories: JSON.stringify(favoriteCategories ?? []),
      },
    });
    const accessToken = signAccess({ sub: user.id, email: user.email, role: user.role });
    const refreshToken = signRefresh({ sub: user.id });
    await prisma.refreshToken.create({
      data: { userId: user.id, tokenHash: sha256(refreshToken), expiresAt: refreshExpiry() },
    });
    res.status(201).json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      accessToken,
      refreshToken,
    });
  } catch (e) {
    next(e);
  }
});

router.post("/login", validateBody(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body as z.infer<typeof loginSchema>;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ error: "Invalid credentials" });
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });
    const accessToken = signAccess({ sub: user.id, email: user.email, role: user.role });
    const refreshToken = signRefresh({ sub: user.id });
    await prisma.refreshToken.create({
      data: { userId: user.id, tokenHash: sha256(refreshToken), expiresAt: refreshExpiry() },
    });
    res.json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      accessToken,
      refreshToken,
    });
  } catch (e) {
    next(e);
  }
});

router.post("/refresh", async (req, res, next) => {
  try {
    const { refreshToken } = req.body as { refreshToken?: string };
    if (!refreshToken) return res.status(400).json({ error: "refreshToken required" });
    let sub: string;
    try {
      sub = verifyRefresh(refreshToken).sub;
    } catch {
      return res.status(401).json({ error: "Invalid refresh token" });
    }
    const stored = await prisma.refreshToken.findUnique({ where: { tokenHash: sha256(refreshToken) } });
    if (!stored || stored.expiresAt < new Date() || stored.userId !== sub) {
      return res.status(401).json({ error: "Refresh token expired or revoked" });
    }
    const user = await prisma.user.findUnique({ where: { id: sub } });
    if (!user) return res.status(401).json({ error: "User not found" });
    // Rotate
    await prisma.refreshToken.delete({ where: { tokenHash: sha256(refreshToken) } });
    const accessToken = signAccess({ sub: user.id, email: user.email, role: user.role });
    const nextRefresh = signRefresh({ sub: user.id });
    await prisma.refreshToken.create({
      data: { userId: user.id, tokenHash: sha256(nextRefresh), expiresAt: refreshExpiry() },
    });
    res.json({ accessToken, refreshToken: nextRefresh });
  } catch (e) {
    next(e);
  }
});

router.post("/logout", async (req, res, next) => {
  try {
    const { refreshToken } = req.body as { refreshToken?: string };
    if (refreshToken) {
      await prisma.refreshToken.delete({ where: { tokenHash: sha256(refreshToken) } }).catch(() => null);
    }
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

router.get("/me", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) return res.status(404).json({ error: "Not found" });
    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      interests: JSON.parse(user.interests),
      favoriteCategories: JSON.parse(user.favoriteCategories),
    });
  } catch (e) {
    next(e);
  }
});

export default router;
