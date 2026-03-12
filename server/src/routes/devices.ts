import { Router, Request, Response } from "express";
import { eq, and } from "drizzle-orm";
import { db } from "../db";
import { deviceTokens } from "../db/schema";
import { authenticate } from "../middleware/auth";
import { z } from "zod";

const router = Router();

router.use(authenticate);

const registerTokenSchema = z.object({
  token: z.string().min(1).max(500),
  platform: z.enum(["ios", "android"]),
});

router.post("/register", async (req: Request, res: Response) => {
  try {
    const { token, platform } = registerTokenSchema.parse(req.body);
    const userId = req.user!.userId;

    // Upsert: delete existing token first, then insert
    await db
      .delete(deviceTokens)
      .where(
        and(eq(deviceTokens.userId, userId), eq(deviceTokens.token, token))
      );

    await db.insert(deviceTokens).values({ userId, token, platform });

    res.status(201).json({ message: "Device token registered" });
  } catch (err: any) {
    if (err.name === "ZodError") {
      res.status(400).json({ error: "Validation failed", details: err.errors });
      return;
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/unregister", async (req: Request, res: Response) => {
  try {
    const { token } = z.object({ token: z.string() }).parse(req.body);
    const userId = req.user!.userId;

    await db
      .delete(deviceTokens)
      .where(
        and(eq(deviceTokens.userId, userId), eq(deviceTokens.token, token))
      );

    res.json({ message: "Device token removed" });
  } catch (err: any) {
    if (err.name === "ZodError") {
      res.status(400).json({ error: "Validation failed", details: err.errors });
      return;
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
