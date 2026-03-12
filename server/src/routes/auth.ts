import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { users } from "../db/schema";
import { config } from "../config";
import { registerSchema, loginSchema, refreshSchema } from "../validators";
import { AuthPayload, authenticate } from "../middleware/auth";
import { validatePasswordStrength } from "../middleware/security";
import { logger } from "../services/logger";

const router = Router();

function generateTokens(payload: AuthPayload) {
  const accessToken = jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtExpiry,
  });
  const refreshToken = jwt.sign(payload, config.jwtRefreshSecret, {
    expiresIn: config.jwtRefreshExpiry,
  });
  return { accessToken, refreshToken };
}

router.post("/register", async (req: Request, res: Response) => {
  try {
    const body = registerSchema.parse(req.body);

    // Password strength validation
    const strength = validatePasswordStrength(body.password);
    if (!strength.valid) {
      res.status(400).json({ error: strength.message });
      return;
    }

    const passwordHash = await bcrypt.hash(body.password, 12);

    const [user] = await db
      .insert(users)
      .values({
        username: body.username,
        email: body.email,
        passwordHash,
        displayName: body.displayName || body.username,
      })
      .returning({
        id: users.id,
        username: users.username,
        email: users.email,
        displayName: users.displayName,
      });

    const tokens = generateTokens({ userId: user.id, username: user.username });
    res.status(201).json({ user, ...tokens });
  } catch (err: any) {
    if (err.code === "23505") {
      res.status(409).json({ error: "Username or email already exists" });
      return;
    }
    if (err.name === "ZodError") {
      res.status(400).json({ error: "Validation failed", details: err.errors });
      return;
    }
    logger.error({ err }, "Registration error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/login", async (req: Request, res: Response) => {
  try {
    const body = loginSchema.parse(req.body);

    const user = await db.query.users.findFirst({
      where: eq(users.email, body.email),
    });

    if (!user) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    // Account lockout check
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const remainingMs = user.lockedUntil.getTime() - Date.now();
      const remainingMin = Math.ceil(remainingMs / 60000);
      res.status(423).json({
        error: `Account locked. Try again in ${remainingMin} minute(s)`,
      });
      return;
    }

    const validPassword = await bcrypt.compare(body.password, user.passwordHash);

    if (!validPassword) {
      const newAttempts = (user.failedLoginAttempts || 0) + 1;
      const updates: Record<string, any> = { failedLoginAttempts: newAttempts };

      if (newAttempts >= config.maxLoginAttempts) {
        updates.lockedUntil = new Date(Date.now() + config.lockoutDurationMs);
        logger.warn({ email: body.email }, "Account locked after failed attempts");
      }

      await db.update(users).set(updates).where(eq(users.id, user.id));

      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    // Reset failed attempts on successful login
    if (user.failedLoginAttempts > 0) {
      await db
        .update(users)
        .set({ failedLoginAttempts: 0, lockedUntil: null })
        .where(eq(users.id, user.id));
    }

    const tokens = generateTokens({ userId: user.id, username: user.username });
    res.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.displayName,
      },
      ...tokens,
    });
  } catch (err: any) {
    if (err.name === "ZodError") {
      res.status(400).json({ error: "Validation failed", details: err.errors });
      return;
    }
    logger.error({ err }, "Login error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/refresh", async (req: Request, res: Response) => {
  try {
    const { refreshToken } = refreshSchema.parse(req.body);
    const payload = jwt.verify(refreshToken, config.jwtRefreshSecret) as AuthPayload;

    // Token rotation: issue completely new tokens
    const tokens = generateTokens({ userId: payload.userId, username: payload.username });
    res.json(tokens);
  } catch (err: any) {
    if (err.name === "ZodError") {
      res.status(400).json({ error: "Validation failed", details: err.errors });
      return;
    }
    res.status(401).json({ error: "Invalid refresh token" });
  }
});

router.get("/me", authenticate, async (req: Request, res: Response) => {
  try {
    const user = await db.query.users.findFirst({
      where: eq(users.id, req.user!.userId),
      columns: {
        id: true,
        username: true,
        email: true,
        displayName: true,
        avatarUrl: true,
        publicKey: true,
        lastSeen: true,
        createdAt: true,
      },
    });

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json(user);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
