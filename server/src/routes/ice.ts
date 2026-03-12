import { Router, Request, Response } from "express";
import { authenticate } from "../middleware/auth";
import { config } from "../config";

const router = Router();

router.get("/config", authenticate, (_req: Request, res: Response) => {
  const iceServers: Array<{
    urls: string | string[];
    username?: string;
    credential?: string;
  }> = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ];

  if (config.turnServer) {
    iceServers.push({
      urls: [
        `turn:${config.turnServer}:3478?transport=udp`,
        `turn:${config.turnServer}:3478?transport=tcp`,
      ],
      username: config.turnUsername,
      credential: config.turnPassword,
    });
  }

  res.json({ iceServers });
});

export default router;
