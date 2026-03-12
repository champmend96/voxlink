import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import path from "path";
import fs from "fs";
import { generateTestToken } from "../helpers/setup";
import { testUsers, testConversations } from "../fixtures";

// Mock sharp
vi.mock("sharp", () => {
  return {
    default: vi.fn().mockReturnValue({
      resize: vi.fn().mockReturnThis(),
      jpeg: vi.fn().mockReturnThis(),
      toFile: vi.fn().mockResolvedValue(undefined),
    }),
  };
});

// Mock fs for upload directory
vi.mock("fs", async () => {
  const actual = await vi.importActual<typeof fs>("fs");
  return {
    ...actual,
    default: {
      ...actual,
      existsSync: vi.fn().mockReturnValue(true),
      mkdirSync: vi.fn(),
      unlinkSync: vi.fn(),
    },
    existsSync: vi.fn().mockReturnValue(true),
    mkdirSync: vi.fn(),
    unlinkSync: vi.fn(),
  };
});

async function createApp() {
  const { default: uploadRoutes } = await import("../../routes/upload");
  const app = express();
  app.use(express.json());
  app.use("/api/messages", uploadRoutes);
  return app;
}

describe("Upload Routes", () => {
  let app: express.Express;
  let db: any;
  const aliceToken = generateTestToken(testUsers.alice.id, testUsers.alice.username);

  beforeEach(async () => {
    app = await createApp();
    const dbModule = await import("../../db");
    db = dbModule.db;
  });

  describe("POST /api/messages/upload", () => {
    it("should upload image successfully", async () => {
      db.query.conversationParticipants.findFirst.mockResolvedValue({
        conversationId: testConversations.aliceBob.id,
        userId: testUsers.alice.id,
      });

      const messageId = crypto.randomUUID();
      db.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{
            id: messageId,
            conversationId: testConversations.aliceBob.id,
            senderId: testUsers.alice.id,
            content: JSON.stringify({ type: "file", filename: "test.jpg" }),
            readBy: [testUsers.alice.id],
            createdAt: new Date(),
          }]),
        }),
      });

      db.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      db.query.users.findFirst.mockResolvedValue({
        id: testUsers.alice.id,
        username: "alice",
        displayName: "Alice",
        avatarUrl: null,
      });

      const res = await request(app)
        .post("/api/messages/upload")
        .set("Authorization", `Bearer ${aliceToken}`)
        .field("conversationId", testConversations.aliceBob.id)
        .attach("file", Buffer.from("fake-image-data"), {
          filename: "test.jpg",
          contentType: "image/jpeg",
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty("id");
      expect(res.body).toHaveProperty("sender");
    });

    it("should reject upload without file (400)", async () => {
      const res = await request(app)
        .post("/api/messages/upload")
        .set("Authorization", `Bearer ${aliceToken}`)
        .field("conversationId", testConversations.aliceBob.id);

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/no file/i);
    });

    it("should reject upload without conversationId (400)", async () => {
      const res = await request(app)
        .post("/api/messages/upload")
        .set("Authorization", `Bearer ${aliceToken}`)
        .attach("file", Buffer.from("fake-data"), {
          filename: "test.jpg",
          contentType: "image/jpeg",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/conversationId/i);
    });

    it("should reject upload when user is not participant (403)", async () => {
      db.query.conversationParticipants.findFirst.mockResolvedValue(null);

      const res = await request(app)
        .post("/api/messages/upload")
        .set("Authorization", `Bearer ${aliceToken}`)
        .field("conversationId", testConversations.aliceBob.id)
        .attach("file", Buffer.from("fake-data"), {
          filename: "test.pdf",
          contentType: "application/pdf",
        });

      expect(res.status).toBe(403);
    });

    it("should handle file metadata in response", async () => {
      db.query.conversationParticipants.findFirst.mockResolvedValue({
        conversationId: testConversations.aliceBob.id,
        userId: testUsers.alice.id,
      });

      const fileContent = JSON.stringify({
        type: "file",
        filename: "document.pdf",
        mimeType: "application/pdf",
        size: 5000,
        thumbnailUrl: null,
        downloadUrl: "/uploads/abc123.pdf",
      });

      db.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{
            id: crypto.randomUUID(),
            conversationId: testConversations.aliceBob.id,
            senderId: testUsers.alice.id,
            content: fileContent,
            readBy: [testUsers.alice.id],
            createdAt: new Date(),
          }]),
        }),
      });

      db.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      db.query.users.findFirst.mockResolvedValue({
        id: testUsers.alice.id,
        username: "alice",
        displayName: "Alice",
        avatarUrl: null,
      });

      const res = await request(app)
        .post("/api/messages/upload")
        .set("Authorization", `Bearer ${aliceToken}`)
        .field("conversationId", testConversations.aliceBob.id)
        .attach("file", Buffer.from("fake-pdf-data"), {
          filename: "document.pdf",
          contentType: "application/pdf",
        });

      expect(res.status).toBe(201);
      expect(res.body.content).toBeDefined();
    });
  });
});
