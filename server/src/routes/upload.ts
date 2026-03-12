import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import crypto from "crypto";
import sharp from "sharp";
import fs from "fs";
import { db } from "../db";
import { messages, conversations, conversationParticipants, users } from "../db/schema";
import { authenticate } from "../middleware/auth";
import { eq, and } from "drizzle-orm";
import { config } from "../config";
import { logger } from "../services/logger";

const router = Router();

router.use(authenticate);

const uploadDir = config.fileStoragePath;
const thumbDir = path.join(uploadDir, "thumbnails");

// Ensure directories exist
for (const dir of [uploadDir, thumbDir]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = crypto.randomBytes(16).toString("hex") + ext;
    cb(null, name);
  },
});

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/octet-stream",
];

const upload = multer({
  storage,
  limits: { fileSize: config.maxFileSize },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(null, true); // Allow all files, just log non-standard types
    }
  },
});

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

router.post(
  "/upload",
  upload.single("file"),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: "No file provided" });
        return;
      }

      const { conversationId } = req.body;
      if (!conversationId) {
        // Clean up uploaded file
        fs.unlinkSync(req.file.path);
        res.status(400).json({ error: "conversationId required" });
        return;
      }

      const userId = req.user!.userId;

      // Verify participant
      const participant = await db.query.conversationParticipants.findFirst({
        where: and(
          eq(conversationParticipants.conversationId, conversationId),
          eq(conversationParticipants.userId, userId)
        ),
      });

      if (!participant) {
        fs.unlinkSync(req.file.path);
        res.status(403).json({ error: "Not a participant" });
        return;
      }

      let thumbnailUrl: string | null = null;

      // Generate thumbnail for images
      if (IMAGE_TYPES.includes(req.file.mimetype)) {
        try {
          const thumbFilename = `thumb_${req.file.filename}`;
          const thumbPath = path.join(thumbDir, thumbFilename);
          await sharp(req.file.path)
            .resize(200, 200, { fit: "cover" })
            .jpeg({ quality: 70 })
            .toFile(thumbPath);
          thumbnailUrl = `/uploads/thumbnails/${thumbFilename}`;
        } catch (err) {
          logger.warn({ err }, "Failed to generate thumbnail");
        }
      }

      const downloadUrl = `/uploads/${req.file.filename}`;

      const fileMetadata = JSON.stringify({
        type: "file",
        filename: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        thumbnailUrl,
        downloadUrl,
      });

      const [message] = await db
        .insert(messages)
        .values({
          conversationId,
          senderId: userId,
          content: fileMetadata,
          readBy: [userId],
        })
        .returning();

      await db
        .update(conversations)
        .set({ updatedAt: new Date() })
        .where(eq(conversations.id, conversationId));

      const sender = await db.query.users.findFirst({
        where: eq(users.id, userId),
        columns: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
        },
      });

      res.status(201).json({ ...message, sender });
    } catch (err) {
      logger.error({ err }, "File upload failed");
      res.status(500).json({ error: "Upload failed" });
    }
  }
);

export default router;
