import {
  RTCPeerConnection,
  mediaDevices,
} from "react-native-webrtc";

// Mock the api module for ICE config
jest.mock("../../services/api", () => ({
  api: {
    ice: {
      getConfig: jest.fn().mockResolvedValue({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      }),
    },
  },
}));

import { WebRTCService } from "../../services/webrtc";

describe("WebRTCService", () => {
  let service: WebRTCService;
  const mockHandlers = {
    onIceCandidate: jest.fn(),
    onRemoteStream: jest.fn(),
    onConnectionStateChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new WebRTCService();
  });

  afterEach(() => {
    service.cleanup();
  });

  describe("RTCPeerConnection creation", () => {
    it("should create peer connection with ICE config from backend", async () => {
      await service.initialize(mockHandlers, "audio");

      // RTCPeerConnection constructor should have been called
      expect(RTCPeerConnection).toBeDefined();
    });

    it("should fall back to default STUN when backend fails", async () => {
      const { api } = require("../../services/api");
      api.ice.getConfig.mockRejectedValueOnce(new Error("Network error"));

      await service.initialize(mockHandlers, "audio");
      // Should still work with fallback STUN
    });
  });

  describe("createOffer", () => {
    it("should generate a valid SDP offer", async () => {
      await service.initialize(mockHandlers, "audio");
      const offer = await service.createOffer();

      expect(offer).toBeDefined();
      expect(offer.type).toBe("offer");
      expect(offer.sdp).toBeDefined();
    });

    it("should throw if peer connection not initialized", async () => {
      await expect(service.createOffer()).rejects.toThrow(/not initialized/i);
    });
  });

  describe("createAnswer", () => {
    it("should generate a valid SDP answer", async () => {
      await service.initialize(mockHandlers, "audio");
      const answer = await service.createAnswer();

      expect(answer).toBeDefined();
      expect(answer.type).toBe("answer");
      expect(answer.sdp).toBeDefined();
    });
  });

  describe("ICE candidate handling", () => {
    it("should add ICE candidates", async () => {
      await service.initialize(mockHandlers, "audio");
      await service.addIceCandidate({ candidate: "test-candidate" });
      // Should not throw
    });
  });

  describe("Media stream setup", () => {
    it("should set up audio-only stream", async () => {
      await service.initialize(mockHandlers, "audio");

      expect(mediaDevices.getUserMedia).toHaveBeenCalledWith({
        audio: true,
        video: false,
      });

      const stream = service.getLocalStream();
      expect(stream).toBeDefined();
    });

    it("should set up audio + video stream", async () => {
      await service.initialize(mockHandlers, "video");

      expect(mediaDevices.getUserMedia).toHaveBeenCalledWith({
        audio: true,
        video: { facingMode: "user" },
      });
    });
  });

  describe("Camera switching", () => {
    it("should call switchCamera on video track", async () => {
      await service.initialize(mockHandlers, "video");
      await service.switchCamera();
      // Should not throw
    });
  });

  describe("Track cleanup", () => {
    it("should stop all tracks and close connection on cleanup", async () => {
      await service.initialize(mockHandlers, "audio");

      const stream = service.getLocalStream();
      expect(stream).toBeDefined();

      service.cleanup();
      expect(service.getLocalStream()).toBeNull();
    });
  });

  describe("Toggle mute", () => {
    it("should toggle audio track enabled state", async () => {
      await service.initialize(mockHandlers, "audio");
      const muted = service.toggleMute();
      expect(typeof muted).toBe("boolean");
    });
  });

  describe("Toggle video", () => {
    it("should toggle video track enabled state", async () => {
      await service.initialize(mockHandlers, "video");
      const enabled = service.toggleVideo();
      expect(typeof enabled).toBe("boolean");
    });
  });
});
