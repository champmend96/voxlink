import { Router, Request, Response } from "express";
import { eq, desc, and, lt } from "drizzle-orm";
import { db } from "../db";
import {
  messages,
  conversationParticipants,
  conversations,
  users,
} from "../db/schema";
import { authenticate } from "../middleware/auth";
import { sendMessageSchema } from "../validators";

const router = Router();

router.use(authenticate);

router.get("/:conversationId", async (req: Request, res: Response) => {
  try {
    const { conversationId } = req.params;
    const cursor = req.query.cursor as string | undefined;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

    const participant = await db.query.conversationParticipants.findFirst({
      where: and(
        eq(conversationParticipants.conversationId, conversationId),
        eq(conversationParticipants.userId, req.user!.userId)
      ),
    });

    if (!participant) {
      res.status(403).json({ error: "Not a participant" });
      return;
    }

    const conditions = [eq(messages.conversationId, conversationId)];
    if (cursor) {
      conditions.push(lt(messages.createdAt, new Date(cursor)));
    }

    const result = await db.query.messages.findMany({
      where: and(...conditions),
      with: {
        sender: {
          columns: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: [desc(messages.createdAt)],
      limit: limit + 1,
    });

    const hasMore = result.length > limit;
    const items = hasMore ? result.slice(0, limit) : result;

    res.json({
      messages: items,
      hasMore,
      nextCursor: hasMore
        ? items[items.length - 1].createdAt.toISOString()
        : null,
    });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
