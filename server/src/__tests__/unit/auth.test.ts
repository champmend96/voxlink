import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { TEST_JWT_SECRET, TEST_JWT_REFRESH_SECRET, generateTestRefreshToken } from "../helpers/setup";
import { testUsers } from "../fixtures";

// Setup app with auth routes
async function createApp() {
  const { default: authRoutes } = await import("../../routes/auth");
  const { sanitizeInput } = await import("../../middleware/security");
  const app = express();
  app.use(express.json());
  app.use(sanitizeInput);
  app.use("/api/auth", authRoutes);
  return app;
}

describe("Auth Routes", () => {
  let app: express.Express;
  let db: any;

  beforeEach(async () => {
    app = await createApp();
    const dbModule = await import("../../db");
    db = dbModule.db;
  });

  // ── POST /api/auth/register ──

  describe("POST /api/auth/register", () => {
    it("should register successfully with valid data", async () => {
      const newUser = {
        id: crypto.randomUUID(),
        username: "newuser",
        email: "new@example.com",
        displayName: "newuser",
      };

      db.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([newUser]),
        }),
      });

      const res = await request(app)
        .post("/api/auth/register")
        .send({
          username: "newuser",
          email: "new@example.com",
          password: "SecurePass1",
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty("accessToken");
      expect(res.body).toHaveProperty("refreshToken");
      expect(res.body.user.username).toBe("newuser");
    });

    it("should fail with duplicate email (409)", async () => {
      db.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockRejectedValue({ code: "23505" }),
        }),
      });

      const res = await request(app)
        .post("/api/auth/register")
        .send({
          username: "alice2",
          email: "alice@example.com",
          password: "SecurePass1",
        });

      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/already exists/i);
    });

    it("should fail with weak password — too short", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send({
          username: "weakuser",
          email: "weak@example.com",
          password: "short",
        });

      expect(res.status).toBe(400);
    });

    it("should fail with weak password — no uppercase", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send({
          username: "weakuser",
          email: "weak@example.com",
          password: "nouppercase1",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/uppercase/i);
    });

    it("should fail with weak password — no lowercase", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send({
          username: "weakuser",
          email: "weak@example.com",
          password: "NOLOWERCASE1",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/lowercase/i);
    });

    it("should fail with weak password — no number", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send({
          username: "weakuser",
          email: "weak@example.com",
          password: "NoNumberHere",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/number/i);
    });

    it("should fail with missing fields (400)", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send({ username: "onlyuser" });

      expect(res.status).toBe(400);
    });

    it("should fail with invalid email format", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send({
          username: "user1",
          email: "not-an-email",
          password: "SecurePass1",
        });

      expect(res.status).toBe(400);
    });
  });

  // ── POST /api/auth/login ──

  describe("POST /api/auth/login", () => {
    it("should login successfully with correct credentials", async () => {
      const hashedPassword = await bcrypt.hash("SecurePass1", 12);
      const user = {
        ...testUsers.alice,
        passwordHash: hashedPassword,
        failedLoginAttempts: 0,
        lockedUntil: null,
      };

      db.query.users.findFirst.mockResolvedValue(user);
      db.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "alice@example.com", password: "SecurePass1" });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("accessToken");
      expect(res.body).toHaveProperty("refreshToken");
      expect(res.body.user.email).toBe("alice@example.com");
    });

    it("should fail with wrong password (401)", async () => {
      const hashedPassword = await bcrypt.hash("SecurePass1", 12);
      const user = {
        ...testUsers.alice,
        passwordHash: hashedPassword,
        failedLoginAttempts: 0,
        lockedUntil: null,
      };

      db.query.users.findFirst.mockResolvedValue(user);
      db.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "alice@example.com", password: "WrongPass1" });

      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/invalid credentials/i);
    });

    it("should fail with non-existent email (401)", async () => {
      db.query.users.findFirst.mockResolvedValue(null);

      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "nobody@example.com", password: "SecurePass1" });

      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/invalid credentials/i);
    });

    it("should lockout account after 5 failed attempts (423)", async () => {
      db.query.users.findFirst.mockResolvedValue(testUsers.locked);

      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "locked@example.com", password: "SecurePass1" });

      expect(res.status).toBe(423);
      expect(res.body.error).toMatch(/locked/i);
    });

    it("should increment failed attempts on wrong password", async () => {
      const hashedPassword = await bcrypt.hash("SecurePass1", 12);
      const user = {
        ...testUsers.alice,
        passwordHash: hashedPassword,
        failedLoginAttempts: 3,
        lockedUntil: null,
      };

      db.query.users.findFirst.mockResolvedValue(user);
      const mockSet = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      });
      db.update.mockReturnValue({ set: mockSet });

      await request(app)
        .post("/api/auth/login")
        .send({ email: "alice@example.com", password: "WrongPass1" });

      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({ failedLoginAttempts: 4 })
      );
    });
  });

  // ── POST /api/auth/refresh ──

  describe("POST /api/auth/refresh", () => {
    it("should refresh tokens with valid refresh token", async () => {
      const refreshToken = generateTestRefreshToken(testUsers.alice.id, testUsers.alice.username);

      const res = await request(app)
        .post("/api/auth/refresh")
        .send({ refreshToken });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("accessToken");
      expect(res.body).toHaveProperty("refreshToken");
    });

    it("should fail with expired refresh token (401)", async () => {
      const expiredToken = jwt.sign(
        { userId: testUsers.alice.id, username: testUsers.alice.username },
        TEST_JWT_REFRESH_SECRET,
        { expiresIn: "0s" }
      );

      // Wait a moment for token to expire
      await new Promise((r) => setTimeout(r, 50));

      const res = await request(app)
        .post("/api/auth/refresh")
        .send({ refreshToken: expiredToken });

      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/invalid refresh token/i);
    });

    it("should fail with invalid refresh token (401)", async () => {
      const res = await request(app)
        .post("/api/auth/refresh")
        .send({ refreshToken: "invalid.token.here" });

      expect(res.status).toBe(401);
    });

    it("should fail with missing refresh token (400)", async () => {
      const res = await request(app)
        .post("/api/auth/refresh")
        .send({});

      expect(res.status).toBe(400);
    });
  });

  // ── JWT Token Validation ──

  describe("JWT token structure", () => {
    it("should produce tokens with correct payload structure", async () => {
      const hashedPassword = await bcrypt.hash("SecurePass1", 12);
      const user = {
        ...testUsers.alice,
        passwordHash: hashedPassword,
        failedLoginAttempts: 0,
        lockedUntil: null,
      };

      db.query.users.findFirst.mockResolvedValue(user);
      db.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "alice@example.com", password: "SecurePass1" });

      const decoded = jwt.verify(res.body.accessToken, TEST_JWT_SECRET) as any;
      expect(decoded).toHaveProperty("userId");
      expect(decoded).toHaveProperty("username");
      expect(decoded).toHaveProperty("exp");
      expect(decoded).toHaveProperty("iat");
      expect(decoded.userId).toBe(testUsers.alice.id);
    });
  });
});
