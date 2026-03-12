import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { createServer, Server as HttpServer } from "http";
import { Server as IOServer } from "socket.io";
import { io as ioClient, Socket as ClientSocket } from "socket.io-client";
import jwt from "jsonwebtoken";
import { TEST_JWT_SECRET } from "../helpers/setup";
import { testUsers, testConversations } from "../fixtures";

describe("Group Call Integration", () => {
  let httpServer: HttpServer;
  let ioServer: IOServer;
  let port: number;

  const groupCalls = new Map<string, { participants: Map<string, string> }>();
  const MAX_PARTICIPANTS = 8;

  beforeAll((done) => {
    httpServer = createServer();
    ioServer = new IOServer(httpServer, { cors: { origin: "*" } });

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

    ioServer.on("connection", (socket) => {
      const userId = socket.data.user.userId;

      socket.on("group-call-join", (data: { conversationId: string }) => {
        const callId = `group_${data.conversationId}`;

        if (!groupCalls.has(callId)) {
          groupCalls.set(callId, { participants: new Map() });
        }

        const call = groupCalls.get(callId)!;

        if (call.participants.size >= MAX_PARTICIPANTS) {
          socket.emit("group-call-error", { message: "Call is full (max 8)" });
          return;
        }

        const displayName = socket.data.user.username;
        call.participants.set(userId, displayName);
        socket.join(`group-call:${callId}`);

        socket.to(`group-call:${callId}`).emit("group-call-participant-joined", {
          userId,
          displayName,
        });

        const participants = Array.from(call.participants.entries()).map(
          ([uid, name]) => ({ userId: uid, displayName: name })
        );
        socket.emit("group-call-participants", { participants });
      });

      socket.on("group-call-leave", (data: { conversationId: string }) => {
        const callId = `group_${data.conversationId}`;
        const call = groupCalls.get(callId);
        if (call) {
          call.participants.delete(userId);
          socket.leave(`group-call:${callId}`);
          ioServer.to(`group-call:${callId}`).emit("group-call-participant-left", { userId });

          // Cleanup empty room
          if (call.participants.size === 0) {
            groupCalls.delete(callId);
          }
        }
      });

      socket.on("group-call-produce", (data: { conversationId: string; kind: string; rtpParameters: any }) => {
        const callId = `group_${data.conversationId}`;
        const producerId = `producer_${userId}_${data.kind}`;
        socket.emit("group-call-produced", { producerId });
        socket.to(`group-call:${callId}`).emit("group-call-new-producer", {
          userId,
          producerId,
          kind: data.kind,
        });
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

  function createClient(userId: string, username: string): ClientSocket {
    const token = jwt.sign({ userId, username }, TEST_JWT_SECRET, { expiresIn: "1h" });
    return ioClient(`http://localhost:${port}`, {
      auth: { token },
      transports: ["websocket"],
    });
  }

  // ── Group Call Join ──

  describe("Group call join", () => {
    it("should create room when first user joins", (done) => {
      const alice = createClient(testUsers.alice.id, "alice");

      alice.on("connect", () => {
        alice.emit("group-call-join", { conversationId: testConversations.group.id });

        alice.on("group-call-participants", (data) => {
          expect(data.participants).toHaveLength(1);
          expect(data.participants[0].userId).toBe(testUsers.alice.id);

          // Cleanup
          alice.emit("group-call-leave", { conversationId: testConversations.group.id });
          alice.disconnect();
          done();
        });
      });
    });

    it("should allow multiple participants to join", (done) => {
      const alice = createClient(testUsers.alice.id, "alice");
      const bob = createClient(testUsers.bob.id, "bob");
      const convId = testConversations.group.id;

      let connected = 0;
      function onConnect() {
        connected++;
        if (connected === 2) {
          alice.emit("group-call-join", { conversationId: convId });

          alice.on("group-call-participants", () => {
            bob.on("group-call-participants", (data) => {
              expect(data.participants.length).toBeGreaterThanOrEqual(2);

              alice.emit("group-call-leave", { conversationId: convId });
              bob.emit("group-call-leave", { conversationId: convId });
              alice.disconnect();
              bob.disconnect();
              done();
            });

            bob.emit("group-call-join", { conversationId: convId });
          });
        }
      }

      alice.on("connect", onConnect);
      bob.on("connect", onConnect);
    });

    it("should notify others when new participant joins", (done) => {
      const alice = createClient(testUsers.alice.id, "alice");
      const bob = createClient(testUsers.bob.id, "bob");
      const convId = testConversations.group.id;

      let connected = 0;
      function onConnect() {
        connected++;
        if (connected === 2) {
          alice.emit("group-call-join", { conversationId: convId });

          alice.on("group-call-participants", () => {
            alice.on("group-call-participant-joined", (data) => {
              expect(data.userId).toBe(testUsers.bob.id);
              expect(data.displayName).toBe("bob");

              alice.emit("group-call-leave", { conversationId: convId });
              bob.emit("group-call-leave", { conversationId: convId });
              alice.disconnect();
              bob.disconnect();
              done();
            });

            bob.emit("group-call-join", { conversationId: convId });
          });
        }
      }

      alice.on("connect", onConnect);
      bob.on("connect", onConnect);
    });
  });

  // ── Group Call Leave ──

  describe("Group call leave", () => {
    it("should remove participant and notify others on leave", (done) => {
      const alice = createClient(testUsers.alice.id, "alice");
      const bob = createClient(testUsers.bob.id, "bob");
      const convId = testConversations.group.id;

      let connected = 0;
      function onConnect() {
        connected++;
        if (connected === 2) {
          alice.emit("group-call-join", { conversationId: convId });

          alice.on("group-call-participants", () => {
            bob.emit("group-call-join", { conversationId: convId });

            bob.on("group-call-participants", () => {
              alice.on("group-call-participant-left", (data) => {
                expect(data.userId).toBe(testUsers.bob.id);
                alice.emit("group-call-leave", { conversationId: convId });
                alice.disconnect();
                bob.disconnect();
                done();
              });

              bob.emit("group-call-leave", { conversationId: convId });
            });
          });
        }
      }

      alice.on("connect", onConnect);
      bob.on("connect", onConnect);
    });
  });

  // ── New Producer ──

  describe("Group call produce", () => {
    it("should forward new-producer event to others", (done) => {
      const alice = createClient(testUsers.alice.id, "alice");
      const bob = createClient(testUsers.bob.id, "bob");
      const convId = testConversations.group.id;

      let connected = 0;
      function onConnect() {
        connected++;
        if (connected === 2) {
          alice.emit("group-call-join", { conversationId: convId });
          alice.on("group-call-participants", () => {
            bob.emit("group-call-join", { conversationId: convId });
            bob.on("group-call-participants", () => {
              bob.on("group-call-new-producer", (data) => {
                expect(data.userId).toBe(testUsers.alice.id);
                expect(data.kind).toBe("audio");
                expect(data.producerId).toBeDefined();

                alice.emit("group-call-leave", { conversationId: convId });
                bob.emit("group-call-leave", { conversationId: convId });
                alice.disconnect();
                bob.disconnect();
                done();
              });

              alice.emit("group-call-produce", {
                conversationId: convId,
                kind: "audio",
                rtpParameters: {},
              });
            });
          });
        }
      }

      alice.on("connect", onConnect);
      bob.on("connect", onConnect);
    });
  });

  // ── Max Participants ──

  describe("Max participants", () => {
    it("should enforce max 8 participants", (done) => {
      const convId = "max-test-conv";
      const clients: ClientSocket[] = [];
      let joinedCount = 0;

      // Create 9 clients
      for (let i = 0; i < 9; i++) {
        const id = crypto.randomUUID();
        const client = createClient(id, `user${i}`);
        clients.push(client);
      }

      let connectedCount = 0;
      for (const client of clients) {
        client.on("connect", () => {
          connectedCount++;
          if (connectedCount === 9) {
            // Join first 8
            for (let i = 0; i < 8; i++) {
              clients[i].emit("group-call-join", { conversationId: convId });
              clients[i].on("group-call-participants", () => {
                joinedCount++;
                if (joinedCount === 8) {
                  // 9th client should be rejected
                  clients[8].on("group-call-error", (data) => {
                    expect(data.message).toMatch(/full|max 8/i);
                    clients.forEach((c) => c.disconnect());
                    done();
                  });

                  clients[8].emit("group-call-join", { conversationId: convId });
                }
              });
            }
          }
        });
      }
    });
  });
});
