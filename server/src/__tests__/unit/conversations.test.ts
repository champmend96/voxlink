import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import { generateTestToken } from "../helpers/setup";
import { testUsers, testConversations } from "../fixtures";

async function createApp() {
  const { default: convRoutes } = await import("../../routes/conversations");
  const app = express();
  app.use(express.json());
  app.use("/api/conversations", convRoutes);
  return app;
}

describe("Conversations Routes", () => {
  let app: express.Express;
  let db: any;
  const aliceToken = generateTestToken(testUsers.alice.id, testUsers.alice.username);
  const charlieToken = generateTestToken(testUsers.charlie.id, testUsers.charlie.username);

  beforeEach(async () => {
    app = await createApp();
    const dbModule = await import("../../db");
    db = dbModule.db;
  });

  // ── POST /api/conversations ──

  describe("POST /api/conversations", () => {
    it("should create a 1:1 conversation", async () => {
      const conv = {
        id: crypto.randomUUID(),
        name: null,
        isGroup: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      db.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([conv]),
        }),
      });

      db.query.conversations.findFirst.mockResolvedValue({
        ...conv,
        participants: [
          { userId: testUsers.alice.id, user: { id: testUsers.alice.id, username: "alice", displayName: "Alice", avatarUrl: null, lastSeen: new Date() } },
          { userId: testUsers.bob.id, user: { id: testUsers.bob.id, username: "bob", displayName: "Bob", avatarUrl: null, lastSeen: new Date() } },
        ],
      });

      const res = await request(app)
        .post("/api/conversations")
        .set("Authorization", `Bearer ${aliceToken}`)
        .send({ participantIds: [testUsers.bob.id] });

      expect(res.status).toBe(201);
      expect(res.body.participants).toHaveLength(2);
    });

    it("should create a group conversation", async () => {
      const conv = {
        id: crypto.randomUUID(),
        name: "Team Chat",
        isGroup: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      db.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([conv]),
        }),
      });

      db.query.conversations.findFirst.mockResolvedValue({
        ...conv,
        participants: [
          { userId: testUsers.alice.id, user: { id: testUsers.alice.id, username: "alice", displayName: "Alice", avatarUrl: null, lastSeen: new Date() } },
          { userId: testUsers.bob.id, user: { id: testUsers.bob.id, username: "bob", displayName: "Bob", avatarUrl: null, lastSeen: new Date() } },
          { userId: testUsers.charlie.id, user: { id: testUsers.charlie.id, username: "charlie", displayName: "Charlie", avatarUrl: null, lastSeen: new Date() } },
        ],
      });

      const res = await request(app)
        .post("/api/conversations")
        .set("Authorization", `Bearer ${aliceToken}`)
        .send({
          participantIds: [testUsers.bob.id, testUsers.charlie.id],
          name: "Team Chat",
          isGroup: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.isGroup).toBe(true);
      expect(res.body.name).toBe("Team Chat");
    });

    it("should fail without auth (401)", async () => {
      const res = await request(app)
        .post("/api/conversations")
        .send({ participantIds: [testUsers.bob.id] });

      expect(res.status).toBe(401);
    });

    it("should fail with empty participantIds (400)", async () => {
      const res = await request(app)
        .post("/api/conversations")
        .set("Authorization", `Bearer ${aliceToken}`)
        .send({ participantIds: [] });

      expect(res.status).toBe(400);
    });
  });

  // ── GET /api/conversations ──

  describe("GET /api/conversations", () => {
    it("should list user conversations", async () => {
      db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            { conversationId: testConversations.aliceBob.id },
          ]),
        }),
      });

      db.query.conversations.findFirst.mockResolvedValue({
        ...testConversations.aliceBob,
        participants: [
          { userId: testUsers.alice.id, user: { id: testUsers.alice.id, username: "alice", displayName: "Alice", avatarUrl: null, lastSeen: new Date() } },
          { userId: testUsers.bob.id, user: { id: testUsers.bob.id, username: "bob", displayName: "Bob", avatarUrl: null, lastSeen: new Date() } },
        ],
        messages: [],
      });

      const res = await request(app)
        .get("/api/conversations")
        .set("Authorization", `Bearer ${aliceToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it("should return empty array when user has no conversations", async () => {
      db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      const res = await request(app)
        .get("/api/conversations")
        .set("Authorization", `Bearer ${charlieToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  // ── GET /api/conversations/:id ──

  describe("GET /api/conversations/:id", () => {
    it("should get conversation details for a participant", async () => {
      db.query.conversations.findFirst.mockResolvedValue({
        ...testConversations.aliceBob,
        participants: [
          { userId: testUsers.alice.id, user: { id: testUsers.alice.id, username: "alice", displayName: "Alice", avatarUrl: null, lastSeen: new Date() } },
          { userId: testUsers.bob.id, user: { id: testUsers.bob.id, username: "bob", displayName: "Bob", avatarUrl: null, lastSeen: new Date() } },
        ],
      });

      const res = await request(app)
        .get(`/api/conversations/${testConversations.aliceBob.id}`)
        .set("Authorization", `Bearer ${aliceToken}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(testConversations.aliceBob.id);
    });

    it("should return 404 for non-existent conversation", async () => {
      db.query.conversations.findFirst.mockResolvedValue(null);

      const res = await request(app)
        .get(`/api/conversations/${crypto.randomUUID()}`)
        .set("Authorization", `Bearer ${aliceToken}`);

      expect(res.status).toBe(404);
    });

    it("should return 403 when user is not a participant", async () => {
      db.query.conversations.findFirst.mockResolvedValue({
        ...testConversations.aliceBob,
        participants: [
          { userId: testUsers.alice.id, user: { id: testUsers.alice.id } },
          { userId: testUsers.bob.id, user: { id: testUsers.bob.id } },
        ],
      });

      const res = await request(app)
        .get(`/api/conversations/${testConversations.aliceBob.id}`)
        .set("Authorization", `Bearer ${charlieToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/not a participant/i);
    });
  });
});
