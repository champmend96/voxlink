import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { Express, Request, Response, NextFunction } from "express";
import sanitizeHtml from "sanitize-html";
import pinoHttp from "pino-http";
import { config } from "../config";
import { logger } from "../services/logger";

// Rate limiter for auth endpoints
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: { error: "Too many requests, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

// General API rate limiter
export const apiRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100,
  message: { error: "Too many requests" },
  standardHeaders: true,
  legacyHeaders: false,
});

// Sanitize request body middleware
export function sanitizeInput(req: Request, _res: Response, next: NextFunction): void {
  if (req.body && typeof req.body === "object") {
    for (const key of Object.keys(req.body)) {
      if (typeof req.body[key] === "string") {
        req.body[key] = sanitizeHtml(req.body[key], {
          allowedTags: [],
          allowedAttributes: {},
        });
      }
    }
  }
  next();
}

// Password strength validation
export function validatePasswordStrength(password: string): { valid: boolean; message?: string } {
  if (password.length < 8) {
    return { valid: false, message: "Password must be at least 8 characters" };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, message: "Password must contain a lowercase letter" };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: "Password must contain an uppercase letter" };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: "Password must contain a number" };
  }
  return { valid: true };
}

// HTTP request logger
export const httpLogger = pinoHttp({ logger });

export function setupSecurity(app: Express): void {
  // Helmet for security headers
  app.use(helmet());

  // Request logging
  app.use(httpLogger);

  // CORS is configured in index.ts

  // General rate limit on all API routes
  app.use("/api/", apiRateLimiter);
}
