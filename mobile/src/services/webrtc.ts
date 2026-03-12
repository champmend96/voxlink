import {
  RTCPeerConnection,
  RTCSessionDescription,
  RTCIceCandidate,
  mediaDevices,
  MediaStream,
} from "react-native-webrtc";

const ICE_SERVERS = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

export class WebRTCService {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private onIceCandidate: ((candidate: unknown) => void) | null = null;
  private onRemoteStream: ((stream: MediaStream) => void) | null = null;
  private onConnectionStateChange: ((state: string) => void) | null = null;

  async initialize(handlers: {
    onIceCandidate: (candidate: unknown) => void;
    onRemoteStream: (stream: MediaStream) => void;
    onConnectionStateChange: (state: string) => void;
  }): Promise<void> {
    this.onIceCandidate = handlers.onIceCandidate;
    this.onRemoteStream = handlers.onRemoteStream;
    this.onConnectionStateChange = handlers.onConnectionStateChange;

    this.peerConnection = new RTCPeerConnection(ICE_SERVERS);

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
    const stream = await mediaDevices.getUserMedia({
      audio: true,
      video: false,
    });

    this.localStream = stream as MediaStream;

    if (this.peerConnection) {
      this.localStream.getTracks().forEach((track) => {
        this.peerConnection!.addTrack(track, this.localStream!);
      });
    }
  }

  async createOffer(): Promise<RTCSessionDescription> {
    if (!this.peerConnection) throw new Error("PeerConnection not initialized");

    const offer = await this.peerConnection.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: false,
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
