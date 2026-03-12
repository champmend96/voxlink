import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { createServer, Server as HttpServer } from "http";
import { Server as IOServer } from "socket.io";
import { io as ioClient, Socket as ClientSocket } from "socket.io-client";
import jwt from "jsonwebtoken";
import { TEST_JWT_SECRET } from "../helpers/setup";
import { testUsers } from "../fixtures";

describe("WebRTC Signaling Integration", () => {
  let httpServer: HttpServer;
  let ioServer: IOServer;
  let port: number;

  const activeCalls = new Map<string, any>();
  const userInCall = new Map<string, string>();
  let callIdCounter = 0;

  beforeAll((done) => {
    httpServer = createServer();
    ioServer = new IOServer(httpServer, { cors: { origin: "*" } });

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

    const onlineUsers = new Map<string, Set<string>>();

    ioServer.on("connection", (socket) => {
      const userId = socket.data.user.userId;

      if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
      onlineUsers.get(userId)!.add(socket.id);

      socket.on("call-initiate", (data: { calleeId: string; callType: string }) => {
        if (userInCall.has(userId)) {
          socket.emit("call-error", { message: "You are already in a call" });
          return;
        }
        if (userInCall.has(data.calleeId)) {
          socket.emit("call-busy", { calleeId: data.calleeId });
          return;
        }

        const callId = `call_${++callIdCounter}`;
        activeCalls.set(callId, {
          id: callId,
          callerId: userId,
          calleeId: data.calleeId,
          callType: data.callType,
          startedAt: new Date(),
        });
        userInCall.set(userId, callId);
        userInCall.set(data.calleeId, callId);

        const calleeSockets = onlineUsers.get(data.calleeId);
        if (calleeSockets) {
          for (const sid of calleeSockets) {
            ioServer.to(sid).emit("call-incoming", {
              callId,
              caller: { id: userId, username: socket.data.user.username },
              callType: data.callType,
            });
          }
        }

        socket.emit("call-initiated", { callId, calleeId: data.calleeId });

        // 30s ring timeout
        setTimeout(() => {
          const call = activeCalls.get(callId);
          if (call && !call.connectedAt) {
            activeCalls.delete(callId);
            userInCall.delete(call.callerId);
            userInCall.delete(call.calleeId);
            const callerSockets = onlineUsers.get(call.callerId);
            if (callerSockets) {
              for (const sid of callerSockets) ioServer.to(sid).emit("call-timeout", { callId });
            }
            const calleeSocks = onlineUsers.get(call.calleeId);
            if (calleeSocks) {
              for (const sid of calleeSocks) ioServer.to(sid).emit("call-timeout", { callId });
            }
          }
        }, 30000);
      });

      socket.on("call-offer", (data: { callId: string; sdp: unknown }) => {
        const call = activeCalls.get(data.callId);
        if (!call) return;
        const sockets = onlineUsers.get(call.calleeId);
        if (sockets) {
          for (const sid of sockets) ioServer.to(sid).emit("call-offer", { callId: data.callId, sdp: data.sdp });
        }
      });

      socket.on("call-answer", (data: { callId: string; sdp: unknown }) => {
        const call = activeCalls.get(data.callId);
        if (!call) return;
        call.connectedAt = new Date();
        const sockets = onlineUsers.get(call.callerId);
        if (sockets) {
          for (const sid of sockets) ioServer.to(sid).emit("call-answer", { callId: data.callId, sdp: data.sdp });
        }
      });

      socket.on("ice-candidate", (data: { callId: string; candidate: unknown }) => {
        const call = activeCalls.get(data.callId);
        if (!call) return;
        const targetId = userId === call.callerId ? call.calleeId : call.callerId;
        const sockets = onlineUsers.get(targetId);
        if (sockets) {
          for (const sid of sockets) ioServer.to(sid).emit("ice-candidate", { callId: data.callId, candidate: data.candidate });
        }
      });

      socket.on("call-reject", (data: { callId: string }) => {
        const call = activeCalls.get(data.callId);
        if (!call) return;
        activeCalls.delete(data.callId);
        userInCall.delete(call.callerId);
        userInCall.delete(call.calleeId);
        const sockets = onlineUsers.get(call.callerId);
        if (sockets) {
          for (const sid of sockets) ioServer.to(sid).emit("call-rejected", { callId: data.callId });
        }
      });

      socket.on("call-end", (data: { callId: string }) => {
        const call = activeCalls.get(data.callId);
        if (!call) return;
        activeCalls.delete(data.callId);
        userInCall.delete(call.callerId);
        userInCall.delete(call.calleeId);
        const targetId = userId === call.callerId ? call.calleeId : call.callerId;
        const sockets = onlineUsers.get(targetId);
        if (sockets) {
          for (const sid of sockets) ioServer.to(sid).emit("call-ended", { callId: data.callId });
        }
      });

      socket.on("call-toggle-video", (data: { callId: string; videoEnabled: boolean }) => {
        const call = activeCalls.get(data.callId);
        if (!call) return;
        const targetId = userId === call.callerId ? call.calleeId : call.callerId;
        const sockets = onlineUsers.get(targetId);
        if (sockets) {
          for (const sid of sockets) {
            ioServer.to(sid).emit("call-toggle-video", {
              callId: data.callId,
              userId,
              videoEnabled: data.videoEnabled,
            });
          }
        }
      });

      socket.on("disconnect", () => {
        const sockets = onlineUsers.get(userId);
        if (sockets) {
          sockets.delete(socket.id);
          if (sockets.size === 0) {
            onlineUsers.delete(userId);
            const callId = userInCall.get(userId);
            if (callId) {
              const call = activeCalls.get(callId);
              if (call) {
                activeCalls.delete(callId);
                userInCall.delete(call.callerId);
                userInCall.delete(call.calleeId);
                const peerId = userId === call.callerId ? call.calleeId : call.callerId;
                const peerSockets = onlineUsers.get(peerId);
                if (peerSockets) {
                  for (const sid of peerSockets) ioServer.to(sid).emit("call-ended", { callId });
                }
              }
            }
          }
        }
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

  function waitForBoth(a: ClientSocket, b: ClientSocket): Promise<void> {
    return new Promise((resolve) => {
      let count = 0;
      function check() { if (++count === 2) resolve(); }
      a.on("connect", check);
      b.on("connect", check);
    });
  }

  // ── Call Initiation Flow ──

  describe("Call initiation", () => {
    it("should initiate a call and notify callee", async () => {
      const alice = createClient(testUsers.alice.id, "alice");
      const bob = createClient(testUsers.bob.id, "bob");
      await waitForBoth(alice, bob);

      const callPromise = new Promise<void>((resolve) => {
        bob.on("call-incoming", (data) => {
          expect(data.callId).toBeDefined();
          expect(data.caller.id).toBe(testUsers.alice.id);
          expect(data.callType).toBe("audio");
          resolve();
        });
      });

      const initiatedPromise = new Promise<string>((resolve) => {
        alice.on("call-initiated", (data) => {
          resolve(data.callId);
        });
      });

      alice.emit("call-initiate", { calleeId: testUsers.bob.id, callType: "audio" });

      const callId = await initiatedPromise;
      await callPromise;

      // Cleanup
      alice.emit("call-end", { callId });
      alice.disconnect();
      bob.disconnect();
    });
  });

  // ── SDP Exchange ──

  describe("SDP exchange", () => {
    it("should relay call-offer to callee", async () => {
      const alice = createClient(testUsers.alice.id, "alice");
      const bob = createClient(testUsers.bob.id, "bob");
      await waitForBoth(alice, bob);

      const callId = await new Promise<string>((resolve) => {
        alice.on("call-initiated", (data) => resolve(data.callId));
        alice.emit("call-initiate", { calleeId: testUsers.bob.id, callType: "audio" });
      });

      const offerPromise = new Promise<void>((resolve) => {
        bob.on("call-offer", (data) => {
          expect(data.callId).toBe(callId);
          expect(data.sdp).toEqual({ type: "offer", sdp: "v=0..." });
          resolve();
        });
      });

      alice.emit("call-offer", { callId, sdp: { type: "offer", sdp: "v=0..." } });
      await offerPromise;

      alice.emit("call-end", { callId });
      alice.disconnect();
      bob.disconnect();
    });

    it("should relay call-answer to caller", async () => {
      const alice = createClient(testUsers.alice.id, "alice");
      const bob = createClient(testUsers.bob.id, "bob");
      await waitForBoth(alice, bob);

      const callId = await new Promise<string>((resolve) => {
        alice.on("call-initiated", (data) => resolve(data.callId));
        alice.emit("call-initiate", { calleeId: testUsers.bob.id, callType: "audio" });
      });

      const answerPromise = new Promise<void>((resolve) => {
        alice.on("call-answer", (data) => {
          expect(data.callId).toBe(callId);
          expect(data.sdp).toEqual({ type: "answer", sdp: "v=0..." });
          resolve();
        });
      });

      bob.emit("call-answer", { callId, sdp: { type: "answer", sdp: "v=0..." } });
      await answerPromise;

      alice.emit("call-end", { callId });
      alice.disconnect();
      bob.disconnect();
    });
  });

  // ── ICE Candidates ──

  describe("ICE candidate relay", () => {
    it("should relay ICE candidates between peers", async () => {
      const alice = createClient(testUsers.alice.id, "alice");
      const bob = createClient(testUsers.bob.id, "bob");
      await waitForBoth(alice, bob);

      const callId = await new Promise<string>((resolve) => {
        alice.on("call-initiated", (data) => resolve(data.callId));
        alice.emit("call-initiate", { calleeId: testUsers.bob.id, callType: "audio" });
      });

      const icePromise = new Promise<void>((resolve) => {
        bob.on("ice-candidate", (data) => {
          expect(data.candidate).toEqual({ candidate: "test-candidate" });
          resolve();
        });
      });

      alice.emit("ice-candidate", { callId, candidate: { candidate: "test-candidate" } });
      await icePromise;

      alice.emit("call-end", { callId });
      alice.disconnect();
      bob.disconnect();
    });
  });

  // ── Call Reject ──

  describe("Call rejection", () => {
    it("should notify caller when callee rejects", async () => {
      const alice = createClient(testUsers.alice.id, "alice");
      const bob = createClient(testUsers.bob.id, "bob");
      await waitForBoth(alice, bob);

      const callId = await new Promise<string>((resolve) => {
        alice.on("call-initiated", (data) => resolve(data.callId));
        alice.emit("call-initiate", { calleeId: testUsers.bob.id, callType: "audio" });
      });

      const rejectPromise = new Promise<void>((resolve) => {
        alice.on("call-rejected", (data) => {
          expect(data.callId).toBe(callId);
          resolve();
        });
      });

      bob.emit("call-reject", { callId });
      await rejectPromise;

      alice.disconnect();
      bob.disconnect();
    });
  });

  // ── Call End ──

  describe("Call ending", () => {
    it("should notify peer when call is ended", async () => {
      const alice = createClient(testUsers.alice.id, "alice");
      const bob = createClient(testUsers.bob.id, "bob");
      await waitForBoth(alice, bob);

      const callId = await new Promise<string>((resolve) => {
        alice.on("call-initiated", (data) => resolve(data.callId));
        alice.emit("call-initiate", { calleeId: testUsers.bob.id, callType: "audio" });
      });

      // Bob answers
      bob.emit("call-answer", { callId, sdp: { type: "answer", sdp: "v=0..." } });

      const endPromise = new Promise<void>((resolve) => {
        bob.on("call-ended", (data) => {
          expect(data.callId).toBe(callId);
          resolve();
        });
      });

      setTimeout(() => alice.emit("call-end", { callId }), 100);
      await endPromise;

      alice.disconnect();
      bob.disconnect();
    });
  });

  // ── Call Busy ──

  describe("Call busy", () => {
    it("should return busy when callee is already in a call", async () => {
      const alice = createClient(testUsers.alice.id, "alice");
      const bob = createClient(testUsers.bob.id, "bob");
      const charlie = createClient(testUsers.charlie.id, "charlie");

      await new Promise<void>((resolve) => {
        let count = 0;
        function check() { if (++count === 3) resolve(); }
        alice.on("connect", check);
        bob.on("connect", check);
        charlie.on("connect", check);
      });

      // Alice calls Bob
      const callId = await new Promise<string>((resolve) => {
        alice.on("call-initiated", (data) => resolve(data.callId));
        alice.emit("call-initiate", { calleeId: testUsers.bob.id, callType: "audio" });
      });

      // Charlie tries to call Bob (who's already in a call)
      const busyPromise = new Promise<void>((resolve) => {
        charlie.on("call-busy", (data) => {
          expect(data.calleeId).toBe(testUsers.bob.id);
          resolve();
        });
      });

      charlie.emit("call-initiate", { calleeId: testUsers.bob.id, callType: "audio" });
      await busyPromise;

      alice.emit("call-end", { callId });
      alice.disconnect();
      bob.disconnect();
      charlie.disconnect();
    });
  });

  // ── Toggle Video ──

  describe("Video toggle", () => {
    it("should relay call-toggle-video to the other peer", async () => {
      const alice = createClient(testUsers.alice.id, "alice");
      const bob = createClient(testUsers.bob.id, "bob");
      await waitForBoth(alice, bob);

      const callId = await new Promise<string>((resolve) => {
        alice.on("call-initiated", (data) => resolve(data.callId));
        alice.emit("call-initiate", { calleeId: testUsers.bob.id, callType: "video" });
      });

      const togglePromise = new Promise<void>((resolve) => {
        bob.on("call-toggle-video", (data) => {
          expect(data.callId).toBe(callId);
          expect(data.videoEnabled).toBe(false);
          resolve();
        });
      });

      alice.emit("call-toggle-video", { callId, videoEnabled: false });
      await togglePromise;

      alice.emit("call-end", { callId });
      alice.disconnect();
      bob.disconnect();
    });
  });
});
