import React from "react";
import { render, waitFor } from "@testing-library/react-native";

jest.mock("../../contexts/ThemeContext", () => ({
  useTheme: () => ({
    theme: {
      colors: {
        background: "#1A1A2E",
        primary: "#6C63FF",
        text: "#FFFFFF",
        textSecondary: "#888",
        inputBg: "#2A2A4A",
        border: "#333",
        card: "#2A2A4A",
        online: "#22C55E",
      },
    },
  }),
}));

jest.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "user-1", username: "alice" },
  }),
}));

jest.mock("../../contexts/SocketContext", () => ({
  useSocket: () => ({
    onlineUsers: new Set(["user-2"]),
  }),
}));

const mockConversations = [
  {
    id: "conv-1",
    name: null,
    isGroup: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    participants: [
      { userId: "user-1", user: { id: "user-1", username: "alice", displayName: "Alice", avatarUrl: null, lastSeen: new Date().toISOString() } },
      { userId: "user-2", user: { id: "user-2", username: "bob", displayName: "Bob", avatarUrl: null, lastSeen: new Date().toISOString() } },
    ],
    messages: [{ id: "msg-1", content: "Last message here", createdAt: new Date().toISOString() }],
  },
];

jest.mock("../../services/api", () => ({
  api: {
    conversations: {
      list: jest.fn().mockResolvedValue(mockConversations),
      create: jest.fn(),
    },
    users: {
      list: jest.fn().mockResolvedValue([]),
    },
  },
}));

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useFocusEffect: (cb: () => any) => {
    // Execute the callback immediately for testing
    React.useEffect(cb, []);
  },
}));

import ConversationListScreen from "../../screens/ConversationListScreen";

describe("ConversationListScreen", () => {
  const mockNavigation = {
    navigate: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should render conversation list", async () => {
    const { getByText } = render(
      <ConversationListScreen navigation={mockNavigation as any} />
    );

    await waitFor(() => {
      expect(getByText("Bob")).toBeTruthy();
    });
  });

  it("should show last message preview", async () => {
    const { getByText } = render(
      <ConversationListScreen navigation={mockNavigation as any} />
    );

    await waitFor(() => {
      expect(getByText("Last message here")).toBeTruthy();
    });
  });

  it("should render new chat button", () => {
    const { getByText } = render(
      <ConversationListScreen navigation={mockNavigation as any} />
    );

    expect(getByText("+ New Chat")).toBeTruthy();
  });

  it("should load conversations on focus", async () => {
    const { api } = require("../../services/api");

    render(
      <ConversationListScreen navigation={mockNavigation as any} />
    );

    await waitFor(() => {
      expect(api.conversations.list).toHaveBeenCalled();
    });
  });
});
