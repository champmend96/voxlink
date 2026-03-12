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
};
