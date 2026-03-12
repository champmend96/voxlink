import {
  RTCPeerConnection,
  RTCSessionDescription,
  RTCIceCandidate,
  mediaDevices,
  MediaStream,
} from "react-native-webrtc";
import { api } from "./api";

const DEFAULT_ICE_SERVERS = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

export type CallMediaType = "audio" | "video";

export class WebRTCService {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private onIceCandidate: ((candidate: unknown) => void) | null = null;
  private onRemoteStream: ((stream: MediaStream) => void) | null = null;
  private onConnectionStateChange: ((state: string) => void) | null = null;
  private callMediaType: CallMediaType = "audio";

  async initialize(
    handlers: {
      onIceCandidate: (candidate: unknown) => void;
      onRemoteStream: (stream: MediaStream) => void;
      onConnectionStateChange: (state: string) => void;
    },
    mediaType: CallMediaType = "audio"
  ): Promise<void> {
    this.onIceCandidate = handlers.onIceCandidate;
    this.onRemoteStream = handlers.onRemoteStream;
    this.onConnectionStateChange = handlers.onConnectionStateChange;
    this.callMediaType = mediaType;

    // Fetch ICE server config from backend (includes TURN credentials)
    let iceConfig = DEFAULT_ICE_SERVERS;
    try {
      const config = await api.ice.getConfig();
      if (config.iceServers && config.iceServers.length > 0) {
        iceConfig = { iceServers: config.iceServers as any };
      }
    } catch {
      // Fall back to default STUN
    }

    this.peerConnection = new RTCPeerConnection(iceConfig);

    this.peerConnection.addEventListener("icecandidate", (event: any) => {
      if (event.candidate && this.onIceCandidate) {
        this.onIceCandidate(event.candidate);
      }
    });

    this.peerConnection.addEventListener("track", (event: any) => {
      if (event.streams && event.streams[0] && this.onRemoteStream) {
        this.onRemoteStream(event.streams[0]);
      }
    });

    this.peerConnection.addEventListener("connectionstatechange", () => {
      if (this.peerConnection && this.onConnectionStateChange) {
        this.onConnectionStateChange(this.peerConnection.connectionState);
      }
    });

    await this.setupLocalStream();
  }

  private async setupLocalStream(): Promise<void> {
    const isVideo = this.callMediaType === "video";
    const stream = await mediaDevices.getUserMedia({
      audio: true,
      video: isVideo ? { facingMode: "user" } : false,
    });

    this.localStream = stream as MediaStream;

    if (this.peerConnection) {
      this.localStream.getTracks().forEach((track) => {
        this.peerConnection!.addTrack(track, this.localStream!);
      });
    }
  }

  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  async createOffer(): Promise<RTCSessionDescription> {
    if (!this.peerConnection) throw new Error("PeerConnection not initialized");

    const isVideo = this.callMediaType === "video";
    const offer = await this.peerConnection.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: isVideo,
    });
    await this.peerConnection.setLocalDescription(offer);
    return offer as RTCSessionDescription;
  }

  async createAnswer(): Promise<RTCSessionDescription> {
    if (!this.peerConnection) throw new Error("PeerConnection not initialized");

    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);
    return answer as RTCSessionDescription;
  }

  async setRemoteDescription(sdp: any): Promise<void> {
    if (!this.peerConnection) throw new Error("PeerConnection not initialized");
    await this.peerConnection.setRemoteDescription(
      new RTCSessionDescription(sdp)
    );
  }

  async addIceCandidate(candidate: any): Promise<void> {
    if (!this.peerConnection) return;
    try {
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.error("Error adding ICE candidate:", err);
    }
  }

  toggleMute(): boolean {
    if (!this.localStream) return false;
    const audioTrack = this.localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      return !audioTrack.enabled;
    }
    return false;
  }

  toggleVideo(): boolean {
    if (!this.localStream) return false;
    const videoTrack = this.localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      return videoTrack.enabled;
    }
    return false;
  }

  async switchCamera(): Promise<void> {
    if (!this.localStream) return;
    const videoTrack = this.localStream.getVideoTracks()[0];
    if (videoTrack && typeof (videoTrack as any)._switchCamera === "function") {
      (videoTrack as any)._switchCamera();
    }
  }

  cleanup(): void {
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }

    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    this.onIceCandidate = null;
    this.onRemoteStream = null;
    this.onConnectionStateChange = null;
  }
}
