import express, { Express } from "express";
import cors from "cors";
import { createServer, Server as HttpServer } from "http";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { vi, beforeAll, afterAll, beforeEach } from "vitest";

// ── Mock DB ──

const mockUsers = new Map<string, any>();
const mockConversations = new Map<string, any>();
const mockParticipants: any[] = [];
const mockMessages: any[] = [];
const mockDeviceTokens: any[] = [];
const mockCallHistory: any[] = [];

export function clearMockDb() {
  mockUsers.clear();
  mockConversations.clear();
  mockParticipants.length = 0;
  mockMessages.length = 0;
  mockDeviceTokens.length = 0;
  mockCallHistory.length = 0;
}

export function getMockDb() {
  return {
    users: mockUsers,
    conversations: mockConversations,
    participants: mockParticipants,
    messages: mockMessages,
    deviceTokens: mockDeviceTokens,
    callHistory: mockCallHistory,
  };
}

// ── Mock db module ──

vi.mock("../../db", () => {
  const mockDb: any = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([{ count: 1 }]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    query: {
      users: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
      },
      conversationParticipants: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      conversations: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      messages: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
      },
    },
  };
  return { db: mockDb };
});

// ── Mock services ──

vi.mock("../../services/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("../../services/push", () => ({
  pushService: {
    sendCallNotification: vi.fn().mockResolvedValue(undefined),
    sendMessageNotification: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("../../services/mediasoup", () => ({
  mediasoupService: {
    getGroupCall: vi.fn().mockReturnValue(null),
    createGroupCall: vi.fn().mockResolvedValue({}),
    canJoin: vi.fn().mockReturnValue(true),
    addParticipant: vi.fn().mockResolvedValue(undefined),
    removeParticipant: vi.fn().mockResolvedValue(undefined),
    getParticipants: vi.fn().mockReturnValue([]),
    getRouterRtpCapabilities: vi.fn().mockReturnValue({}),
    createWebRtcTransport: vi.fn().mockResolvedValue({}),
    connectTransport: vi.fn().mockResolvedValue(undefined),
    produce: vi.fn().mockResolvedValue("producer-id"),
    consume: vi.fn().mockResolvedValue({}),
  },
}));

// ── Test Constants ──

export const TEST_JWT_SECRET = "test-jwt-secret";
export const TEST_JWT_REFRESH_SECRET = "test-jwt-refresh-secret";

// ── Mock config ──

vi.mock("../../config", () => ({
  config: {
    port: 0,
    databaseUrl: "postgresql://test:test@localhost:5432/test",
    jwtSecret: "test-jwt-secret",
    jwtRefreshSecret: "test-jwt-refresh-secret",
    jwtExpiry: "15m",
    jwtRefreshExpiry: "7d",
    nodeEnv: "test",
    turnServer: "",
    turnUsername: "test",
    turnPassword: "test",
    apnsKeyPath: "",
    apnsKeyId: "",
    apnsTeamId: "",
    fcmServiceAccountPath: "",
    fileStoragePath: "/tmp/voxlink-test-uploads",
    maxFileSize: 25 * 1024 * 1024,
    mediasoupWorkers: 1,
    mediasoupRtcMinPort: 40000,
    mediasoupRtcMaxPort: 49999,
    mediasoupListenIp: "0.0.0.0",
    mediasoupAnnouncedIp: "",
    corsOrigins: "*",
    maxLoginAttempts: 5,
    lockoutDurationMs: 15 * 60 * 1000,
  },
}));

// ── Helpers ──

export function generateTestToken(userId: string, username: string = "testuser"): string {
  return jwt.sign({ userId, username }, TEST_JWT_SECRET, { expiresIn: "1h" });
}

export function generateTestRefreshToken(userId: string, username: string = "testuser"): string {
  return jwt.sign({ userId, username }, TEST_JWT_REFRESH_SECRET, { expiresIn: "7d" });
}

export function generateExpiredToken(userId: string, username: string = "testuser"): string {
  return jwt.sign({ userId, username }, TEST_JWT_SECRET, { expiresIn: "0s" });
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

// ── App Factory ──

export function createTestApp(): Express {
  // Import fresh routes for each test
  const app = express();

  // Must set up security middleware similar to production
  app.use(cors({ origin: "*" }));
  app.use(express.json());

  return app;
}

export function createTestServer(): { app: Express; server: HttpServer } {
  const app = createTestApp();
  const server = createServer(app);
  return { app, server };
}

// Global hooks
beforeEach(() => {
  vi.clearAllMocks();
});
