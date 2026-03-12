import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  useEffect,
  ReactNode,
} from "react";
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
}

const CallContext = createContext<CallContextType>({
  callStatus: "idle",
  callInfo: null,
  duration: 0,
  isMuted: false,
  isSpeaker: false,
  initiateCall: () => {},
  acceptCall: () => {},
  rejectCall: () => {},
  endCall: () => {},
  toggleMute: () => {},
  toggleSpeaker: () => {},
});

export function CallProvider({ children }: { children: ReactNode }) {
  const { socket } = useSocket();
  const { user } = useAuth();
  const [callStatus, setCallStatus] = useState<CallStatus>("idle");
  const [callInfo, setCallInfo] = useState<CallInfo | null>(null);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(false);

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
  }, []);

  const startDurationTimer = useCallback(() => {
    setDuration(0);
    durationIntervalRef.current = setInterval(() => {
      setDuration((d) => d + 1);
    }, 1000);
  }, []);

  const initWebRTC = useCallback(
    async (currentCallId: string) => {
      const service = new WebRTCService();
      webrtcRef.current = service;

      await service.initialize({
        onIceCandidate: (candidate) => {
          socket?.emit("ice-candidate", { callId: currentCallId, candidate });
        },
        onRemoteStream: () => {
          // Audio streams play automatically
        },
        onConnectionStateChange: (state) => {
          if (state === "disconnected" || state === "failed") {
            endCallRef.current();
          }
        },
      });

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

      socket.emit("call-initiate", { calleeId, callType });
    },
    [socket, callStatus]
  );

  const acceptCall = useCallback(async () => {
    if (!socket || !callInfo || callStatus !== "ringing") return;

    try {
      const service = await initWebRTC(callInfo.callId);

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
          const service = await initWebRTC(data.callId);
          const offer = await service.createOffer();
          socket!.emit("call-offer", { callId: data.callId, sdp: offer });
        } catch (err) {
          console.error("Error creating offer:", err);
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
        initiateCall,
        acceptCall,
        rejectCall,
        endCall,
        toggleMute,
        toggleSpeaker,
      }}
    >
      {children}
    </CallContext.Provider>
  );
}

export const useCall = () => useContext(CallContext);
