import { Router } from "express";
import { eq, or, desc } from "drizzle-orm";
import { db } from "../db";
import { callHistory, users } from "../db/schema";
import { authenticate } from "../middleware/auth";

const router = Router();

router.get("/history", authenticate, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 50, 1), 100);

    const calls = await db
      .select({
        id: callHistory.id,
        callerId: callHistory.callerId,
        calleeId: callHistory.calleeId,
        callType: callHistory.callType,
        status: callHistory.status,
        duration: callHistory.duration,
        startedAt: callHistory.startedAt,
        endedAt: callHistory.endedAt,
      })
      .from(callHistory)
      .where(or(eq(callHistory.callerId, userId), eq(callHistory.calleeId, userId)))
      .orderBy(desc(callHistory.startedAt))
      .limit(limit);

    const callsWithUsers = await Promise.all(
      calls.map(async (call) => {
        const [caller, callee] = await Promise.all([
          db.query.users.findFirst({
            where: eq(users.id, call.callerId),
            columns: { id: true, username: true, displayName: true, avatarUrl: true },
          }),
          db.query.users.findFirst({
            where: eq(users.id, call.calleeId),
            columns: { id: true, username: true, displayName: true, avatarUrl: true },
          }),
        ]);
        return { ...call, caller, callee };
      })
    );

    res.json({ calls: callsWithUsers });
  } catch (err) {
    console.error("Error fetching call history:", err);
    res.status(500).json({ error: "Failed to fetch call history" });
  }
});

export default router;
