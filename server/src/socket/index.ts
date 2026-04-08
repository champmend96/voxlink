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
  callHistory,
  deviceTokens,
} from "../db/schema";
import { config } from "../config";
import { AuthPayload } from "../middleware/auth";
import { logger } from "../services/logger";
import { pushService } from "../services/push";
import { mediasoupService } from "../services/mediasoup";
import { setWsConnectionCount, setActiveCallsCount } from "../routes/metrics";

const onlineUsers = new Map<string, Set<string>>();

interface ActiveCall {
  id: string;
  callerId: string;
  calleeId: string;
  callType: string;
  startedAt: Date;
  connectedAt?: Date;
  callRecordId?: string;
}

const activeCalls = new Map<string, ActiveCall>();
const userInCall = new Map<string, string>();

let callIdCounter = 0;
function generateCallId(): string {
  return `call_${Date.now()}_${++callIdCounter}`;
}

function getSocketsForUser(userId: string): Set<string> | undefined {
  return onlineUsers.get(userId);
}

function updateMetrics(): void {
  let totalConnections = 0;
  for (const sockets of onlineUsers.values()) {
    totalConnections += sockets.size;
  }
  setWsConnectionCount(totalConnections);
  setActiveCallsCount(activeCalls.size);
}

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
    updateMetrics();

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
          logger.error({ err }, "Error sending message");
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
          logger.error({ err }, "Error processing read receipt");
        }
      }
    );

    // ── WebRTC Signaling Events ──

    socket.on(
      "call-initiate",
      async (data: { calleeId: string; callType: string }) => {
        try {
          const { calleeId, callType } = data;

          if (userInCall.has(userId)) {
            socket.emit("call-error", { message: "You are already in a call" });
            return;
          }

          if (userInCall.has(calleeId)) {
            socket.emit("call-busy", { calleeId });
            return;
          }

          const calleeSockets = getSocketsForUser(calleeId);

          const callId = generateCallId();

          const [callRecord] = await db
            .insert(callHistory)
            .values({
              callerId: userId,
              calleeId,
              callType,
              status: "missed",
            })
            .returning();

          const call: ActiveCall = {
            id: callId,
            callerId: userId,
            calleeId,
            callType,
            startedAt: new Date(),
            callRecordId: callRecord.id,
          };

          activeCalls.set(callId, call);
          userInCall.set(userId, callId);
          userInCall.set(calleeId, callId);
          updateMetrics();

          const caller = await db.query.users.findFirst({
            where: eq(users.id, userId),
            columns: { id: true, username: true, displayName: true, avatarUrl: true },
          });

          if (!calleeSockets || calleeSockets.size === 0) {
            // User is offline — send push notification
            const tokens = await db
              .select({ token: deviceTokens.token, platform: deviceTokens.platform })
              .from(deviceTokens)
              .where(eq(deviceTokens.userId, calleeId));

            if (tokens.length > 0) {
              const callerName = caller?.displayName || caller?.username || "Someone";
              await pushService.sendCallNotification(tokens, callerName, callType, callId);
            }

            socket.emit("call-error", { message: "User is offline" });
            activeCalls.delete(callId);
            userInCall.delete(userId);
            userInCall.delete(calleeId);
            updateMetrics();
            return;
          }

          for (const sid of calleeSockets) {
            io.to(sid).emit("call-incoming", {
              callId,
              caller,
              callType,
            });
          }

          socket.emit("call-initiated", { callId, calleeId });

          // 30s ring timeout
          setTimeout(async () => {
            const activeCall = activeCalls.get(callId);
            if (activeCall && !activeCall.connectedAt) {
              activeCalls.delete(callId);
              userInCall.delete(userId);
              userInCall.delete(calleeId);
              updateMetrics();

              const callerSockets = getSocketsForUser(userId);
              const calleeSocks = getSocketsForUser(calleeId);

              if (callerSockets) {
                for (const sid of callerSockets) {
                  io.to(sid).emit("call-timeout", { callId });
                }
              }
              if (calleeSocks) {
                for (const sid of calleeSocks) {
                  io.to(sid).emit("call-timeout", { callId });
                }
              }
            }
          }, 30000);
        } catch (err) {
          logger.error({ err }, "Error initiating call");
          socket.emit("call-error", { message: "Failed to initiate call" });
        }
      }
    );

    socket.on(
      "call-offer",
      (data: { callId: string; sdp: unknown }) => {
        const call = activeCalls.get(data.callId);
        if (!call) return;

        const targetId = call.calleeId;
        const targetSockets = getSocketsForUser(targetId);
        if (targetSockets) {
          for (const sid of targetSockets) {
            io.to(sid).emit("call-offer", {
              callId: data.callId,
              sdp: data.sdp,
            });
          }
        }
      }
    );

    socket.on(
      "call-answer",
      async (data: { callId: string; sdp: unknown }) => {
        const call = activeCalls.get(data.callId);
        if (!call) return;

        call.connectedAt = new Date();

        if (call.callRecordId) {
          await db
            .update(callHistory)
            .set({ status: "answered" })
            .where(eq(callHistory.id, call.callRecordId));
        }

        const callerSockets = getSocketsForUser(call.callerId);
        if (callerSockets) {
          for (const sid of callerSockets) {
            io.to(sid).emit("call-answer", {
              callId: data.callId,
              sdp: data.sdp,
            });
          }
        }
      }
    );

    socket.on(
      "ice-candidate",
      (data: { callId: string; candidate: unknown }) => {
        const call = activeCalls.get(data.callId);
        if (!call) return;

        const targetId = userId === call.callerId ? call.calleeId : call.callerId;
        const targetSockets = getSocketsForUser(targetId);
        if (targetSockets) {
          for (const sid of targetSockets) {
            io.to(sid).emit("ice-candidate", {
              callId: data.callId,
              candidate: data.candidate,
            });
          }
        }
      }
    );

    // Toggle video on/off mid-call
    socket.on(
      "call-toggle-video",
      (data: { callId: string; videoEnabled: boolean }) => {
        const call = activeCalls.get(data.callId);
        if (!call) return;

        const targetId = userId === call.callerId ? call.calleeId : call.callerId;
        const targetSockets = getSocketsForUser(targetId);
        if (targetSockets) {
          for (const sid of targetSockets) {
            io.to(sid).emit("call-toggle-video", {
              callId: data.callId,
              userId,
              videoEnabled: data.videoEnabled,
            });
          }
        }
      }
    );

    socket.on(
      "call-reject",
      async (data: { callId: string }) => {
        const call = activeCalls.get(data.callId);
        if (!call) return;

        if (call.callRecordId) {
          await db
            .update(callHistory)
            .set({ status: "rejected", endedAt: new Date() })
            .where(eq(callHistory.id, call.callRecordId));
        }

        activeCalls.delete(data.callId);
        userInCall.delete(call.callerId);
        userInCall.delete(call.calleeId);
        updateMetrics();

        const callerSockets = getSocketsForUser(call.callerId);
        if (callerSockets) {
          for (const sid of callerSockets) {
            io.to(sid).emit("call-rejected", { callId: data.callId });
          }
        }
      }
    );

    socket.on(
      "call-end",
      async (data: { callId: string }) => {
        const call = activeCalls.get(data.callId);
        if (!call) return;

        const endedAt = new Date();
        const duration = call.connectedAt
          ? Math.floor((endedAt.getTime() - call.connectedAt.getTime()) / 1000)
          : 0;

        if (call.callRecordId) {
          await db
            .update(callHistory)
            .set({
              status: call.connectedAt ? "completed" : "missed",
              duration,
              endedAt,
            })
            .where(eq(callHistory.id, call.callRecordId));
        }

        activeCalls.delete(data.callId);
        userInCall.delete(call.callerId);
        userInCall.delete(call.calleeId);
        updateMetrics();

        const targetId = userId === call.callerId ? call.calleeId : call.callerId;
        const targetSockets = getSocketsForUser(targetId);
        if (targetSockets) {
          for (const sid of targetSockets) {
            io.to(sid).emit("call-ended", { callId: data.callId });
          }
        }
      }
    );

    // ── Group Call Events (SFU via mediasoup) ──

    socket.on(
      "group-call-join",
      async (data: { conversationId: string }) => {
        try {
          if (!mediasoupService.available) {
            socket.emit("group-call-error", { message: "Group calls not available on this server" });
            return;
          }

          const { conversationId } = data;
          const callId = `group_${conversationId}`;

          let groupCall: any = mediasoupService.getGroupCall(callId);
          if (!groupCall) {
            groupCall = await mediasoupService.createGroupCall(callId);
          }

          if (!groupCall || !mediasoupService.canJoin(callId)) {
            socket.emit("group-call-error", { message: "Call is full (max 8)" });
            return;
          }

          const user = await db.query.users.findFirst({
            where: eq(users.id, userId),
            columns: { displayName: true, username: true },
          });

          const displayName = user?.displayName || user?.username || "Unknown";
          await mediasoupService.addParticipant(callId, userId, displayName);

          socket.join(`group-call:${callId}`);

          // Notify others
          socket.to(`group-call:${callId}`).emit("group-call-participant-joined", {
            userId,
            displayName,
          });

          // Send existing participants to the joiner
          const participants = mediasoupService.getParticipants(callId);
          socket.emit("group-call-participants", { participants });

          // Send router RTP capabilities
          const rtpCapabilities = mediasoupService.getRouterRtpCapabilities(callId);
          socket.emit("group-call-rtp-capabilities", { rtpCapabilities });
        } catch (err) {
          logger.error({ err }, "Error joining group call");
        }
      }
    );

    socket.on(
      "group-call-leave",
      async (data: { conversationId: string }) => {
        const callId = `group_${data.conversationId}`;
        await mediasoupService.removeParticipant(callId, userId);
        socket.leave(`group-call:${callId}`);
        io.to(`group-call:${callId}`).emit("group-call-participant-left", { userId });
      }
    );

    socket.on(
      "group-call-create-transport",
      async (data: { conversationId: string; direction: "send" | "recv" }) => {
        const callId = `group_${data.conversationId}`;
        const transport = await mediasoupService.createWebRtcTransport(
          callId,
          userId,
          data.direction
        );
        socket.emit("group-call-transport-created", {
          direction: data.direction,
          transport,
        });
      }
    );

    socket.on(
      "group-call-connect-transport",
      async (data: {
        conversationId: string;
        transportId: string;
        dtlsParameters: any;
      }) => {
        const callId = `group_${data.conversationId}`;
        await mediasoupService.connectTransport(
          callId,
          userId,
          data.transportId,
          data.dtlsParameters
        );
      }
    );

    socket.on(
      "group-call-produce",
      async (data: {
        conversationId: string;
        kind: "audio" | "video";
        rtpParameters: any;
      }) => {
        const callId = `group_${data.conversationId}`;
        const producerId = await mediasoupService.produce(
          callId,
          userId,
          data.kind,
          data.rtpParameters
        );

        socket.emit("group-call-produced", { producerId });

        // Notify others about new producer
        socket.to(`group-call:${callId}`).emit("group-call-new-producer", {
          userId,
          producerId,
          kind: data.kind,
        });
      }
    );

    socket.on(
      "group-call-consume",
      async (data: {
        conversationId: string;
        producerUserId: string;
        producerId: string;
        rtpCapabilities: any;
      }) => {
        const callId = `group_${data.conversationId}`;
        const consumer = await mediasoupService.consume(
          callId,
          userId,
          data.producerUserId,
          data.producerId,
          data.rtpCapabilities
        );

        socket.emit("group-call-consumed", consumer);
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

          // Clean up any active call for this user
          const callId = userInCall.get(userId);
          if (callId) {
            const call = activeCalls.get(callId);
            if (call) {
              const endedAt = new Date();
              const duration = call.connectedAt
                ? Math.floor((endedAt.getTime() - call.connectedAt.getTime()) / 1000)
                : 0;

              if (call.callRecordId) {
                await db
                  .update(callHistory)
                  .set({
                    status: call.connectedAt ? "completed" : "missed",
                    duration,
                    endedAt,
                  })
                  .where(eq(callHistory.id, call.callRecordId));
              }

              activeCalls.delete(callId);
              userInCall.delete(call.callerId);
              userInCall.delete(call.calleeId);

              const peerId = userId === call.callerId ? call.calleeId : call.callerId;
              const peerSockets = getSocketsForUser(peerId);
              if (peerSockets) {
                for (const sid of peerSockets) {
                  io.to(sid).emit("call-ended", { callId });
                }
              }
            }
          }
        }
      }
      updateMetrics();
    });
  });

  return io;
}

export function getOnlineUsers(): string[] {
  return Array.from(onlineUsers.keys());
}
