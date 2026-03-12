import { z } from "zod";

export const registerSchema = z.object({
  username: z.string().min(3).max(50),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  displayName: z.string().min(1).max(100).optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export const refreshSchema = z.object({
  refreshToken: z.string(),
});

export const createConversationSchema = z.object({
  participantIds: z.array(z.string().uuid()).min(1),
  name: z.string().max(100).optional(),
  isGroup: z.boolean().optional(),
});

export const sendMessageSchema = z.object({
  content: z.string().min(1).max(5000),
});

export const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  avatarUrl: z.string().url().optional(),
});
