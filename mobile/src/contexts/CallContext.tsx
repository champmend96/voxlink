import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  useEffect,
  ReactNode,
} from "react";
import { MediaStream } from "react-native-webrtc";
import { useSocket } from "./SocketContext";
import { useAuth } from "./AuthContext";
import { WebRTCService } from "../services/webrtc";
import { CallStatus, CallInfo, User } from "../types";

interface CallContextType {
  callStatus: CallStatus;
  callInfo: CallInfo | null;
  duration: number;
  isMuted: boolean;
  isSpeaker: boolean;
  isVideoEnabled: boolean;
  isFrontCamera: boolean;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  remoteVideoEnabled: boolean;
  initiateCall: (
    calleeId: string,
    callee: Pick<User, "id" | "username" | "displayName" | "avatarUrl">,
    callType?: string
  ) => void;
  acceptCall: () => void;
  rejectCall: () => void;
  endCall: () => void;
  toggleMute: () => void;
  toggleSpeaker: () => void;
  toggleVideo: () => void;
  switchCamera: () => void;
}

const CallContext = createContext<CallContextType>({
  callStatus: "idle",
  callInfo: null,
  duration: 0,
  isMuted: false,
  isSpeaker: false,
  isVideoEnabled: false,
  isFrontCamera: true,
  localStream: null,
  remoteStream: null,
  remoteVideoEnabled: false,
  initiateCall: () => {},
  acceptCall: () => {},
  rejectCall: () => {},
  endCall: () => {},
  toggleMute: () => {},
  toggleSpeaker: () => {},
  toggleVideo: () => {},
  switchCamera: () => {},
});

export function CallProvider({ children }: { children: ReactNode }) {
  const { socket } = useSocket();
  const { user } = useAuth();
  const [callStatus, setCallStatus] = useState<CallStatus>("idle");
  const [callInfo, setCallInfo] = useState<CallInfo | null>(null);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [isFrontCamera, setIsFrontCamera] = useState(true);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [remoteVideoEnabled, setRemoteVideoEnabled] = useState(false);

  const webrtcRef = useRef<WebRTCService | null>(null);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval>>();
  const iceCandidateQueueRef = useRef<unknown[]>([]);
  const endCallRef = useRef<() => void>(() => {});

  const cleanup = useCallback(() => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = undefined;
    }
    if (webrtcRef.current) {
      webrtcRef.current.cleanup();
      webrtcRef.current = null;
    }
    iceCandidateQueueRef.current = [];
    setCallStatus("idle");
    setCallInfo(null);
    setDuration(0);
    setIsMuted(false);
    setIsSpeaker(false);
    setIsVideoEnabled(false);
    setIsFrontCamera(true);
    setLocalStream(null);
    setRemoteStream(null);
    setRemoteVideoEnabled(false);
  }, []);

  const startDurationTimer = useCallback(() => {
    setDuration(0);
    durationIntervalRef.current = setInterval(() => {
      setDuration((d) => d + 1);
    }, 1000);
  }, []);

  const initWebRTC = useCallback(
    async (currentCallId: string, callType: string = "audio") => {
      const service = new WebRTCService();
      webrtcRef.current = service;

      const mediaType = callType === "video" ? "video" : "audio";

      await service.initialize(
        {
          onIceCandidate: (candidate) => {
            socket?.emit("ice-candidate", { callId: currentCallId, candidate });
          },
          onRemoteStream: (stream) => {
            setRemoteStream(stream);
          },
          onConnectionStateChange: (state) => {
            if (state === "disconnected" || state === "failed") {
              endCallRef.current();
            }
          },
        },
        mediaType
      );

      const stream = service.getLocalStream();
      setLocalStream(stream);

      if (callType === "video") {
        setIsVideoEnabled(true);
        setRemoteVideoEnabled(true);
      }

      return service;
    },
    [socket]
  );

  const initiateCall = useCallback(
    async (
      calleeId: string,
      callee: Pick<User, "id" | "username" | "displayName" | "avatarUrl">,
      callType: string = "audio"
    ) => {
      if (!socket || callStatus !== "idle") return;

      setCallStatus("calling");
      setCallInfo({
        callId: "",
        peer: callee,
        callType,
        isCaller: true,
      });

      if (callType === "video") {
        setIsVideoEnabled(true);
      }

      socket.emit("call-initiate", { calleeId, callType });
    },
    [socket, callStatus]
  );

  const acceptCall = useCallback(async () => {
    if (!socket || !callInfo || callStatus !== "ringing") return;

    try {
      const service = await initWebRTC(callInfo.callId, callInfo.callType);

      // Process queued ICE candidates
      for (const candidate of iceCandidateQueueRef.current) {
        await service.addIceCandidate(candidate);
      }
      iceCandidateQueueRef.current = [];

      const answer = await service.createAnswer();
      socket.emit("call-answer", { callId: callInfo.callId, sdp: answer });

      setCallStatus("connected");
      startDurationTimer();
    } catch (err) {
      console.error("Error accepting call:", err);
      cleanup();
    }
  }, [socket, callInfo, callStatus, initWebRTC, startDurationTimer, cleanup]);

  const rejectCall = useCallback(() => {
    if (!socket || !callInfo) return;
    socket.emit("call-reject", { callId: callInfo.callId });
    cleanup();
  }, [socket, callInfo, cleanup]);

  const endCall = useCallback(() => {
    if (!socket || !callInfo) return;
    socket.emit("call-end", { callId: callInfo.callId });
    cleanup();
  }, [socket, callInfo, cleanup]);

  endCallRef.current = endCall;

  const toggleMute = useCallback(() => {
    if (webrtcRef.current) {
      const muted = webrtcRef.current.toggleMute();
      setIsMuted(muted);
    }
  }, []);

  const toggleSpeaker = useCallback(() => {
    setIsSpeaker((prev) => !prev);
  }, []);

  const toggleVideo = useCallback(() => {
    if (webrtcRef.current) {
      const enabled = webrtcRef.current.toggleVideo();
      setIsVideoEnabled(enabled);

      if (socket && callInfo) {
        socket.emit("call-toggle-video", {
          callId: callInfo.callId,
          videoEnabled: enabled,
        });
      }
    }
  }, [socket, callInfo]);

  const switchCamera = useCallback(async () => {
    if (webrtcRef.current) {
      await webrtcRef.current.switchCamera();
      setIsFrontCamera((prev) => !prev);
    }
  }, []);

  // Socket event listeners
  useEffect(() => {
    if (!socket) return;

    function onCallInitiated(data: { callId: string; calleeId: string }) {
      setCallInfo((prev) =>
        prev ? { ...prev, callId: data.callId } : null
      );

      // Now init WebRTC and create offer
      (async () => {
        try {
          setCallInfo((prev) => {
            const callType = prev?.callType || "audio";
            (async () => {
              try {
                const service = await initWebRTC(data.callId, callType);
                const offer = await service.createOffer();
                socket!.emit("call-offer", { callId: data.callId, sdp: offer });
              } catch (err) {
                console.error("Error creating offer:", err);
                cleanup();
              }
            })();
            return prev ? { ...prev, callId: data.callId } : null;
          });
        } catch (err) {
          console.error("Error in call initiated handler:", err);
          cleanup();
        }
      })();
    }

    function onCallIncoming(data: {
      callId: string;
      caller: Pick<User, "id" | "username" | "displayName" | "avatarUrl">;
      callType: string;
    }) {
      if (callStatus !== "idle") {
        socket!.emit("call-reject", { callId: data.callId });
        return;
      }

      setCallStatus("ringing");
      setCallInfo({
        callId: data.callId,
        peer: data.caller,
        callType: data.callType,
        isCaller: false,
      });
    }

    function onCallOffer(data: { callId: string; sdp: unknown }) {
      if (webrtcRef.current) {
        webrtcRef.current.setRemoteDescription(data.sdp);
      }
    }

    function onCallAnswer(data: { callId: string; sdp: unknown }) {
      if (webrtcRef.current) {
        webrtcRef.current.setRemoteDescription(data.sdp);
        setCallStatus("connected");
        startDurationTimer();
      }
    }

    function onIceCandidate(data: { callId: string; candidate: unknown }) {
      if (webrtcRef.current) {
        webrtcRef.current.addIceCandidate(data.candidate);
      } else {
        iceCandidateQueueRef.current.push(data.candidate);
      }
    }

    function onCallRejected(_data: { callId: string }) {
      cleanup();
    }

    function onCallEnded(_data: { callId: string }) {
      cleanup();
    }

    function onCallBusy(_data: { calleeId: string }) {
      cleanup();
    }

    function onCallTimeout(_data: { callId: string }) {
      cleanup();
    }

    function onCallError(_data: { message: string }) {
      cleanup();
    }

    function onCallToggleVideo(data: {
      callId: string;
      userId: string;
      videoEnabled: boolean;
    }) {
      setRemoteVideoEnabled(data.videoEnabled);
    }

    socket.on("call-initiated", onCallInitiated);
    socket.on("call-incoming", onCallIncoming);
    socket.on("call-offer", onCallOffer);
    socket.on("call-answer", onCallAnswer);
    socket.on("ice-candidate", onIceCandidate);
    socket.on("call-rejected", onCallRejected);
    socket.on("call-ended", onCallEnded);
    socket.on("call-busy", onCallBusy);
    socket.on("call-timeout", onCallTimeout);
    socket.on("call-error", onCallError);
    socket.on("call-toggle-video", onCallToggleVideo);

    return () => {
      socket.off("call-initiated", onCallInitiated);
      socket.off("call-incoming", onCallIncoming);
      socket.off("call-offer", onCallOffer);
      socket.off("call-answer", onCallAnswer);
      socket.off("ice-candidate", onIceCandidate);
      socket.off("call-rejected", onCallRejected);
      socket.off("call-ended", onCallEnded);
      socket.off("call-busy", onCallBusy);
      socket.off("call-timeout", onCallTimeout);
      socket.off("call-error", onCallError);
      socket.off("call-toggle-video", onCallToggleVideo);
    };
  }, [socket, callStatus, initWebRTC, startDurationTimer, cleanup]);

  return (
    <CallContext.Provider
      value={{
        callStatus,
        callInfo,
        duration,
        isMuted,
        isSpeaker,
        isVideoEnabled,
        isFrontCamera,
        localStream,
        remoteStream,
        remoteVideoEnabled,
        initiateCall,
        acceptCall,
        rejectCall,
        endCall,
        toggleMute,
        toggleSpeaker,
        toggleVideo,
        switchCamera,
      }}
    >
      {children}
    </CallContext.Provider>
  );
}

export const useCall = () => useContext(CallContext);
