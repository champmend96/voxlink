import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";

async function createApp() {
  const metricsModule = await import("../../routes/metrics");
  const app = express();
  app.use(express.json());
  app.use("/api", metricsModule.default);
  return { app, metricsModule };
}

describe("Metrics Routes", () => {
  let app: express.Express;
  let metricsModule: any;
  let db: any;

  beforeEach(async () => {
    const result = await createApp();
    app = result.app;
    metricsModule = result.metricsModule;
    const dbModule = await import("../../db");
    db = dbModule.db;
  });

  // ── GET /api/health ──

  describe("GET /api/health", () => {
    it("should return healthy status with DB connectivity", async () => {
      db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ count: 1 }]),
        }),
      });

      const res = await request(app).get("/api/health");

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("ok");
      expect(res.body).toHaveProperty("timestamp");
      expect(res.body).toHaveProperty("uptime");
      expect(res.body).toHaveProperty("memory");
      expect(res.body.db).toBe("connected");
    });

    it("should return 503 when DB is disconnected", async () => {
      db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          limit: vi.fn().mockRejectedValue(new Error("Connection refused")),
        }),
      });

      const res = await request(app).get("/api/health");

      expect(res.status).toBe(503);
      expect(res.body.status).toBe("unhealthy");
      expect(res.body.db).toBe("disconnected");
    });

    it("should include memory usage statistics", async () => {
      db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ count: 1 }]),
        }),
      });

      const res = await request(app).get("/api/health");

      expect(res.body.memory).toHaveProperty("rss");
      expect(res.body.memory).toHaveProperty("heapUsed");
      expect(res.body.memory).toHaveProperty("heapTotal");
      expect(typeof res.body.memory.rss).toBe("number");
    });
  });

  // ── GET /api/metrics ──

  describe("GET /api/metrics", () => {
    it("should return connection counts and metrics", async () => {
      const res = await request(app).get("/api/metrics");

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("timestamp");
      expect(res.body).toHaveProperty("uptime");
      expect(res.body).toHaveProperty("memory");
      expect(res.body).toHaveProperty("websocket");
      expect(res.body.websocket).toHaveProperty("connections");
      expect(res.body).toHaveProperty("calls");
      expect(res.body.calls).toHaveProperty("active");
    });

    it("should reflect updated WebSocket connection count", async () => {
      metricsModule.setWsConnectionCount(42);
      metricsModule.setActiveCallsCount(3);

      const res = await request(app).get("/api/metrics");

      expect(res.body.websocket.connections).toBe(42);
      expect(res.body.calls.active).toBe(3);

      // Reset
      metricsModule.setWsConnectionCount(0);
      metricsModule.setActiveCallsCount(0);
    });
  });
});
