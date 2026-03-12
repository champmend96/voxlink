export interface User {
  id: string;
  username: string;
  email?: string;
  displayName: string | null;
  avatarUrl: string | null;
  publicKey?: string | null;
  lastSeen: string | null;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  readBy: string[];
  createdAt: string;
  sender?: Pick<User, "id" | "username" | "displayName" | "avatarUrl">;
}

export interface FileMessageMetadata {
  type: "file";
  filename: string;
  mimeType: string;
  size: number;
  thumbnailUrl: string | null;
  downloadUrl: string;
}

export interface Conversation {
  id: string;
  name: string | null;
  isGroup: boolean;
  createdAt: string;
  updatedAt: string;
  participants: {
    conversationId: string;
    userId: string;
    joinedAt: string;
    user: Pick<User, "id" | "username" | "displayName" | "avatarUrl" | "lastSeen">;
  }[];
  messages: Message[];
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export type CallStatus = "idle" | "calling" | "ringing" | "connected" | "ended";

export interface CallInfo {
  callId: string;
  peer: Pick<User, "id" | "username" | "displayName" | "avatarUrl">;
  callType: string;
  isCaller: boolean;
}

export interface CallHistoryEntry {
  id: string;
  callerId: string;
  calleeId: string;
  callType: string;
  status: string;
  duration: number;
  startedAt: string;
  endedAt: string | null;
  caller: Pick<User, "id" | "username" | "displayName" | "avatarUrl">;
  callee: Pick<User, "id" | "username" | "displayName" | "avatarUrl">;
}

export function isFileMessage(content: string): FileMessageMetadata | null {
  try {
    const parsed = JSON.parse(content);
    if (parsed && parsed.type === "file") return parsed as FileMessageMetadata;
    return null;
  } catch {
    return null;
  }
}
