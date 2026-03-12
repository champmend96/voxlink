import React, { useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  StatusBar,
} from "react-native";
import { RTCView } from "react-native-webrtc";
import { useTheme } from "../contexts/ThemeContext";
import { useCall } from "../contexts/CallContext";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation";

type Props = NativeStackScreenProps<RootStackParamList, "ActiveCall">;

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const PIP_WIDTH = 110;
const PIP_HEIGHT = 155;

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

export default function ActiveCallScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const {
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
    endCall,
    toggleMute,
    toggleSpeaker,
    toggleVideo,
    switchCamera,
  } = useCall();

  const isVideoCall = callInfo?.callType === "video";

  useEffect(() => {
    if (callStatus === "idle" || callStatus === "ended") {
      navigation.goBack();
    }
  }, [callStatus, navigation]);

  const peerName = callInfo?.peer.displayName || callInfo?.peer.username || "Unknown";
  const initial = peerName.charAt(0).toUpperCase();

  const showRemoteVideo = isVideoCall && remoteVideoEnabled && remoteStream;
  const showLocalVideo = isVideoCall && isVideoEnabled && localStream;

  // Full-screen immersive video layout
  if (isVideoCall) {
    return (
      <View style={styles.videoContainer}>
        <StatusBar barStyle="light-content" />

        {/* Remote video or avatar fallback */}
        {showRemoteVideo ? (
          <RTCView
            streamURL={(remoteStream as any).toURL()}
            style={styles.remoteVideo}
            objectFit="cover"
            zOrder={0}
          />
        ) : (
          <View style={[styles.remoteVideoFallback, { backgroundColor: theme.colors.card }]}>
            <View style={[styles.avatarLarge, { backgroundColor: theme.colors.primary }]}>
              <Text style={styles.avatarLargeText}>{initial}</Text>
            </View>
            <Text style={[styles.fallbackName, { color: theme.colors.text }]}>{peerName}</Text>
            {!remoteVideoEnabled && (
              <Text style={[styles.fallbackHint, { color: theme.colors.textSecondary }]}>
                Camera is off
              </Text>
            )}
          </View>
        )}

        {/* Local PiP video */}
        {showLocalVideo && (
          <View style={styles.pipContainer}>
            <RTCView
              streamURL={(localStream as any).toURL()}
              style={styles.pipVideo}
              objectFit="cover"
              zOrder={1}
              mirror={isFrontCamera}
            />
          </View>
        )}

        {/* Duration overlay */}
        <View style={styles.durationOverlay}>
          <Text style={styles.durationText}>{formatDuration(duration)}</Text>
          <Text style={styles.peerNameOverlay}>{peerName}</Text>
        </View>

        {/* Control bar */}
        <View style={styles.videoControlBar}>
          <View style={styles.videoControls}>
            <TouchableOpacity
              style={[
                styles.videoControlButton,
                { backgroundColor: isMuted ? "rgba(239,68,68,0.9)" : "rgba(255,255,255,0.2)" },
              ]}
              onPress={toggleMute}
            >
              <Text style={styles.videoControlIcon}>{isMuted ? "\u{1F507}" : "\u{1F3A4}"}</Text>
              <Text style={styles.videoControlLabel}>{isMuted ? "Unmute" : "Mute"}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.videoControlButton,
                { backgroundColor: isSpeaker ? "rgba(108,99,255,0.9)" : "rgba(255,255,255,0.2)" },
              ]}
              onPress={toggleSpeaker}
            >
              <Text style={styles.videoControlIcon}>{isSpeaker ? "\u{1F50A}" : "\u{1F508}"}</Text>
              <Text style={styles.videoControlLabel}>{isSpeaker ? "Speaker" : "Earpiece"}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.videoControlButton,
                {
                  backgroundColor: isVideoEnabled
                    ? "rgba(255,255,255,0.2)"
                    : "rgba(239,68,68,0.9)",
                },
              ]}
              onPress={toggleVideo}
            >
              <Text style={styles.videoControlIcon}>
                {isVideoEnabled ? "\u{1F4F9}" : "\u{1F6AB}"}
              </Text>
              <Text style={styles.videoControlLabel}>
                {isVideoEnabled ? "Cam On" : "Cam Off"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.videoControlButton, { backgroundColor: "rgba(255,255,255,0.2)" }]}
              onPress={switchCamera}
            >
              <Text style={styles.videoControlIcon}>{"\u{1F504}"}</Text>
              <Text style={styles.videoControlLabel}>Flip</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.videoEndButton}
            onPress={() => endCall()}
          >
            <Text style={styles.videoEndIcon}>{"\u{1F4F5}"}</Text>
            <Text style={styles.videoEndText}>End</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Audio-only call layout (unchanged from Phase 2)
  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.content}>
        <View style={[styles.avatar, { backgroundColor: theme.colors.primary }]}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>

        <Text style={[styles.name, { color: theme.colors.text }]}>{peerName}</Text>
        <Text style={[styles.audioDuration, { color: theme.colors.online }]}>
          {formatDuration(duration)}
        </Text>
      </View>

      <View style={styles.controls}>
        <TouchableOpacity
          style={[
            styles.controlButton,
            { backgroundColor: isMuted ? theme.colors.notification : theme.colors.card },
          ]}
          onPress={toggleMute}
        >
          <Text style={styles.controlIcon}>{isMuted ? "\u{1F507}" : "\u{1F3A4}"}</Text>
          <Text style={[styles.controlLabel, { color: theme.colors.text }]}>
            {isMuted ? "Unmute" : "Mute"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.controlButton,
            { backgroundColor: isSpeaker ? theme.colors.primary : theme.colors.card },
          ]}
          onPress={toggleSpeaker}
        >
          <Text style={styles.controlIcon}>{isSpeaker ? "\u{1F50A}" : "\u{1F508}"}</Text>
          <Text style={[styles.controlLabel, { color: theme.colors.text }]}>
            {isSpeaker ? "Speaker" : "Earpiece"}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.endButton, { backgroundColor: theme.colors.notification }]}
          onPress={() => endCall()}
        >
          <Text style={styles.endIcon}>{"\u{1F4F5}"}</Text>
          <Text style={styles.endText}>End Call</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Audio-only styles
  container: { flex: 1, justifyContent: "space-between", paddingVertical: 80 },
  content: { alignItems: "center" },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  avatarText: { fontSize: 40, fontWeight: "700", color: "#FFFFFF" },
  name: { fontSize: 26, fontWeight: "700", marginBottom: 8 },
  audioDuration: { fontSize: 20, fontWeight: "600" },
  controls: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 32,
  },
  controlButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  controlIcon: { fontSize: 28 },
  controlLabel: { fontSize: 11, marginTop: 2 },
  actions: { alignItems: "center", paddingBottom: 40 },
  endButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  endIcon: { fontSize: 28 },
  endText: { fontSize: 12, color: "#FFFFFF", marginTop: 2 },

  // Video call styles
  videoContainer: {
    flex: 1,
    backgroundColor: "#000",
  },
  remoteVideo: {
    position: "absolute",
    top: 0,
    left: 0,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  remoteVideoFallback: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarLarge: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  avatarLargeText: { fontSize: 48, fontWeight: "700", color: "#FFFFFF" },
  fallbackName: { fontSize: 24, fontWeight: "700", marginBottom: 4 },
  fallbackHint: { fontSize: 14 },

  // PiP
  pipContainer: {
    position: "absolute",
    top: 60,
    right: 16,
    width: PIP_WIDTH,
    height: PIP_HEIGHT,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.3)",
  },
  pipVideo: {
    width: PIP_WIDTH,
    height: PIP_HEIGHT,
  },

  // Duration overlay
  durationOverlay: {
    position: "absolute",
    top: 60,
    left: 16,
    backgroundColor: "rgba(0,0,0,0.4)",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  durationText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "600",
  },
  peerNameOverlay: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 13,
    marginTop: 2,
  },

  // Video control bar
  videoControlBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingTop: 16,
    paddingBottom: 44,
    paddingHorizontal: 20,
    alignItems: "center",
  },
  videoControls: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 16,
    marginBottom: 20,
  },
  videoControlButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
  },
  videoControlIcon: { fontSize: 24 },
  videoControlLabel: { fontSize: 9, color: "#FFFFFF", marginTop: 2 },
  videoEndButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#EF4444",
    justifyContent: "center",
    alignItems: "center",
  },
  videoEndIcon: { fontSize: 26 },
  videoEndText: { fontSize: 11, color: "#FFFFFF", marginTop: 2 },
});
