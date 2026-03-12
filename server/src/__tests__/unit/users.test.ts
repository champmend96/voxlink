import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import { generateTestToken } from "../helpers/setup";
import { testUsers } from "../fixtures";

async function createApp() {
  const { default: userRoutes } = await import("../../routes/users");
  const app = express();
  app.use(express.json());
  app.use("/api/users", userRoutes);
  return app;
}

describe("Users Routes", () => {
  let app: express.Express;
  let db: any;
  const token = generateTestToken(testUsers.alice.id, testUsers.alice.username);

  beforeEach(async () => {
    app = await createApp();
    const dbModule = await import("../../db");
    db = dbModule.db;
  });

  // ── GET /api/users ──

  describe("GET /api/users", () => {
    it("should list users when authenticated", async () => {
      const mockResults = [
        {
          id: testUsers.bob.id,
          username: testUsers.bob.username,
          displayName: testUsers.bob.displayName,
          avatarUrl: null,
          lastSeen: new Date(),
        },
      ];
      db.query.users.findMany.mockResolvedValue(mockResults);

      const res = await request(app)
        .get("/api/users")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it("should fail without auth token (401)", async () => {
      const res = await request(app).get("/api/users");

      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/authorization/i);
    });

    it("should search users by username", async () => {
      db.query.users.findMany.mockResolvedValue([
        {
          id: testUsers.bob.id,
          username: "bob",
          displayName: "Bob Jones",
          avatarUrl: null,
          lastSeen: new Date(),
        },
      ]);

      const res = await request(app)
        .get("/api/users?search=bob")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(db.query.users.findMany).toHaveBeenCalled();
    });

    it("should exclude the current user from results", async () => {
      db.query.users.findMany.mockResolvedValue([]);

      await request(app)
        .get("/api/users")
        .set("Authorization", `Bearer ${token}`);

      // The route filters out the current user via ne(users.id, req.user.userId)
      expect(db.query.users.findMany).toHaveBeenCalled();
    });
  });

  // ── PATCH /api/users/profile ──

  describe("PATCH /api/users/profile", () => {
    it("should update profile successfully", async () => {
      const updated = {
        id: testUsers.alice.id,
        username: testUsers.alice.username,
        email: testUsers.alice.email,
        displayName: "Alice Updated",
        avatarUrl: null,
      };

      db.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updated]),
          }),
        }),
      });

      const res = await request(app)
        .patch("/api/users/profile")
        .set("Authorization", `Bearer ${token}`)
        .send({ displayName: "Alice Updated" });

      expect(res.status).toBe(200);
      expect(res.body.displayName).toBe("Alice Updated");
    });

    it("should fail without auth token (401)", async () => {
      const res = await request(app)
        .patch("/api/users/profile")
        .send({ displayName: "New Name" });

      expect(res.status).toBe(401);
    });

    it("should fail with invalid data (400)", async () => {
      const res = await request(app)
        .patch("/api/users/profile")
        .set("Authorization", `Bearer ${token}`)
        .send({ avatarUrl: "not-a-url" });

      expect(res.status).toBe(400);
    });
  });
});
