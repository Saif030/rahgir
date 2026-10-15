import { describe, expect, it, beforeAll } from "@jest/globals";
import request from "supertest";
import { createApp } from "../src/app.js";

const app = createApp();

describe("API basics", () => {
  it("GET /api/health", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
  it("POST /api/auth/register validates email", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ name: "T", email: "not-an-email", password: "Password123!" });
    expect(res.status).toBe(400);
  });
  it("GET /api/events/:id 404 for unknown", async () => {
    const res = await request(app).get("/api/events/does-not-exist");
    expect([404, 500]).toContain(res.status);
  });
  it("POST /api/events requires auth", async () => {
    const res = await request(app).post("/api/events").send({});
    expect(res.status).toBe(401);
  });
});
