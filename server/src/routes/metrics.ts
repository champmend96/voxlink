import { Router, Request, Response } from "express";
import { db } from "../db";
import { users } from "../db/schema";
import { sql } from "drizzle-orm";

const router = Router();

let wsConnectionCount = 0;
let activeCallsCount = 0;

export function setWsConnectionCount(count: number): void {
  wsConnectionCount = count;
}

export function setActiveCallsCount(count: number): void {
  activeCallsCount = count;
}

router.get("/health", async (_req: Request, res: Response) => {
  try {
    // Test DB connectivity
    await db.select({ count: sql<number>`1` }).from(users).limit(1);

    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: {
        rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
        heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      },
      db: "connected",
    });
  } catch {
    res.status(503).json({
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      db: "disconnected",
    });
  }
});

router.get("/metrics", (_req: Request, res: Response) => {
  res.json({
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    websocket: {
      connections: wsConnectionCount,
    },
    calls: {
      active: activeCallsCount,
    },
  });
});

export default router;
