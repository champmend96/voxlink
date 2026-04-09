import React, { useEffect, useRef } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../contexts/ThemeContext";
import { useCall } from "../contexts/CallContext";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation";

type Props = NativeStackScreenProps<RootStackParamList, "IncomingCall">;

export default function IncomingCallScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const { callStatus, callInfo, acceptCall, rejectCall } = useCall();
  const ringAnim = useRef(new Animated.Value(0)).current;

  const isVideoCall = callInfo?.callType === "video";

  useEffect(() => {
    const ring = Animated.loop(
      Animated.sequence([
        Animated.timing(ringAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(ringAnim, { toValue: -1, duration: 300, useNativeDriver: true }),
        Animated.timing(ringAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
      ])
    );
    ring.start();
    return () => ring.stop();
  }, [ringAnim]);

  useEffect(() => {
    if (callStatus === "connected") {
      navigation.replace("ActiveCall");
    } else if (callStatus === "idle") {
      navigation.goBack();
    }
  }, [callStatus, navigation]);

  const peerName = callInfo?.peer.displayName || callInfo?.peer.username || "Unknown";
  const initial = peerName.charAt(0).toUpperCase();

  const rotation = ringAnim.interpolate({
    inputRange: [-1, 1],
    outputRange: ["-15deg", "15deg"],
  });

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.content}>
        <Animated.View
          style={[
            styles.avatar,
            { backgroundColor: theme.colors.primary, transform: [{ rotate: rotation }] },
          ]}
        >
          <Text style={styles.avatarText}>{initial}</Text>
        </Animated.View>

        <Text style={[styles.name, { color: theme.colors.text }]}>{peerName}</Text>
        <Text style={[styles.status, { color: theme.colors.textSecondary }]}>
          Incoming {isVideoCall ? "video" : "voice"} call...
        </Text>

        {isVideoCall && (
          <View style={[styles.callTypeBadge, { backgroundColor: theme.colors.primary }]}>
            <Ionicons name="videocam" size={16} color="#FFF" />
            <Text style={styles.callTypeBadgeText}>Video Call</Text>
          </View>
        )}
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: theme.colors.notification }]}
          onPress={() => {
            rejectCall();
            navigation.goBack();
          }}
        >
          <Ionicons name="call" size={28} color="#FFF" style={{ transform: [{ rotate: "135deg" }] }} />
          <Text style={styles.actionLabel}>Decline</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: theme.colors.online }]}
          onPress={acceptCall}
        >
          <Ionicons name={isVideoCall ? "videocam" : "call"} size={28} color="#FFF" />
          <Text style={styles.actionLabel}>Accept</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "space-between", paddingVertical: 80 },
  content: { alignItems: "center" },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  avatarText: { fontSize: 48, fontWeight: "700", color: "#FFFFFF" },
  name: { fontSize: 28, fontWeight: "700", marginBottom: 8 },
  status: { fontSize: 16 },
  callTypeBadge: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  callTypeBadgeIcon: { fontSize: 16 },
  callTypeBadgeText: { fontSize: 14, fontWeight: "600", color: "#FFFFFF" },
  actions: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingHorizontal: 60,
    paddingBottom: 40,
  },
  actionButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  actionIcon: { fontSize: 28 },
  actionLabel: { fontSize: 12, color: "#FFFFFF", marginTop: 2 },
});
