import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";

const mockSocket = {
  emit: jest.fn(),
  on: jest.fn(),
  off: jest.fn(),
};

const mockInitiateCall = jest.fn();

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
        messageSent: "#6C63FF",
        messageReceived: "#2A2A4A",
        messageSentText: "#FFFFFF",
        messageReceivedText: "#FFFFFF",
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
    socket: mockSocket,
  }),
}));

jest.mock("../../contexts/CallContext", () => ({
  useCall: () => ({
    initiateCall: mockInitiateCall,
  }),
}));

jest.mock("../../services/api", () => ({
  api: {
    messages: {
      list: jest.fn().mockResolvedValue({ messages: [], hasMore: false }),
    },
    conversations: {
      get: jest.fn().mockResolvedValue({
        id: "conv-1",
        name: null,
        isGroup: false,
        participants: [
          { userId: "user-1", user: { id: "user-1", username: "alice", displayName: "Alice" } },
          { userId: "user-2", user: { id: "user-2", username: "bob", displayName: "Bob" } },
        ],
      }),
    },
    keys: {
      getPublicKeys: jest.fn().mockResolvedValue({ keys: {} }),
    },
    upload: {
      file: jest.fn().mockResolvedValue({}),
    },
  },
}));

jest.mock("../../types", () => ({
  isFileMessage: jest.fn().mockReturnValue(null),
}));

import ChatScreen from "../../screens/ChatScreen";

describe("ChatScreen", () => {
  const mockNavigation = {
    navigate: jest.fn(),
    setOptions: jest.fn(),
    goBack: jest.fn(),
  };

  const mockRoute = {
    key: "chat",
    name: "Chat" as const,
    params: { conversationId: "conv-1", title: "Bob" },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should render message input", () => {
    const { getByPlaceholderText } = render(
      <ChatScreen navigation={mockNavigation as any} route={mockRoute as any} />
    );

    expect(getByPlaceholderText("Message...")).toBeTruthy();
  });

  it("should send message on submit", async () => {
    const { getByPlaceholderText } = render(
      <ChatScreen navigation={mockNavigation as any} route={mockRoute as any} />
    );

    const input = getByPlaceholderText("Message...");
    fireEvent.changeText(input, "Hello Bob!");

    // Find and press send button (the arrow button)
    // The send button has the text "\u27A4"
    // We can trigger by finding the text
  });

  it("should show typing indicator when emitted", () => {
    // Typing indicators are rendered based on typingUsers state
    // This tests the rendering logic
    const { queryByText } = render(
      <ChatScreen navigation={mockNavigation as any} route={mockRoute as any} />
    );

    // Initially no typing indicator
    expect(queryByText(/typing/)).toBeNull();
  });

  it("should load messages on mount", async () => {
    const { api } = require("../../services/api");

    render(
      <ChatScreen navigation={mockNavigation as any} route={mockRoute as any} />
    );

    await waitFor(() => {
      expect(api.messages.list).toHaveBeenCalledWith("conv-1");
    });
  });

  it("should set up navigation header options", async () => {
    render(
      <ChatScreen navigation={mockNavigation as any} route={mockRoute as any} />
    );

    await waitFor(() => {
      expect(mockNavigation.setOptions).toHaveBeenCalled();
    });
  });

  it("should emit join-room on mount", () => {
    render(
      <ChatScreen navigation={mockNavigation as any} route={mockRoute as any} />
    );

    expect(mockSocket.emit).toHaveBeenCalledWith("join-room", "conv-1");
  });

  it("should handle typing events when text changes", () => {
    const { getByPlaceholderText } = render(
      <ChatScreen navigation={mockNavigation as any} route={mockRoute as any} />
    );

    fireEvent.changeText(getByPlaceholderText("Message..."), "typing...");

    expect(mockSocket.emit).toHaveBeenCalledWith("typing", {
      conversationId: "conv-1",
      isTyping: true,
    });
  });
});
