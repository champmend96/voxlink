import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from "react-native";
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
  return date.toLocaleDateString();
}

function formatDuration(seconds: number): string {
  if (seconds === 0) return "";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

export default function CallHistoryScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [calls, setCalls] = useState<CallHistoryEntry[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadCalls = useCallback(async () => {
    try {
      const data = (await api.calls.history()) as { calls: CallHistoryEntry[] };
      setCalls(data.calls);
    } catch {}
  }, []);

  useEffect(() => {
    loadCalls();
  }, [loadCalls]);

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
        statusText = isCaller ? "Outgoing" : "Incoming";
        statusColor = theme.colors.online;
        icon = isCaller ? "\u2197\uFE0F" : "\u2199\uFE0F";
        break;
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

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <FlatList
        data={calls}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
              No call history yet
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const { peerName, initial, statusText, statusColor, icon } =
            getCallStatusInfo(item);
          const durationStr = formatDuration(item.duration);

          return (
            <View style={[styles.callItem, { borderBottomColor: theme.colors.border }]}>
              <View style={[styles.avatar, { backgroundColor: theme.colors.primary }]}>
                <Text style={styles.avatarText}>{initial}</Text>
              </View>

              <View style={styles.callInfo}>
                <Text style={[styles.peerName, { color: theme.colors.text }]}>
                  {peerName}
                </Text>
                <View style={styles.statusRow}>
                  <Text style={{ fontSize: 14 }}>{icon}</Text>
                  <Text style={[styles.statusText, { color: statusColor }]}>
                    {statusText}
                  </Text>
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
  empty: { flex: 1, justifyContent: "center", alignItems: "center", paddingTop: 100 },
  emptyText: { fontSize: 16 },
  callItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  avatarText: { fontSize: 18, fontWeight: "700", color: "#FFFFFF" },
  callInfo: { flex: 1 },
  peerName: { fontSize: 16, fontWeight: "600", marginBottom: 2 },
  statusRow: { flexDirection: "row", alignItems: "center" },
  statusText: { fontSize: 13, marginLeft: 4 },
  durationText: { fontSize: 13 },
  time: { fontSize: 13 },
});
