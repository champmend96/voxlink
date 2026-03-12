export interface User {
  id: string;
  username: string;
  email?: string;
  displayName: string | null;
  avatarUrl: string | null;
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
