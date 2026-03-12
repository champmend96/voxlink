import React from "react";
import { render, fireEvent } from "@testing-library/react-native";

// ── Common mocks ──

const mockEndCall = jest.fn();
const mockAcceptCall = jest.fn();
const mockRejectCall = jest.fn();
const mockToggleMute = jest.fn();
const mockToggleSpeaker = jest.fn();
const mockToggleVideo = jest.fn();
const mockSwitchCamera = jest.fn();

const mockCallInfo = {
  callId: "call-123",
  peer: { id: "user-2", username: "bob", displayName: "Bob", avatarUrl: null },
  callType: "audio",
  isCaller: true,
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
        notification: "#EF4444",
        online: "#22C55E",
      },
    },
  }),
}));

const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  replace: jest.fn(),
  addListener: jest.fn().mockReturnValue(jest.fn()),
};

// ── OutgoingCallScreen ──

describe("OutgoingCallScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mock("../../contexts/CallContext", () => ({
      useCall: () => ({
        callStatus: "calling",
        callInfo: mockCallInfo,
        localStream: null,
        isVideoEnabled: false,
        isFrontCamera: true,
        endCall: mockEndCall,
      }),
    }));
  });

  it("should show callee info", () => {
    const OutgoingCallScreen = require("../../screens/OutgoingCallScreen").default;
    const { getByText } = render(
      <OutgoingCallScreen navigation={mockNavigation as any} />
    );

    expect(getByText("Bob")).toBeTruthy();
    expect(getByText("Calling...")).toBeTruthy();
  });

  it("should show cancel button", () => {
    const OutgoingCallScreen = require("../../screens/OutgoingCallScreen").default;
    const { getByText } = render(
      <OutgoingCallScreen navigation={mockNavigation as any} />
    );

    expect(getByText("Cancel")).toBeTruthy();
  });

  it("should call endCall when cancel is pressed", () => {
    const OutgoingCallScreen = require("../../screens/OutgoingCallScreen").default;
    const { getByText } = render(
      <OutgoingCallScreen navigation={mockNavigation as any} />
    );

    fireEvent.press(getByText("Cancel"));
    expect(mockEndCall).toHaveBeenCalled();
  });
});

// ── IncomingCallScreen ──

describe("IncomingCallScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mock("../../contexts/CallContext", () => ({
      useCall: () => ({
        callStatus: "ringing",
        callInfo: {
          ...mockCallInfo,
          isCaller: false,
        },
        acceptCall: mockAcceptCall,
        rejectCall: mockRejectCall,
      }),
    }));
  });

  it("should show caller info", () => {
    const IncomingCallScreen = require("../../screens/IncomingCallScreen").default;
    const { getByText } = render(
      <IncomingCallScreen navigation={mockNavigation as any} />
    );

    expect(getByText("Bob")).toBeTruthy();
  });

  it("should show accept and decline buttons", () => {
    const IncomingCallScreen = require("../../screens/IncomingCallScreen").default;
    const { getByText } = render(
      <IncomingCallScreen navigation={mockNavigation as any} />
    );

    expect(getByText("Accept")).toBeTruthy();
    expect(getByText("Decline")).toBeTruthy();
  });

  it("should call acceptCall on accept press", () => {
    const IncomingCallScreen = require("../../screens/IncomingCallScreen").default;
    const { getByText } = render(
      <IncomingCallScreen navigation={mockNavigation as any} />
    );

    fireEvent.press(getByText("Accept"));
    expect(mockAcceptCall).toHaveBeenCalled();
  });

  it("should call rejectCall on decline press", () => {
    const IncomingCallScreen = require("../../screens/IncomingCallScreen").default;
    const { getByText } = render(
      <IncomingCallScreen navigation={mockNavigation as any} />
    );

    fireEvent.press(getByText("Decline"));
    expect(mockRejectCall).toHaveBeenCalled();
  });
});

// ── ActiveCallScreen ──

describe("ActiveCallScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mock("../../contexts/CallContext", () => ({
      useCall: () => ({
        callStatus: "connected",
        callInfo: mockCallInfo,
        duration: 65,
        isMuted: false,
        isSpeaker: false,
        isVideoEnabled: false,
        isFrontCamera: true,
        localStream: null,
        remoteStream: null,
        remoteVideoEnabled: false,
        endCall: mockEndCall,
        toggleMute: mockToggleMute,
        toggleSpeaker: mockToggleSpeaker,
        toggleVideo: mockToggleVideo,
        switchCamera: mockSwitchCamera,
      }),
    }));
  });

  it("should show formatted duration timer", () => {
    const ActiveCallScreen = require("../../screens/ActiveCallScreen").default;
    const { getByText } = render(
      <ActiveCallScreen navigation={mockNavigation as any} />
    );

    // 65 seconds = 01:05
    expect(getByText("01:05")).toBeTruthy();
  });

  it("should show peer name", () => {
    const ActiveCallScreen = require("../../screens/ActiveCallScreen").default;
    const { getByText } = render(
      <ActiveCallScreen navigation={mockNavigation as any} />
    );

    expect(getByText("Bob")).toBeTruthy();
  });

  it("should show mute button", () => {
    const ActiveCallScreen = require("../../screens/ActiveCallScreen").default;
    const { getByText } = render(
      <ActiveCallScreen navigation={mockNavigation as any} />
    );

    expect(getByText("Mute")).toBeTruthy();
  });

  it("should show end call button", () => {
    const ActiveCallScreen = require("../../screens/ActiveCallScreen").default;
    const { getByText } = render(
      <ActiveCallScreen navigation={mockNavigation as any} />
    );

    expect(getByText("End Call")).toBeTruthy();
  });

  it("should call endCall on end button press", () => {
    const ActiveCallScreen = require("../../screens/ActiveCallScreen").default;
    const { getByText } = render(
      <ActiveCallScreen navigation={mockNavigation as any} />
    );

    fireEvent.press(getByText("End Call"));
    expect(mockEndCall).toHaveBeenCalled();
  });
});
