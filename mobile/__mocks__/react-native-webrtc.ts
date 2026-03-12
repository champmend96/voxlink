const mockTrack = {
  enabled: true,
  stop: jest.fn(),
  _switchCamera: jest.fn(),
};

const mockStream = {
  toURL: jest.fn().mockReturnValue("mock-stream-url"),
  getTracks: jest.fn().mockReturnValue([mockTrack]),
  getAudioTracks: jest.fn().mockReturnValue([{ ...mockTrack, kind: "audio" }]),
  getVideoTracks: jest.fn().mockReturnValue([{ ...mockTrack, kind: "video" }]),
};

export class RTCPeerConnection {
  localDescription: any = null;
  connectionState = "new";

  addEventListener = jest.fn();
  removeEventListener = jest.fn();
  addTrack = jest.fn();
  close = jest.fn();

  createOffer = jest.fn().mockResolvedValue({
    type: "offer",
    sdp: "v=0\r\no=- 0 0 IN IP4 127.0.0.1\r\n",
  });

  createAnswer = jest.fn().mockResolvedValue({
    type: "answer",
    sdp: "v=0\r\no=- 0 0 IN IP4 127.0.0.1\r\n",
  });

  setLocalDescription = jest.fn().mockResolvedValue(undefined);
  setRemoteDescription = jest.fn().mockResolvedValue(undefined);
  addIceCandidate = jest.fn().mockResolvedValue(undefined);
}

export class RTCSessionDescription {
  type: string;
  sdp: string;
  constructor(desc: any) {
    this.type = desc?.type ?? "offer";
    this.sdp = desc?.sdp ?? "";
  }
}

export class RTCIceCandidate {
  candidate: string;
  constructor(candidate: any) {
    this.candidate = candidate?.candidate ?? "";
  }
}

export const mediaDevices = {
  getUserMedia: jest.fn().mockResolvedValue(mockStream),
  enumerateDevices: jest.fn().mockResolvedValue([]),
};

export class MediaStream {
  toURL = jest.fn().mockReturnValue("mock-stream-url");
  getTracks = jest.fn().mockReturnValue([mockTrack]);
  getAudioTracks = jest.fn().mockReturnValue([{ ...mockTrack, kind: "audio" }]);
  getVideoTracks = jest.fn().mockReturnValue([{ ...mockTrack, kind: "video" }]);
}

export const RTCView = "RTCView";
