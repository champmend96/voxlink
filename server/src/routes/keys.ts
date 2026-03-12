import { Router, Request, Response } from "express";
import { eq, inArray } from "drizzle-orm";
import { db } from "../db";
import { users } from "../db/schema";
import { authenticate } from "../middleware/auth";
import { z } from "zod";

const router = Router();

router.use(authenticate);

// Get public keys for given user IDs
router.post("/", async (req: Request, res: Response) => {
  try {
    const { userIds } = z
      .object({ userIds: z.array(z.string().uuid()).min(1).max(100) })
      .parse(req.body);

    const result = await db
      .select({
        id: users.id,
        publicKey: users.publicKey,
      })
      .from(users)
      .where(inArray(users.id, userIds));

    const keyMap: Record<string, string | null> = {};
    for (const row of result) {
      keyMap[row.id] = row.publicKey;
    }

    res.json({ keys: keyMap });
  } catch (err: any) {
    if (err.name === "ZodError") {
      res.status(400).json({ error: "Validation failed", details: err.errors });
      return;
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update own public key
router.put("/me", async (req: Request, res: Response) => {
  try {
    const { publicKey } = z
      .object({ publicKey: z.string().min(1).max(200) })
      .parse(req.body);

    await db
      .update(users)
      .set({ publicKey })
      .where(eq(users.id, req.user!.userId));

    res.json({ message: "Public key updated" });
  } catch (err: any) {
    if (err.name === "ZodError") {
      res.status(400).json({ error: "Validation failed", details: err.errors });
      return;
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
