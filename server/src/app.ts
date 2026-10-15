import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import swaggerUi from "swagger-ui-express";
import YAML from "yaml";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import authRoutes from "./routes/auth.js";
import eventRoutes from "./routes/events.js";
import venueRoutes from "./routes/venues.js";
import itineraryRoutes from "./routes/itineraries.js";
import routeRoutes from "./routes/routes.js";
import crowdRoutes from "./routes/crowd.js";
import userRoutes from "./routes/users.js";
import registrationRoutes from "./routes/registrations.js";
import { errorHandler, notFound } from "./middleware/errorHandler.js";

export const allowedOrigins = (process.env.CLIENT_ORIGIN ?? "http://localhost:5173")
  .split(",")
  .map((s) => s.trim());

export function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true; // curl / same-origin / mobile
  if (allowedOrigins.includes(origin)) return true;
  // Dev convenience: any localhost port (vite preview, device testing, etc.)
  if (process.env.NODE_ENV !== "production" && /^http:\/\/localhost:\d+$/.test(origin)) return true;
  return false;
}
export function createApp() {
  const app = express();
  app.use(helmet());
  app.use(
    cors({
      origin: (origin, cb) => (isAllowedOrigin(origin) ? cb(null, true) : cb(new Error("CORS blocked"))),
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(morgan("dev"));
  app.use("/api/auth", rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));

  app.get("/api/health", (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

  app.use("/api/auth", authRoutes);
  app.use("/api/events", eventRoutes);
  app.use("/api/venues", venueRoutes);
  app.use("/api/itineraries", itineraryRoutes);
  app.use("/api/routes", routeRoutes);
  app.use("/api/crowd", crowdRoutes);
  app.use("/api/users", userRoutes);
  app.use("/api/registrations", registrationRoutes);

  // Swagger docs (best-effort; skipped if yaml missing in test env)
  try {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const doc = YAML.parse(fs.readFileSync(path.join(__dirname, "openapi.yaml"), "utf8"));
    app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(doc));
  } catch {
    app.get("/api-docs", (_req, res) => res.json({ docs: "openapi.yaml not built" }));
  }

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
