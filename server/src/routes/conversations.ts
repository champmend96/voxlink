import { Router, Request, Response } from "express";
import { eq, desc, and } from "drizzle-orm";
import { db } from "../db";
import {
  conversations,
  conversationParticipants,
  messages,
  users,
} from "../db/schema";
import { authenticate } from "../middleware/auth";
import { createConversationSchema } from "../validators";

const router = Router();

router.use(authenticate);

router.get("/", async (req: Request, res: Response) => {
  try {
    const userConversations = await db
      .select({
        conversationId: conversationParticipants.conversationId,
      })
      .from(conversationParticipants)
      .where(eq(conversationParticipants.userId, req.user!.userId));

    const ids = userConversations.map((c) => c.conversationId);
    if (ids.length === 0) {
      res.json([]);
      return;
    }

    const results = [];
    for (const id of ids) {
      const conv = await db.query.conversations.findFirst({
        where: eq(conversations.id, id),
        with: {
          participants: {
            with: {
              user: {
                columns: {
                  id: true,
                  username: true,
                  displayName: true,
                  avatarUrl: true,
                  lastSeen: true,
                },
              },
            },
          },
          messages: {
            orderBy: [desc(messages.createdAt)],
            limit: 1,
          },
        },
      });
      if (conv) results.push(conv);
    }

    results.sort((a, b) => {
      const aTime = a.messages[0]?.createdAt?.getTime() ?? a.createdAt.getTime();
      const bTime = b.messages[0]?.createdAt?.getTime() ?? b.createdAt.getTime();
      return bTime - aTime;
    });

    res.json(results);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const body = createConversationSchema.parse(req.body);
    const allParticipants = [...new Set([req.user!.userId, ...body.participantIds])];
    const isGroup = body.isGroup ?? allParticipants.length > 2;

    const [conv] = await db
      .insert(conversations)
      .values({ name: body.name, isGroup })
      .returning();

    await db.insert(conversationParticipants).values(
      allParticipants.map((userId) => ({
        conversationId: conv.id,
        userId,
      }))
    );

    const full = await db.query.conversations.findFirst({
      where: eq(conversations.id, conv.id),
      with: {
        participants: {
          with: {
            user: {
              columns: {
                id: true,
                username: true,
                displayName: true,
                avatarUrl: true,
                lastSeen: true,
              },
            },
          },
        },
      },
    });

    res.status(201).json(full);
  } catch (err: any) {
    if (err.name === "ZodError") {
      res.status(400).json({ error: "Validation failed", details: err.errors });
      return;
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const conv = await db.query.conversations.findFirst({
      where: eq(conversations.id, req.params.id as string),
      with: {
        participants: {
          with: {
            user: {
              columns: {
                id: true,
                username: true,
                displayName: true,
                avatarUrl: true,
                lastSeen: true,
              },
            },
          },
        },
      },
    });

    if (!conv) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }

    const isParticipant = conv.participants.some(
      (p) => p.userId === req.user!.userId
    );
    if (!isParticipant) {
      res.status(403).json({ error: "Not a participant" });
      return;
    }

    res.json(conv);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
