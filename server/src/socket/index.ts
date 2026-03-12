import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { eq, and } from "drizzle-orm";
import { db } from "../db";
import {
  messages,
  conversationParticipants,
  users,
  conversations,
} from "../db/schema";
import { config } from "../config";
import { AuthPayload } from "../middleware/auth";

const onlineUsers = new Map<string, Set<string>>();

export function setupSocket(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error("Authentication required"));

    try {
      const payload = jwt.verify(token, config.jwtSecret) as AuthPayload;
      socket.data.user = payload;
      next();
    } catch {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", async (socket: Socket) => {
    const userId = socket.data.user.userId;

    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, new Set());
    }
    onlineUsers.get(userId)!.add(socket.id);

    await db
      .update(users)
      .set({ lastSeen: new Date() })
      .where(eq(users.id, userId));

    io.emit("online-status", { userId, online: true });

    const userConversations = await db
      .select({ conversationId: conversationParticipants.conversationId })
      .from(conversationParticipants)
      .where(eq(conversationParticipants.userId, userId));

    for (const { conversationId } of userConversations) {
      socket.join(`conversation:${conversationId}`);
    }

    socket.on("join-room", (conversationId: string) => {
      socket.join(`conversation:${conversationId}`);
    });

    socket.on(
      "send-message",
      async (data: { conversationId: string; content: string }) => {
        try {
          const { conversationId, content } = data;
          if (!content || content.length > 5000) return;

          const participant =
            await db.query.conversationParticipants.findFirst({
              where: and(
                eq(conversationParticipants.conversationId, conversationId),
                eq(conversationParticipants.userId, userId)
              ),
            });

          if (!participant) return;

          const [message] = await db
            .insert(messages)
            .values({
              conversationId,
              senderId: userId,
              content,
              readBy: [userId],
            })
            .returning();

          await db
            .update(conversations)
            .set({ updatedAt: new Date() })
            .where(eq(conversations.id, conversationId));

          const sender = await db.query.users.findFirst({
            where: eq(users.id, userId),
            columns: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
            },
          });

          const fullMessage = { ...message, sender };

          io.to(`conversation:${conversationId}`).emit(
            "new-message",
            fullMessage
          );
        } catch (err) {
          console.error("Error sending message:", err);
        }
      }
    );

    socket.on(
      "typing",
      (data: { conversationId: string; isTyping: boolean }) => {
        socket.to(`conversation:${data.conversationId}`).emit("typing", {
          userId,
          username: socket.data.user.username,
          conversationId: data.conversationId,
          isTyping: data.isTyping,
        });
      }
    );

    socket.on(
      "read-receipt",
      async (data: { conversationId: string; messageId: string }) => {
        try {
          const message = await db.query.messages.findFirst({
            where: eq(messages.id, data.messageId),
          });

          if (message && !message.readBy.includes(userId)) {
            await db
              .update(messages)
              .set({ readBy: [...message.readBy, userId] })
              .where(eq(messages.id, data.messageId));

            io.to(`conversation:${data.conversationId}`).emit("read-receipt", {
              messageId: data.messageId,
              userId,
              conversationId: data.conversationId,
            });
          }
        } catch (err) {
          console.error("Error processing read receipt:", err);
        }
      }
    );

    socket.on("disconnect", async () => {
      const sockets = onlineUsers.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          onlineUsers.delete(userId);
          await db
            .update(users)
            .set({ lastSeen: new Date() })
            .where(eq(users.id, userId));
          io.emit("online-status", { userId, online: false });
        }
      }
    });
  });

  return io;
}

export function getOnlineUsers(): string[] {
  return Array.from(onlineUsers.keys());
}
