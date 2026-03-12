import { v4 as uuidv4 } from "crypto";

// Use crypto.randomUUID for generating test UUIDs
function uuid(): string {
  return crypto.randomUUID();
}

export const testUsers = {
  alice: {
    id: uuid(),
    username: "alice",
    email: "alice@example.com",
    password: "SecurePass1",
    displayName: "Alice Smith",
    passwordHash: "$2a$12$LJ3m4ys7e/m.MFnR9p77SOhobqI5t1L6B8iGRJWxR.LD6Mu6CLJ2.", // SecurePass1
    avatarUrl: null,
    publicKey: "base64-public-key-alice",
    failedLoginAttempts: 0,
    lockedUntil: null,
    lastSeen: new Date(),
    createdAt: new Date(),
  },
  bob: {
    id: uuid(),
    username: "bob",
    email: "bob@example.com",
    password: "SecurePass2",
    displayName: "Bob Jones",
    passwordHash: "$2a$12$LJ3m4ys7e/m.MFnR9p77SOhobqI5t1L6B8iGRJWxR.LD6Mu6CLJ2.",
    avatarUrl: null,
    publicKey: "base64-public-key-bob",
    failedLoginAttempts: 0,
    lockedUntil: null,
    lastSeen: new Date(),
    createdAt: new Date(),
  },
  charlie: {
    id: uuid(),
    username: "charlie",
    email: "charlie@example.com",
    password: "SecurePass3",
    displayName: "Charlie Brown",
    passwordHash: "$2a$12$LJ3m4ys7e/m.MFnR9p77SOhobqI5t1L6B8iGRJWxR.LD6Mu6CLJ2.",
    avatarUrl: null,
    publicKey: null,
    failedLoginAttempts: 0,
    lockedUntil: null,
    lastSeen: new Date(),
    createdAt: new Date(),
  },
  locked: {
    id: uuid(),
    username: "locked",
    email: "locked@example.com",
    password: "SecurePass4",
    displayName: "Locked User",
    passwordHash: "$2a$12$LJ3m4ys7e/m.MFnR9p77SOhobqI5t1L6B8iGRJWxR.LD6Mu6CLJ2.",
    avatarUrl: null,
    publicKey: null,
    failedLoginAttempts: 5,
    lockedUntil: new Date(Date.now() + 15 * 60 * 1000), // locked for 15 min
    lastSeen: new Date(),
    createdAt: new Date(),
  },
};

export const testConversations = {
  aliceBob: {
    id: uuid(),
    name: null,
    isGroup: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  group: {
    id: uuid(),
    name: "Team Chat",
    isGroup: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
};

export const testMessages = [
  {
    id: uuid(),
    conversationId: testConversations.aliceBob.id,
    senderId: testUsers.alice.id,
    content: "Hello Bob!",
    readBy: [testUsers.alice.id],
    createdAt: new Date(Date.now() - 60000),
  },
  {
    id: uuid(),
    conversationId: testConversations.aliceBob.id,
    senderId: testUsers.bob.id,
    content: "Hey Alice!",
    readBy: [testUsers.bob.id],
    createdAt: new Date(Date.now() - 30000),
  },
  {
    id: uuid(),
    conversationId: testConversations.aliceBob.id,
    senderId: testUsers.alice.id,
    content: JSON.stringify({
      type: "file",
      filename: "photo.jpg",
      mimeType: "image/jpeg",
      size: 1024000,
      thumbnailUrl: "/uploads/thumbnails/thumb_abc123.jpg",
      downloadUrl: "/uploads/abc123.jpg",
    }),
    readBy: [testUsers.alice.id],
    createdAt: new Date(),
  },
];

export const testCallHistory = [
  {
    id: uuid(),
    callerId: testUsers.alice.id,
    calleeId: testUsers.bob.id,
    callType: "audio",
    status: "completed",
    duration: 120,
    startedAt: new Date(Date.now() - 3600000),
    endedAt: new Date(Date.now() - 3600000 + 120000),
  },
  {
    id: uuid(),
    callerId: testUsers.bob.id,
    calleeId: testUsers.alice.id,
    callType: "video",
    status: "missed",
    duration: 0,
    startedAt: new Date(Date.now() - 7200000),
    endedAt: null,
  },
];
