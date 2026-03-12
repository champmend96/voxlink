import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import { generateTestToken } from "../helpers/setup";
import { testUsers, testConversations, testMessages } from "../fixtures";

async function createApp() {
  const { default: messageRoutes } = await import("../../routes/messages");
  const app = express();
  app.use(express.json());
  app.use("/api/messages", messageRoutes);
  return app;
}

describe("Messages Routes", () => {
  let app: express.Express;
  let db: any;
  const aliceToken = generateTestToken(testUsers.alice.id, testUsers.alice.username);
  const charlieToken = generateTestToken(testUsers.charlie.id, testUsers.charlie.username);

  beforeEach(async () => {
    app = await createApp();
    const dbModule = await import("../../db");
    db = dbModule.db;
  });

  // ── GET /api/messages/:conversationId ──

  describe("GET /api/messages/:conversationId", () => {
    it("should get messages with pagination", async () => {
      db.query.conversationParticipants.findFirst.mockResolvedValue({
        conversationId: testConversations.aliceBob.id,
        userId: testUsers.alice.id,
      });

      const messagesWithSender = testMessages.slice(0, 2).map((m) => ({
        ...m,
        sender: { id: m.senderId, username: "alice", displayName: "Alice", avatarUrl: null },
      }));

      db.query.messages.findMany.mockResolvedValue(messagesWithSender);

      const res = await request(app)
        .get(`/api/messages/${testConversations.aliceBob.id}`)
        .set("Authorization", `Bearer ${aliceToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("messages");
      expect(res.body).toHaveProperty("hasMore");
      expect(res.body).toHaveProperty("nextCursor");
      expect(Array.isArray(res.body.messages)).toBe(true);
    });

    it("should return 403 for non-participant", async () => {
      db.query.conversationParticipants.findFirst.mockResolvedValue(null);

      const res = await request(app)
        .get(`/api/messages/${testConversations.aliceBob.id}`)
        .set("Authorization", `Bearer ${charlieToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/not a participant/i);
    });

    it("should support cursor-based pagination", async () => {
      db.query.conversationParticipants.findFirst.mockResolvedValue({
        conversationId: testConversations.aliceBob.id,
        userId: testUsers.alice.id,
      });
      db.query.messages.findMany.mockResolvedValue([]);

      const cursor = new Date().toISOString();
      const res = await request(app)
        .get(`/api/messages/${testConversations.aliceBob.id}?cursor=${cursor}&limit=20`)
        .set("Authorization", `Bearer ${aliceToken}`);

      expect(res.status).toBe(200);
      expect(res.body.hasMore).toBe(false);
    });

    it("should limit results to max 100", async () => {
      db.query.conversationParticipants.findFirst.mockResolvedValue({
        conversationId: testConversations.aliceBob.id,
        userId: testUsers.alice.id,
      });
      db.query.messages.findMany.mockResolvedValue([]);

      const res = await request(app)
        .get(`/api/messages/${testConversations.aliceBob.id}?limit=500`)
        .set("Authorization", `Bearer ${aliceToken}`);

      expect(res.status).toBe(200);
      // The route caps limit at 100
    });

    it("should include file message metadata", async () => {
      db.query.conversationParticipants.findFirst.mockResolvedValue({
        conversationId: testConversations.aliceBob.id,
        userId: testUsers.alice.id,
      });

      const fileMessage = {
        ...testMessages[2],
        sender: { id: testUsers.alice.id, username: "alice", displayName: "Alice", avatarUrl: null },
      };
      db.query.messages.findMany.mockResolvedValue([fileMessage]);

      const res = await request(app)
        .get(`/api/messages/${testConversations.aliceBob.id}`)
        .set("Authorization", `Bearer ${aliceToken}`);

      expect(res.status).toBe(200);
      const content = JSON.parse(res.body.messages[0].content);
      expect(content.type).toBe("file");
      expect(content.filename).toBe("photo.jpg");
      expect(content).toHaveProperty("downloadUrl");
    });

    it("should return empty messages for conversation with no messages", async () => {
      db.query.conversationParticipants.findFirst.mockResolvedValue({
        conversationId: testConversations.aliceBob.id,
        userId: testUsers.alice.id,
      });
      db.query.messages.findMany.mockResolvedValue([]);

      const res = await request(app)
        .get(`/api/messages/${testConversations.aliceBob.id}`)
        .set("Authorization", `Bearer ${aliceToken}`);

      expect(res.status).toBe(200);
      expect(res.body.messages).toHaveLength(0);
      expect(res.body.hasMore).toBe(false);
    });
  });
});
