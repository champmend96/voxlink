import express from "express";
import cors from "cors";
import path from "path";
import { createServer } from "http";
import { config } from "./config";
import { logger } from "./services/logger";
import { setupSocket } from "./socket";
import { setupSecurity, authRateLimiter, sanitizeInput } from "./middleware/security";
import authRoutes from "./routes/auth";
import userRoutes from "./routes/users";
import conversationRoutes from "./routes/conversations";
import messageRoutes from "./routes/messages";
import callRoutes from "./routes/calls";
import iceRoutes from "./routes/ice";
import deviceRoutes from "./routes/devices";
import keyRoutes from "./routes/keys";
import uploadRoutes from "./routes/upload";
import metricsRoutes from "./routes/metrics";

const app = express();
const httpServer = createServer(app);

// Security middleware
setupSecurity(app);

// CORS
const corsOrigins = config.corsOrigins === "*" ? "*" : config.corsOrigins.split(",");
app.use(cors({ origin: corsOrigins }));

// Body parsing
app.use(express.json());
app.use(sanitizeInput);

// Static file serving for uploads
app.use("/uploads", express.static(config.fileStoragePath));

// Auth routes with stricter rate limiting
app.use("/api/auth", authRateLimiter, authRoutes);

// Protected API routes
app.use("/api/users", userRoutes);
app.use("/api/conversations", conversationRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/calls", callRoutes);
app.use("/api/ice", iceRoutes);
app.use("/api/devices", deviceRoutes);
app.use("/api/keys", keyRoutes);
app.use("/api/messages", uploadRoutes);

// Monitoring
app.use("/api", metricsRoutes);

const io = setupSocket(httpServer);

httpServer.listen(config.port, () => {
  logger.info(`VoxLink server running on port ${config.port}`);
});
