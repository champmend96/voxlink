import React, { useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useTheme } from "../contexts/ThemeContext";
import { useCall } from "../contexts/CallContext";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation";

type Props = NativeStackScreenProps<RootStackParamList, "ActiveCall">;

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

export default function ActiveCallScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const { callStatus, callInfo, duration, isMuted, isSpeaker, endCall, toggleMute, toggleSpeaker } =
    useCall();

  useEffect(() => {
    if (callStatus === "idle" || callStatus === "ended") {
      navigation.goBack();
    }
  }, [callStatus, navigation]);

  const peerName = callInfo?.peer.displayName || callInfo?.peer.username || "Unknown";
  const initial = peerName.charAt(0).toUpperCase();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.content}>
        <View style={[styles.avatar, { backgroundColor: theme.colors.primary }]}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>

        <Text style={[styles.name, { color: theme.colors.text }]}>{peerName}</Text>
        <Text style={[styles.duration, { color: theme.colors.online }]}>
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
          onPress={() => {
            endCall();
          }}
        >
          <Text style={styles.endIcon}>{"\u{1F4F5}"}</Text>
          <Text style={styles.endText}>End Call</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
  duration: { fontSize: 20, fontWeight: "600" },
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
});
