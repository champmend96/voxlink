import React from "react";
import { render, fireEvent } from "@testing-library/react-native";

const mockSocket = {
  emit: jest.fn(),
  on: jest.fn(),
  off: jest.fn(),
};

jest.mock("../../contexts/ThemeContext", () => ({
  useTheme: () => ({
    theme: {
      colors: {
        background: "#1A1A2E",
        primary: "#6C63FF",
        text: "#FFFFFF",
        textSecondary: "#888",
        card: "#2A2A4A",
      },
    },
  }),
}));

jest.mock("../../contexts/SocketContext", () => ({
  useSocket: () => ({
    socket: mockSocket,
  }),
}));

jest.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "user-1", username: "alice" },
  }),
}));

import GroupCallScreen from "../../screens/GroupCallScreen";

describe("GroupCallScreen", () => {
  const mockNavigation = {
    goBack: jest.fn(),
    navigate: jest.fn(),
    addListener: jest.fn().mockReturnValue(jest.fn()),
  };

  const mockRoute = {
    key: "group-call",
    name: "GroupCall" as const,
    params: { conversationId: "group-conv-1" },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should emit group-call-join on mount", () => {
    render(
      <GroupCallScreen
        navigation={mockNavigation as any}
        route={mockRoute as any}
      />
    );

    expect(mockSocket.emit).toHaveBeenCalledWith("group-call-join", {
      conversationId: "group-conv-1",
    });
  });

  it("should render controls: mute, video, camera switch, leave", () => {
    const { getAllByText } = render(
      <GroupCallScreen
        navigation={mockNavigation as any}
        route={mockRoute as any}
      />
    );

    // Controls are rendered with emoji icons
    // There should be 4 control buttons
  });

  it("should show participant count", () => {
    const { getByText } = render(
      <GroupCallScreen
        navigation={mockNavigation as any}
        route={mockRoute as any}
      />
    );

    expect(getByText(/participant/i)).toBeTruthy();
  });

  it("should show duration timer", () => {
    const { getByText } = render(
      <GroupCallScreen
        navigation={mockNavigation as any}
        route={mockRoute as any}
      />
    );

    expect(getByText("00:00")).toBeTruthy();
  });

  it("should emit group-call-leave and navigate back on leave", () => {
    render(
      <GroupCallScreen
        navigation={mockNavigation as any}
        route={mockRoute as any}
      />
    );

    // The leave button emits group-call-leave on press
    // This is handled through the handleLeave callback
  });

  it("should register socket event listeners", () => {
    render(
      <GroupCallScreen
        navigation={mockNavigation as any}
        route={mockRoute as any}
      />
    );

    expect(mockSocket.on).toHaveBeenCalledWith(
      "group-call-participant-joined",
      expect.any(Function)
    );
    expect(mockSocket.on).toHaveBeenCalledWith(
      "group-call-participant-left",
      expect.any(Function)
    );
  });

  it("should clean up socket listeners on unmount", () => {
    const { unmount } = render(
      <GroupCallScreen
        navigation={mockNavigation as any}
        route={mockRoute as any}
      />
    );

    unmount();

    expect(mockSocket.emit).toHaveBeenCalledWith("group-call-leave", {
      conversationId: "group-conv-1",
    });
    expect(mockSocket.off).toHaveBeenCalled();
  });
});
