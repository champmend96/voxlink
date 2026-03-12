import express from "express";
import cors from "cors";
import { createServer } from "http";
import { config } from "./config";
import { setupSocket } from "./socket";
import authRoutes from "./routes/auth";
import userRoutes from "./routes/users";
import conversationRoutes from "./routes/conversations";
import messageRoutes from "./routes/messages";
import callRoutes from "./routes/calls";

const app = express();
const httpServer = createServer(app);

app.use(cors({ origin: "*" }));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/conversations", conversationRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/calls", callRoutes);

const io = setupSocket(httpServer);

httpServer.listen(config.port, () => {
  console.log(`VoxLink server running on port ${config.port}`);
});
