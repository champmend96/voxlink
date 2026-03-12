import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import { generateTestToken } from "../helpers/setup";
import { testUsers } from "../fixtures";

async function createApp() {
  const { default: deviceRoutes } = await import("../../routes/devices");
  const app = express();
  app.use(express.json());
  app.use("/api/devices", deviceRoutes);
  return app;
}

describe("Devices Routes", () => {
  let app: express.Express;
  let db: any;
  const aliceToken = generateTestToken(testUsers.alice.id, testUsers.alice.username);

  beforeEach(async () => {
    app = await createApp();
    const dbModule = await import("../../db");
    db = dbModule.db;
  });

  // ── POST /api/devices/register ──

  describe("POST /api/devices/register", () => {
    it("should register a device token", async () => {
      db.delete.mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      });
      db.insert.mockReturnValue({
        values: vi.fn().mockResolvedValue([]),
      });

      const res = await request(app)
        .post("/api/devices/register")
        .set("Authorization", `Bearer ${aliceToken}`)
        .send({ token: "expo-push-token-abc123", platform: "ios" });

      expect(res.status).toBe(201);
      expect(res.body.message).toMatch(/registered/i);
    });

    it("should register an Android device token", async () => {
      db.delete.mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      });
      db.insert.mockReturnValue({
        values: vi.fn().mockResolvedValue([]),
      });

      const res = await request(app)
        .post("/api/devices/register")
        .set("Authorization", `Bearer ${aliceToken}`)
        .send({ token: "fcm-token-xyz789", platform: "android" });

      expect(res.status).toBe(201);
    });

    it("should handle duplicate token registration (upsert)", async () => {
      // The route deletes existing, then inserts — deduplication behavior
      const mockDelete = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      });
      db.delete.mockImplementation(mockDelete);
      db.insert.mockReturnValue({
        values: vi.fn().mockResolvedValue([]),
      });

      const res = await request(app)
        .post("/api/devices/register")
        .set("Authorization", `Bearer ${aliceToken}`)
        .send({ token: "existing-token", platform: "ios" });

      expect(res.status).toBe(201);
      expect(db.delete).toHaveBeenCalled();
    });

    it("should fail with invalid platform", async () => {
      const res = await request(app)
        .post("/api/devices/register")
        .set("Authorization", `Bearer ${aliceToken}`)
        .send({ token: "some-token", platform: "windows" });

      expect(res.status).toBe(400);
    });

    it("should fail with missing token", async () => {
      const res = await request(app)
        .post("/api/devices/register")
        .set("Authorization", `Bearer ${aliceToken}`)
        .send({ platform: "ios" });

      expect(res.status).toBe(400);
    });

    it("should fail without auth (401)", async () => {
      const res = await request(app)
        .post("/api/devices/register")
        .send({ token: "token", platform: "ios" });

      expect(res.status).toBe(401);
    });
  });

  // ── DELETE /api/devices/unregister ──

  describe("DELETE /api/devices/unregister", () => {
    it("should unregister a device token", async () => {
      db.delete.mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      });

      const res = await request(app)
        .delete("/api/devices/unregister")
        .set("Authorization", `Bearer ${aliceToken}`)
        .send({ token: "expo-push-token-abc123" });

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/removed/i);
    });

    it("should fail without auth (401)", async () => {
      const res = await request(app)
        .delete("/api/devices/unregister")
        .send({ token: "some-token" });

      expect(res.status).toBe(401);
    });

    it("should fail with missing token (400)", async () => {
      const res = await request(app)
        .delete("/api/devices/unregister")
        .set("Authorization", `Bearer ${aliceToken}`)
        .send({});

      expect(res.status).toBe(400);
    });
  });
});
