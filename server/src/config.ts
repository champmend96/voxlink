import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

export const config = {
  port: parseInt(process.env.PORT || "3000", 10),
  databaseUrl: process.env.DATABASE_URL!,
  jwtSecret: process.env.JWT_SECRET || "dev-secret",
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || "dev-refresh-secret",
  jwtExpiry: "15m" as const,
  jwtRefreshExpiry: "7d" as const,
  nodeEnv: process.env.NODE_ENV || "development",

  // TURN server
  turnServer: process.env.TURN_SERVER || "",
  turnUsername: process.env.TURN_USERNAME || "voxlink",
  turnPassword: process.env.TURN_PASSWORD || "voxlink-turn-password",

  // Push notifications
  apnsKeyPath: process.env.APNS_KEY_PATH || "",
  apnsKeyId: process.env.APNS_KEY_ID || "",
  apnsTeamId: process.env.APNS_TEAM_ID || "",
  fcmServiceAccountPath: process.env.FCM_SERVICE_ACCOUNT_PATH || "",

  // File uploads
  fileStoragePath: process.env.FILE_STORAGE_PATH || path.resolve(__dirname, "../uploads"),
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE || String(25 * 1024 * 1024), 10),

  // Mediasoup (group calls)
  mediasoupWorkers: parseInt(process.env.MEDIASOUP_WORKERS || "2", 10),
  mediasoupRtcMinPort: parseInt(process.env.MEDIASOUP_RTC_MIN_PORT || "40000", 10),
  mediasoupRtcMaxPort: parseInt(process.env.MEDIASOUP_RTC_MAX_PORT || "49999", 10),
  mediasoupListenIp: process.env.MEDIASOUP_LISTEN_IP || "0.0.0.0",
  mediasoupAnnouncedIp: process.env.MEDIASOUP_ANNOUNCED_IP || "",

  // Security
  corsOrigins: process.env.CORS_ORIGINS || "*",
  maxLoginAttempts: parseInt(process.env.MAX_LOGIN_ATTEMPTS || "5", 10),
  lockoutDurationMs: parseInt(process.env.LOCKOUT_DURATION_MS || String(15 * 60 * 1000), 10),
};
