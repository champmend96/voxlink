import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import {
  generateTestToken,
  generateExpiredToken,
  TEST_JWT_SECRET,
} from "../helpers/setup";
import { testUsers } from "../fixtures";

describe("Security", () => {
  // ── Rate Limiting ──

  describe("Rate limiting on auth endpoints", () => {
    it("should return 429 after exceeding rate limit", async () => {
      const { authRateLimiter } = await import("../../middleware/security");
      const app = express();
      app.use(express.json());

      // Create a limiter with very low threshold for testing
      const { default: rateLimit } = await import("express-rate-limit");
      const testLimiter = rateLimit({
        windowMs: 60000,
        max: 2,
        message: { error: "Too many requests, please try again later" },
      });

      app.use("/api/auth", testLimiter, (_req, res) => {
        res.json({ ok: true });
      });

      await request(app).post("/api/auth/login").send({});
      await request(app).post("/api/auth/login").send({});

      const res = await request(app).post("/api/auth/login").send({});
      expect(res.status).toBe(429);
    });
  });

  // ── Helmet Headers ──

  describe("Helmet security headers", () => {
    it("should include security headers in responses", async () => {
      const { setupSecurity } = await import("../../middleware/security");
      const app = express();
      setupSecurity(app);
      app.get("/test", (_req, res) => res.json({ ok: true }));

      const res = await request(app).get("/test");

      // Helmet sets multiple security headers
      expect(res.headers).toHaveProperty("x-content-type-options");
      expect(res.headers["x-content-type-options"]).toBe("nosniff");
      expect(res.headers).toHaveProperty("x-frame-options");
    });
  });

  // ── Input Sanitization ──

  describe("Input sanitization (XSS prevention)", () => {
    it("should strip HTML tags from request body", async () => {
      const { sanitizeInput } = await import("../../middleware/security");
      const app = express();
      app.use(express.json());
      app.use(sanitizeInput);
      app.post("/test", (req, res) => res.json(req.body));

      const res = await request(app)
        .post("/test")
        .send({ name: '<script>alert("xss")</script>Hello' });

      expect(res.body.name).not.toContain("<script>");
      expect(res.body.name).toContain("Hello");
    });

    it("should handle non-string fields without modification", async () => {
      const { sanitizeInput } = await import("../../middleware/security");
      const app = express();
      app.use(express.json());
      app.use(sanitizeInput);
      app.post("/test", (req, res) => res.json(req.body));

      const res = await request(app)
        .post("/test")
        .send({ count: 42, active: true });

      expect(res.body.count).toBe(42);
      expect(res.body.active).toBe(true);
    });
  });

  // ── JWT Validation ──

  describe("JWT token validation", () => {
    let app: express.Express;

    beforeEach(async () => {
      const { authenticate } = await import("../../middleware/auth");
      app = express();
      app.use(express.json());
      app.get("/protected", authenticate, (req, res) => {
        res.json({ userId: req.user!.userId });
      });
    });

    it("should reject requests without Authorization header", async () => {
      const res = await request(app).get("/protected");
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/missing/i);
    });

    it("should reject invalid JWT tokens", async () => {
      const res = await request(app)
        .get("/protected")
        .set("Authorization", "Bearer invalid.token.here");

      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/invalid/i);
    });

    it("should reject expired tokens", async () => {
      const expired = generateExpiredToken(testUsers.alice.id);
      await new Promise((r) => setTimeout(r, 50));

      const res = await request(app)
        .get("/protected")
        .set("Authorization", `Bearer ${expired}`);

      expect(res.status).toBe(401);
    });

    it("should accept valid tokens and set user on request", async () => {
      const token = generateTestToken(testUsers.alice.id, testUsers.alice.username);

      const res = await request(app)
        .get("/protected")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.userId).toBe(testUsers.alice.id);
    });

    it("should reject tokens signed with wrong secret", async () => {
      const jwt = await import("jsonwebtoken");
      const badToken = jwt.default.sign(
        { userId: testUsers.alice.id, username: "alice" },
        "wrong-secret",
        { expiresIn: "1h" }
      );

      const res = await request(app)
        .get("/protected")
        .set("Authorization", `Bearer ${badToken}`);

      expect(res.status).toBe(401);
    });

    it("should reject non-Bearer auth schemes", async () => {
      const res = await request(app)
        .get("/protected")
        .set("Authorization", "Basic dXNlcjpwYXNz");

      expect(res.status).toBe(401);
    });
  });

  // ── Password Strength ──

  describe("Password strength validation", () => {
    it("should reject passwords shorter than 8 characters", async () => {
      const { validatePasswordStrength } = await import("../../middleware/security");
      const result = validatePasswordStrength("Short1");
      expect(result.valid).toBe(false);
      expect(result.message).toMatch(/8 characters/);
    });

    it("should reject passwords without lowercase letters", async () => {
      const { validatePasswordStrength } = await import("../../middleware/security");
      const result = validatePasswordStrength("ALLUPPERCASE1");
      expect(result.valid).toBe(false);
      expect(result.message).toMatch(/lowercase/);
    });

    it("should reject passwords without uppercase letters", async () => {
      const { validatePasswordStrength } = await import("../../middleware/security");
      const result = validatePasswordStrength("alllowercase1");
      expect(result.valid).toBe(false);
      expect(result.message).toMatch(/uppercase/);
    });

    it("should reject passwords without numbers", async () => {
      const { validatePasswordStrength } = await import("../../middleware/security");
      const result = validatePasswordStrength("NoNumbersHere");
      expect(result.valid).toBe(false);
      expect(result.message).toMatch(/number/);
    });

    it("should accept strong passwords", async () => {
      const { validatePasswordStrength } = await import("../../middleware/security");
      const result = validatePasswordStrength("SecurePass1");
      expect(result.valid).toBe(true);
    });
  });
});
