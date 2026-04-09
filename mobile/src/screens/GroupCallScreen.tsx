import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  FlatList,
} from "react-native";
import { RTCView, MediaStream } from "react-native-webrtc";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../contexts/ThemeContext";
import { useSocket } from "../contexts/SocketContext";
import { useAuth } from "../contexts/AuthContext";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation";

type Props = NativeStackScreenProps<RootStackParamList, "GroupCall">;

interface GroupParticipant {
  userId: string;
  displayName: string;
  stream?: MediaStream;
  isSpeaking?: boolean;
  audioEnabled?: boolean;
  videoEnabled?: boolean;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

export default function GroupCallScreen({ route, navigation }: Props) {
  const { conversationId } = route.params;
  const { theme } = useTheme();
  const { socket } = useSocket();
  const { user } = useAuth();
  const [participants, setParticipants] = useState<GroupParticipant[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isFrontCamera, setIsFrontCamera] = useState(true);
  const [activeSpeaker, setActiveSpeaker] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setDuration((d) => d + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!socket) return;

    socket.emit("group-call-join", { conversationId });

    function onParticipantJoined(data: {
      userId: string;
      displayName: string;
    }) {
      setParticipants((prev) => {
        if (prev.find((p) => p.userId === data.userId)) return prev;
        return [...prev, { userId: data.userId, displayName: data.displayName }];
      });
    }

    function onParticipantLeft(data: { userId: string }) {
      setParticipants((prev) =>
        prev.filter((p) => p.userId !== data.userId)
      );
    }

    function onDominantSpeaker(data: { userId: string }) {
      setActiveSpeaker(data.userId);
    }

    socket.on("group-call-participant-joined", onParticipantJoined);
    socket.on("group-call-participant-left", onParticipantLeft);
    socket.on("group-call-dominant-speaker", onDominantSpeaker);

    return () => {
      socket.emit("group-call-leave", { conversationId });
      socket.off("group-call-participant-joined", onParticipantJoined);
      socket.off("group-call-participant-left", onParticipantLeft);
      socket.off("group-call-dominant-speaker", onDominantSpeaker);
    };
  }, [socket, conversationId]);

  const formatDuration = (secs: number): string => {
    const m = Math.floor(secs / 60)
      .toString()
      .padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const getTileSize = () => {
    const count = Math.max(participants.length, 1);
    if (count <= 2) {
      return { width: SCREEN_WIDTH, height: SCREEN_HEIGHT / 2 - 60 };
    }
    if (count <= 4) {
      return { width: SCREEN_WIDTH / 2, height: (SCREEN_HEIGHT - 160) / 2 };
    }
    // 3x3 grid for 5-9
    return { width: SCREEN_WIDTH / 3, height: (SCREEN_HEIGHT - 160) / 3 };
  };

  const handleLeave = useCallback(() => {
    if (socket) {
      socket.emit("group-call-leave", { conversationId });
    }
    navigation.goBack();
  }, [socket, conversationId, navigation]);

  const handleToggleMute = useCallback(() => {
    setIsMuted((prev) => !prev);
    socket?.emit("group-call-toggle-audio", {
      conversationId,
      audioEnabled: isMuted,
    });
  }, [socket, conversationId, isMuted]);

  const handleToggleVideo = useCallback(() => {
    setIsVideoEnabled((prev) => !prev);
    socket?.emit("group-call-toggle-video", {
      conversationId,
      videoEnabled: !isVideoEnabled,
    });
  }, [socket, conversationId, isVideoEnabled]);

  const handleSwitchCamera = useCallback(() => {
    setIsFrontCamera((prev) => !prev);
  }, []);

  const tileSize = getTileSize();

  const renderParticipant = ({ item }: { item: GroupParticipant }) => {
    const isSpeaking = item.userId === activeSpeaker;
    return (
      <View
        style={[
          styles.tile,
          {
            width: tileSize.width - 4,
            height: tileSize.height - 4,
            borderColor: isSpeaking ? theme.colors.primary : "transparent",
            borderWidth: isSpeaking ? 3 : 0,
          },
        ]}
      >
        {item.stream && item.videoEnabled !== false ? (
          <RTCView
            streamURL={item.stream.toURL()}
            style={styles.video}
            objectFit="cover"
          />
        ) : (
          <View
            style={[styles.avatarContainer, { backgroundColor: theme.colors.card }]}
          >
            <Text style={styles.avatarText}>
              {(item.displayName || "?")[0].toUpperCase()}
            </Text>
          </View>
        )}
        <View style={styles.nameOverlay}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Text style={styles.nameText} numberOfLines={1}>
              {item.displayName}
            </Text>
            {item.audioEnabled === false && (
              <Ionicons name="mic-off" size={12} color="#FFF" style={{ marginLeft: 4 }} />
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: "#000" }]}>
      {/* Duration */}
      <View style={styles.topBar}>
        <Text style={styles.durationText}>{formatDuration(duration)}</Text>
        <Text style={styles.participantCount}>
          {participants.length} participant{participants.length !== 1 ? "s" : ""}
        </Text>
      </View>

      {/* Participant Grid */}
      <FlatList
        data={participants}
        keyExtractor={(item) => item.userId}
        renderItem={renderParticipant}
        numColumns={participants.length <= 2 ? 1 : participants.length <= 4 ? 2 : 3}
        key={participants.length <= 2 ? "1col" : participants.length <= 4 ? "2col" : "3col"}
        contentContainerStyle={styles.grid}
      />

      {/* Controls */}
      <View style={styles.controls}>
        <TouchableOpacity
          style={[
            styles.controlButton,
            { backgroundColor: isMuted ? "#EF4444" : "rgba(255,255,255,0.2)" },
          ]}
          onPress={handleToggleMute}
        >
          <Ionicons name={isMuted ? "mic-off" : "mic"} size={24} color="#FFF" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.controlButton,
            {
              backgroundColor: !isVideoEnabled
                ? "#EF4444"
                : "rgba(255,255,255,0.2)",
            },
          ]}
          onPress={handleToggleVideo}
        >
          <Ionicons name={isVideoEnabled ? "videocam" : "videocam-off"} size={24} color="#FFF" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.controlButton,
            { backgroundColor: "rgba(255,255,255,0.2)" },
          ]}
          onPress={handleSwitchCamera}
        >
          <Ionicons name="camera-reverse" size={24} color="#FFF" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlButton, styles.endButton]}
          onPress={handleLeave}
        >
          <Ionicons name="call" size={24} color="#FFF" style={{ transform: [{ rotate: "135deg" }] }} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  durationText: { color: "#FFF", fontSize: 16, fontWeight: "600" },
  participantCount: { color: "rgba(255,255,255,0.7)", fontSize: 14 },
  grid: { flexGrow: 1, justifyContent: "center", alignItems: "center" },
  tile: {
    margin: 2,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#1a1a2e",
  },
  video: { flex: 1 },
  avatarContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: { fontSize: 40, color: "#FFF", fontWeight: "bold" },
  nameOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  nameText: { color: "#FFF", fontSize: 12, fontWeight: "500" },
  controls: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 20,
    paddingBottom: 40,
    gap: 16,
  },
  controlButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
  },
  endButton: { backgroundColor: "#EF4444" },
  controlIcon: { fontSize: 24 },
});
