import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import { generateTestToken } from "../helpers/setup";
import { testUsers } from "../fixtures";

async function createApp() {
  const { default: keyRoutes } = await import("../../routes/keys");
  const app = express();
  app.use(express.json());
  app.use("/api/keys", keyRoutes);
  return app;
}

describe("Encryption Keys Routes", () => {
  let app: express.Express;
  let db: any;
  const aliceToken = generateTestToken(testUsers.alice.id, testUsers.alice.username);

  beforeEach(async () => {
    app = await createApp();
    const dbModule = await import("../../db");
    db = dbModule.db;
  });

  // ── POST /api/keys (get public keys) ──

  describe("POST /api/keys", () => {
    it("should get public keys for user IDs", async () => {
      db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            { id: testUsers.alice.id, publicKey: "base64-key-alice" },
            { id: testUsers.bob.id, publicKey: "base64-key-bob" },
          ]),
        }),
      });

      const res = await request(app)
        .post("/api/keys")
        .set("Authorization", `Bearer ${aliceToken}`)
        .send({ userIds: [testUsers.alice.id, testUsers.bob.id] });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("keys");
      expect(res.body.keys[testUsers.alice.id]).toBe("base64-key-alice");
      expect(res.body.keys[testUsers.bob.id]).toBe("base64-key-bob");
    });

    it("should return null for users without public keys", async () => {
      db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            { id: testUsers.charlie.id, publicKey: null },
          ]),
        }),
      });

      const res = await request(app)
        .post("/api/keys")
        .set("Authorization", `Bearer ${aliceToken}`)
        .send({ userIds: [testUsers.charlie.id] });

      expect(res.status).toBe(200);
      expect(res.body.keys[testUsers.charlie.id]).toBeNull();
    });

    it("should fail with invalid userIds format (400)", async () => {
      const res = await request(app)
        .post("/api/keys")
        .set("Authorization", `Bearer ${aliceToken}`)
        .send({ userIds: ["not-a-uuid"] });

      expect(res.status).toBe(400);
    });

    it("should fail with empty userIds array (400)", async () => {
      const res = await request(app)
        .post("/api/keys")
        .set("Authorization", `Bearer ${aliceToken}`)
        .send({ userIds: [] });

      expect(res.status).toBe(400);
    });

    it("should fail without auth (401)", async () => {
      const res = await request(app)
        .post("/api/keys")
        .send({ userIds: [testUsers.alice.id] });

      expect(res.status).toBe(401);
    });
  });

  // ── PUT /api/keys/me ──

  describe("PUT /api/keys/me", () => {
    it("should register/update own public key", async () => {
      db.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      const res = await request(app)
        .put("/api/keys/me")
        .set("Authorization", `Bearer ${aliceToken}`)
        .send({ publicKey: "new-base64-encoded-key" });

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/updated/i);
    });

    it("should fail with empty public key (400)", async () => {
      const res = await request(app)
        .put("/api/keys/me")
        .set("Authorization", `Bearer ${aliceToken}`)
        .send({ publicKey: "" });

      expect(res.status).toBe(400);
    });

    it("should fail without auth (401)", async () => {
      const res = await request(app)
        .put("/api/keys/me")
        .send({ publicKey: "some-key" });

      expect(res.status).toBe(401);
    });
  });
});
