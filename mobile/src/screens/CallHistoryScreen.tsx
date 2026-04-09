import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useTheme } from "../contexts/ThemeContext";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../services/api";
import { CallHistoryEntry } from "../types";

function formatCallTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  if (diffMs < 604800000) return days[date.getDay()];
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function formatDuration(seconds: number): string {
  if (seconds === 0) return "";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

function getAvatarColor(name: string, colors: string[]): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export default function CallHistoryScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [calls, setCalls] = useState<CallHistoryEntry[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadCalls = useCallback(async () => {
    try {
      const data = (await api.calls.history()) as { calls: CallHistoryEntry[] };
      setCalls(data.calls);
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadCalls();
    }, [loadCalls])
  );

  async function onRefresh() {
    setRefreshing(true);
    await loadCalls();
    setRefreshing(false);
  }

  function getCallStatusInfo(call: CallHistoryEntry) {
    const isCaller = call.callerId === user?.id;
    const peer = isCaller ? call.callee : call.caller;
    const peerName = peer?.displayName || peer?.username || "Unknown";
    const initial = peerName.charAt(0).toUpperCase();

    let statusText: string;
    let statusColor: string;
    let icon: string;

    switch (call.status) {
      case "completed":
      case "answered":
        statusText = isCaller ? "Outgoing" : "Incoming";
        statusColor = theme.colors.online;
        icon = isCaller ? "\u2197\uFE0F" : "\u2199\uFE0F";
        break;
      case "missed":
        statusText = isCaller ? "No answer" : "Missed";
        statusColor = theme.colors.notification;
        icon = "\u{1F4F5}";
        break;
      case "rejected":
        statusText = isCaller ? "Declined" : "Rejected";
        statusColor = theme.colors.notification;
        icon = "\u{1F4F5}";
        break;
      default:
        statusText = call.status;
        statusColor = theme.colors.textSecondary;
        icon = "\u{1F4DE}";
    }

    return { peerName, initial, statusText, statusColor, icon };
  }

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <FlatList
        data={calls}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />
        }
        contentContainerStyle={calls.length === 0 ? styles.emptyContainer : undefined}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={{ fontSize: 48, marginBottom: 16 }}>{"\u{1F4DE}"}</Text>
            <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
              No calls yet
            </Text>
            <Text style={[styles.emptySubtitle, { color: theme.colors.textSecondary }]}>
              Your call history will appear here
            </Text>
          </View>
        }
        ItemSeparatorComponent={() => (
          <View style={{ marginLeft: 72 }}>
            <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.border }} />
          </View>
        )}
        renderItem={({ item }) => {
          const { peerName, initial, statusText, statusColor, icon } =
            getCallStatusInfo(item);
          const durationStr = formatDuration(item.duration);
          const avatarColor = getAvatarColor(peerName, theme.colors.avatarColors);

          return (
            <View style={styles.callItem}>
              <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
                <Text style={styles.avatarText}>{initial}</Text>
              </View>

              <View style={styles.callInfo}>
                <Text style={[styles.peerName, { color: theme.colors.text }]}>
                  {peerName}
                </Text>
                <View style={styles.statusRow}>
                  <Text style={{ fontSize: 13 }}>{icon}</Text>
                  <Text style={[styles.statusText, { color: statusColor }]}>
                    {statusText}
                  </Text>
                  {item.callType === "video" && (
                    <Text style={{ fontSize: 12, marginLeft: 4 }}>{"\u{1F4F9}"}</Text>
                  )}
                  {durationStr ? (
                    <Text style={[styles.durationText, { color: theme.colors.textSecondary }]}>
                      {" \u00B7 "}{durationStr}
                    </Text>
                  ) : null}
                </View>
              </View>

              <Text style={[styles.time, { color: theme.colors.textSecondary }]}>
                {formatCallTime(item.startedAt)}
              </Text>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { justifyContent: "center", alignItems: "center" },
  emptyContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyState: { alignItems: "center", paddingHorizontal: 40 },
  emptyTitle: { fontSize: 18, fontWeight: "600", marginBottom: 6 },
  emptySubtitle: { fontSize: 14, textAlign: "center" },
  callItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  avatarText: { fontSize: 18, fontWeight: "700", color: "#FFFFFF" },
  callInfo: { flex: 1 },
  peerName: { fontSize: 16, fontWeight: "600", marginBottom: 2 },
  statusRow: { flexDirection: "row", alignItems: "center" },
  statusText: { fontSize: 13, marginLeft: 4, fontWeight: "500" },
  durationText: { fontSize: 13 },
  time: { fontSize: 12, fontWeight: "500" },
});
