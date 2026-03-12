import React, { useEffect, useRef } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Animated } from "react-native";
import { useTheme } from "../contexts/ThemeContext";
import { useCall } from "../contexts/CallContext";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation";

type Props = NativeStackScreenProps<RootStackParamList, "OutgoingCall">;

export default function OutgoingCallScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const { callStatus, callInfo, endCall } = useCall();
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.3, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  useEffect(() => {
    if (callStatus === "connected") {
      navigation.replace("ActiveCall");
    } else if (callStatus === "idle") {
      navigation.goBack();
    }
  }, [callStatus, navigation]);

  const peerName = callInfo?.peer.displayName || callInfo?.peer.username || "Unknown";
  const initial = peerName.charAt(0).toUpperCase();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.content}>
        <Animated.View
          style={[
            styles.avatar,
            { backgroundColor: theme.colors.primary, transform: [{ scale: pulseAnim }] },
          ]}
        >
          <Text style={styles.avatarText}>{initial}</Text>
        </Animated.View>

        <Text style={[styles.name, { color: theme.colors.text }]}>{peerName}</Text>
        <Text style={[styles.status, { color: theme.colors.textSecondary }]}>Calling...</Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.endButton, { backgroundColor: theme.colors.notification }]}
          onPress={() => {
            endCall();
            navigation.goBack();
          }}
        >
          <Text style={styles.endIcon}>{"\u{1F4F5}"}</Text>
          <Text style={styles.endText}>Cancel</Text>
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
