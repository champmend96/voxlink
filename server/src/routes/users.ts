import { Router, Request, Response } from "express";
import { eq, ilike, and, ne } from "drizzle-orm";
import { db } from "../db";
import { users } from "../db/schema";
import { authenticate } from "../middleware/auth";
import { updateProfileSchema } from "../validators";

const router = Router();

router.use(authenticate);

router.get("/", async (req: Request, res: Response) => {
  try {
    const search = req.query.search as string | undefined;
    const conditions = [ne(users.id, req.user!.userId)];
    if (search) {
      conditions.push(ilike(users.username, `%${search}%`));
    }

    const result = await db.query.users.findMany({
      where: and(...conditions),
      columns: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        lastSeen: true,
      },
      limit: 50,
    });

    res.json(result);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/profile", async (req: Request, res: Response) => {
  try {
    const body = updateProfileSchema.parse(req.body);

    const [updated] = await db
      .update(users)
      .set(body)
      .where(eq(users.id, req.user!.userId))
      .returning({
        id: users.id,
        username: users.username,
        email: users.email,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
      });

    res.json(updated);
  } catch (err: any) {
    if (err.name === "ZodError") {
      res.status(400).json({ error: "Validation failed", details: err.errors });
      return;
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
