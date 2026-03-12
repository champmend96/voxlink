import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import { createServer, Server as HttpServer } from "http";
import { Server as IOServer } from "socket.io";
import { io as ioClient, Socket as ClientSocket } from "socket.io-client";
import jwt from "jsonwebtoken";
import { TEST_JWT_SECRET } from "../helpers/setup";
import { testUsers, testConversations } from "../fixtures";

// Integration tests use a real Socket.IO server with mocked DB

describe("Socket.IO Integration", () => {
  let httpServer: HttpServer;
  let ioServer: IOServer;
  let port: number;

  beforeAll((done) => {
    httpServer = createServer();
    ioServer = new IOServer(httpServer, {
      cors: { origin: "*" },
    });

    // Auth middleware
    ioServer.use((socket, next) => {
      const token = socket.handshake.auth.token;
      if (!token) return next(new Error("Authentication required"));
      try {
        const payload = jwt.verify(token, TEST_JWT_SECRET) as any;
        socket.data.user = payload;
        next();
      } catch {
        next(new Error("Invalid token"));
      }
    });

    // Basic event handlers for testing
    ioServer.on("connection", (socket) => {
      socket.on("join-room", (conversationId: string) => {
        socket.join(`conversation:${conversationId}`);
      });

      socket.on("send-message", (data: { conversationId: string; content: string }) => {
        const message = {
          id: crypto.randomUUID(),
          conversationId: data.conversationId,
          senderId: socket.data.user.userId,
          content: data.content,
          readBy: [socket.data.user.userId],
          createdAt: new Date().toISOString(),
          sender: {
            id: socket.data.user.userId,
            username: socket.data.user.username,
            displayName: socket.data.user.username,
          },
        };
        ioServer.to(`conversation:${data.conversationId}`).emit("new-message", message);
      });

      socket.on("typing", (data: { conversationId: string; isTyping: boolean }) => {
        socket.to(`conversation:${data.conversationId}`).emit("typing", {
          userId: socket.data.user.userId,
          username: socket.data.user.username,
          conversationId: data.conversationId,
          isTyping: data.isTyping,
        });
      });

      socket.on("read-receipt", (data: { conversationId: string; messageId: string }) => {
        ioServer.to(`conversation:${data.conversationId}`).emit("read-receipt", {
          messageId: data.messageId,
          userId: socket.data.user.userId,
          conversationId: data.conversationId,
        });
      });

      socket.emit("online-status", { userId: socket.data.user.userId, online: true });

      socket.on("disconnect", () => {
        ioServer.emit("online-status", { userId: socket.data.user.userId, online: false });
      });
    });

    httpServer.listen(0, () => {
      const addr = httpServer.address();
      port = typeof addr === "object" ? addr!.port : 0;
      done();
    });
  });

  afterAll(() => {
    ioServer.close();
    httpServer.close();
  });

  function createClientSocket(userId: string, username: string): ClientSocket {
    const token = jwt.sign({ userId, username }, TEST_JWT_SECRET, { expiresIn: "1h" });
    return ioClient(`http://localhost:${port}`, {
      auth: { token },
      transports: ["websocket"],
    });
  }

  // ── Connection Tests ──

  describe("Socket connection", () => {
    it("should connect with valid auth token", (done) => {
      const client = createClientSocket(testUsers.alice.id, "alice");
      client.on("connect", () => {
        expect(client.connected).toBe(true);
        client.disconnect();
        done();
      });
    });

    it("should reject connection without auth token", (done) => {
      const client = ioClient(`http://localhost:${port}`, {
        auth: {},
        transports: ["websocket"],
      });

      client.on("connect_error", (err) => {
        expect(err.message).toMatch(/authentication/i);
        client.disconnect();
        done();
      });
    });

    it("should reject connection with invalid token", (done) => {
      const client = ioClient(`http://localhost:${port}`, {
        auth: { token: "invalid.token.here" },
        transports: ["websocket"],
      });

      client.on("connect_error", (err) => {
        expect(err.message).toMatch(/invalid/i);
        client.disconnect();
        done();
      });
    });
  });

  // ── Room / Messaging Tests ──

  describe("Messaging events", () => {
    it("should join a room and receive messages", (done) => {
      const alice = createClientSocket(testUsers.alice.id, "alice");
      const bob = createClientSocket(testUsers.bob.id, "bob");
      const convId = testConversations.aliceBob.id;

      let connected = 0;
      function onConnect() {
        connected++;
        if (connected === 2) {
          alice.emit("join-room", convId);
          bob.emit("join-room", convId);

          // Wait a tick for room join
          setTimeout(() => {
            bob.on("new-message", (msg) => {
              expect(msg.content).toBe("Hello from Alice");
              expect(msg.conversationId).toBe(convId);
              alice.disconnect();
              bob.disconnect();
              done();
            });

            alice.emit("send-message", { conversationId: convId, content: "Hello from Alice" });
          }, 100);
        }
      }

      alice.on("connect", onConnect);
      bob.on("connect", onConnect);
    });

    it("should emit typing indicator to other participants", (done) => {
      const alice = createClientSocket(testUsers.alice.id, "alice");
      const bob = createClientSocket(testUsers.bob.id, "bob");
      const convId = testConversations.aliceBob.id;

      let connected = 0;
      function onConnect() {
        connected++;
        if (connected === 2) {
          alice.emit("join-room", convId);
          bob.emit("join-room", convId);

          setTimeout(() => {
            bob.on("typing", (data) => {
              expect(data.userId).toBe(testUsers.alice.id);
              expect(data.isTyping).toBe(true);
              expect(data.conversationId).toBe(convId);
              alice.disconnect();
              bob.disconnect();
              done();
            });

            alice.emit("typing", { conversationId: convId, isTyping: true });
          }, 100);
        }
      }

      alice.on("connect", onConnect);
      bob.on("connect", onConnect);
    });

    it("should emit read receipt events", (done) => {
      const alice = createClientSocket(testUsers.alice.id, "alice");
      const bob = createClientSocket(testUsers.bob.id, "bob");
      const convId = testConversations.aliceBob.id;
      const msgId = crypto.randomUUID();

      let connected = 0;
      function onConnect() {
        connected++;
        if (connected === 2) {
          alice.emit("join-room", convId);
          bob.emit("join-room", convId);

          setTimeout(() => {
            alice.on("read-receipt", (data) => {
              expect(data.messageId).toBe(msgId);
              expect(data.userId).toBe(testUsers.bob.id);
              alice.disconnect();
              bob.disconnect();
              done();
            });

            bob.emit("read-receipt", { conversationId: convId, messageId: msgId });
          }, 100);
        }
      }

      alice.on("connect", onConnect);
      bob.on("connect", onConnect);
    });
  });

  // ── Online Status ──

  describe("Online status tracking", () => {
    it("should emit online status on connect", (done) => {
      const alice = createClientSocket(testUsers.alice.id, "alice");

      alice.on("online-status", (data) => {
        if (data.userId === testUsers.alice.id && data.online === true) {
          alice.disconnect();
          done();
        }
      });
    });

    it("should emit offline status on disconnect", (done) => {
      const alice = createClientSocket(testUsers.alice.id, "alice");
      const bob = createClientSocket(testUsers.bob.id, "bob");

      bob.on("connect", () => {
        bob.on("online-status", (data) => {
          if (data.userId === testUsers.alice.id && data.online === false) {
            bob.disconnect();
            done();
          }
        });

        setTimeout(() => alice.disconnect(), 100);
      });
    });
  });
});
