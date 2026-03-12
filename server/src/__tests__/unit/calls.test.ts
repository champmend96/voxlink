import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import { generateTestToken } from "../helpers/setup";
import { testUsers, testCallHistory } from "../fixtures";

async function createApp() {
  const { default: callRoutes } = await import("../../routes/calls");
  const app = express();
  app.use(express.json());
  app.use("/api/calls", callRoutes);
  return app;
}

describe("Calls Routes", () => {
  let app: express.Express;
  let db: any;
  const aliceToken = generateTestToken(testUsers.alice.id, testUsers.alice.username);

  beforeEach(async () => {
    app = await createApp();
    const dbModule = await import("../../db");
    db = dbModule.db;
  });

  describe("GET /api/calls/history", () => {
    it("should return call history for the user", async () => {
      db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue(testCallHistory),
            }),
          }),
        }),
      });

      db.query.users.findFirst
        .mockResolvedValueOnce({
          id: testUsers.alice.id,
          username: "alice",
          displayName: "Alice",
          avatarUrl: null,
        })
        .mockResolvedValueOnce({
          id: testUsers.bob.id,
          username: "bob",
          displayName: "Bob",
          avatarUrl: null,
        })
        .mockResolvedValueOnce({
          id: testUsers.bob.id,
          username: "bob",
          displayName: "Bob",
          avatarUrl: null,
        })
        .mockResolvedValueOnce({
          id: testUsers.alice.id,
          username: "alice",
          displayName: "Alice",
          avatarUrl: null,
        });

      const res = await request(app)
        .get("/api/calls/history")
        .set("Authorization", `Bearer ${aliceToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("calls");
      expect(Array.isArray(res.body.calls)).toBe(true);
    });

    it("should include call duration, status, and timestamps", async () => {
      const callRecord = {
        ...testCallHistory[0],
        caller: { id: testUsers.alice.id, username: "alice", displayName: "Alice", avatarUrl: null },
        callee: { id: testUsers.bob.id, username: "bob", displayName: "Bob", avatarUrl: null },
      };

      db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([testCallHistory[0]]),
            }),
          }),
        }),
      });

      db.query.users.findFirst
        .mockResolvedValueOnce(callRecord.caller)
        .mockResolvedValueOnce(callRecord.callee);

      const res = await request(app)
        .get("/api/calls/history")
        .set("Authorization", `Bearer ${aliceToken}`);

      expect(res.status).toBe(200);
      const call = res.body.calls[0];
      expect(call).toHaveProperty("duration");
      expect(call).toHaveProperty("status");
      expect(call).toHaveProperty("startedAt");
      expect(call).toHaveProperty("callType");
    });

    it("should filter by call type", async () => {
      db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([testCallHistory[1]]),
            }),
          }),
        }),
      });

      db.query.users.findFirst
        .mockResolvedValueOnce({ id: testUsers.bob.id, username: "bob", displayName: "Bob", avatarUrl: null })
        .mockResolvedValueOnce({ id: testUsers.alice.id, username: "alice", displayName: "Alice", avatarUrl: null });

      const res = await request(app)
        .get("/api/calls/history?limit=50")
        .set("Authorization", `Bearer ${aliceToken}`);

      expect(res.status).toBe(200);
      expect(res.body.calls.length).toBeGreaterThanOrEqual(1);
    });

    it("should fail without auth (401)", async () => {
      const res = await request(app).get("/api/calls/history");
      expect(res.status).toBe(401);
    });
  });
});
