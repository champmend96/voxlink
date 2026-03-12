import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
  TextInput,
  Modal,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useTheme } from "../contexts/ThemeContext";
import { useAuth } from "../contexts/AuthContext";
import { useSocket } from "../contexts/SocketContext";
import { api } from "../services/api";
import { Conversation, User } from "../types";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation";
import type { CompositeNavigationProp } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import type { MainTabParamList } from "../navigation";

type Props = {
  navigation: CompositeNavigationProp<
    BottomTabNavigationProp<MainTabParamList, "Conversations">,
    NativeStackNavigationProp<RootStackParamList>
  >;
};

export default function ConversationListScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { onlineUsers } = useSocket();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<User[]>([]);

  const loadConversations = useCallback(async () => {
    try {
      const data = (await api.conversations.list()) as Conversation[];
      setConversations(data);
    } catch (err: any) {
      Alert.alert("Error", err.message);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadConversations();
    }, [loadConversations])
  );

  async function onRefresh() {
    setRefreshing(true);
    await loadConversations();
    setRefreshing(false);
  }

  async function searchUsers(query: string) {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    try {
      const results = (await api.users.list(query)) as User[];
      setSearchResults(results);
    } catch {}
  }

  async function startConversation(otherUser: User) {
    try {
      const conv = (await api.conversations.create({
        participantIds: [otherUser.id],
      })) as Conversation;
      setShowNew(false);
      setSearchQuery("");
      setSearchResults([]);
      navigation.navigate("Chat", {
        conversationId: conv.id,
        title: otherUser.displayName || otherUser.username,
      });
    } catch (err: any) {
      Alert.alert("Error", err.message);
    }
  }

  function getConversationTitle(conv: Conversation): string {
    if (conv.name) return conv.name;
    const other = conv.participants.find((p) => p.userId !== user?.id);
    return other?.user?.displayName || other?.user?.username || "Chat";
  }

  function getLastMessage(conv: Conversation): string {
    if (conv.messages.length === 0) return "No messages yet";
    return conv.messages[0].content;
  }

  function formatTime(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    if (diff < 60000) return "now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
    return date.toLocaleDateString();
  }

  function isOnline(conv: Conversation): boolean {
    const other = conv.participants.find((p) => p.userId !== user?.id);
    return other ? onlineUsers.has(other.userId) : false;
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <TouchableOpacity
        style={[styles.newButton, { backgroundColor: theme.colors.primary }]}
        onPress={() => setShowNew(true)}
      >
        <Text style={styles.newButtonText}>+ New Chat</Text>
      </TouchableOpacity>

      <FlatList
        data={conversations}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />
        }
        contentContainerStyle={conversations.length === 0 ? styles.empty : undefined}
        ListEmptyComponent={
          <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
            No conversations yet
          </Text>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.item, { backgroundColor: theme.colors.card, borderBottomColor: theme.colors.border }]}
            onPress={() =>
              navigation.navigate("Chat", {
                conversationId: item.id,
                title: getConversationTitle(item),
              })
            }
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {getConversationTitle(item)[0]?.toUpperCase()}
              </Text>
              {isOnline(item) && <View style={[styles.onlineDot, { backgroundColor: theme.colors.online }]} />}
            </View>
            <View style={styles.itemContent}>
              <View style={styles.itemHeader}>
                <Text style={[styles.itemTitle, { color: theme.colors.text }]} numberOfLines={1}>
                  {getConversationTitle(item)}
                </Text>
                {item.messages[0] && (
                  <Text style={[styles.itemTime, { color: theme.colors.textSecondary }]}>
                    {formatTime(item.messages[0].createdAt)}
                  </Text>
                )}
              </View>
              <Text style={[styles.itemPreview, { color: theme.colors.textSecondary }]} numberOfLines={1}>
                {getLastMessage(item)}
              </Text>
            </View>
          </TouchableOpacity>
        )}
      />

      <Modal visible={showNew} animationType="slide" transparent>
        <View style={[styles.modal, { backgroundColor: theme.colors.background }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>New Conversation</Text>
            <TouchableOpacity onPress={() => { setShowNew(false); setSearchQuery(""); setSearchResults([]); }}>
              <Text style={[styles.modalClose, { color: theme.colors.primary }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            style={[styles.searchInput, { backgroundColor: theme.colors.inputBg, color: theme.colors.text, borderColor: theme.colors.border }]}
            placeholder="Search users..."
            placeholderTextColor={theme.colors.textSecondary}
            value={searchQuery}
            onChangeText={searchUsers}
            autoFocus
          />
          <FlatList
            data={searchResults}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.userItem, { borderBottomColor: theme.colors.border }]}
                onPress={() => startConversation(item)}
              >
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{item.username[0]?.toUpperCase()}</Text>
                </View>
                <View>
                  <Text style={[styles.userName, { color: theme.colors.text }]}>
                    {item.displayName || item.username}
                  </Text>
                  <Text style={[styles.userHandle, { color: theme.colors.textSecondary }]}>
                    @{item.username}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  newButton: {
    margin: 16,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  newButtonText: { color: "#FFF", fontSize: 16, fontWeight: "700" },
  item: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#6C63FF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  avatarText: { color: "#FFF", fontSize: 18, fontWeight: "700" },
  onlineDot: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: "#1A1A2E",
  },
  itemContent: { flex: 1 },
  itemHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  itemTitle: { fontSize: 16, fontWeight: "600", flex: 1, marginRight: 8 },
  itemTime: { fontSize: 12 },
  itemPreview: { fontSize: 14 },
  empty: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyText: { fontSize: 16 },
  modal: { flex: 1, paddingTop: 60 },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  modalTitle: { fontSize: 20, fontWeight: "700" },
  modalClose: { fontSize: 16 },
  searchInput: {
    height: 44,
    marginHorizontal: 16,
    borderRadius: 10,
    paddingHorizontal: 16,
    fontSize: 16,
    borderWidth: 1,
    marginBottom: 8,
  },
  userItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  userName: { fontSize: 16, fontWeight: "600" },
  userHandle: { fontSize: 13, marginTop: 2 },
});
