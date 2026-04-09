import React, { useState, useCallback, useEffect } from "react";
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
  ActivityIndicator,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useTheme } from "../contexts/ThemeContext";
import { useAuth } from "../contexts/AuthContext";
import { useSocket } from "../contexts/SocketContext";
import { api } from "../services/api";
import { Conversation, User, Message } from "../types";
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

function getAvatarColor(name: string, colors: string[]): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export default function ConversationListScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { onlineUsers, socket } = useSocket();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [filterQuery, setFilterQuery] = useState("");

  const loadConversations = useCallback(async () => {
    try {
      const data = (await api.conversations.list()) as Conversation[];
      setConversations(data);
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadConversations();
    }, [loadConversations])
  );

  useEffect(() => {
    if (!socket) return;

    function onNewMessage(msg: Message) {
      setConversations((prev) => {
        const idx = prev.findIndex((c) => c.id === msg.conversationId);
        if (idx === -1) return prev;
        const updated = [...prev];
        const conv = { ...updated[idx], messages: [msg], updatedAt: msg.createdAt };
        updated.splice(idx, 1);
        updated.unshift(conv);
        return updated;
      });
    }

    socket.on("new-message", onNewMessage);
    return () => {
      socket.off("new-message", onNewMessage);
    };
  }, [socket]);

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
    const msg = conv.messages[0];
    const prefix = msg.senderId === user?.id ? "You: " : "";
    try {
      const parsed = JSON.parse(msg.content);
      if (parsed.type === "file") return `${prefix}Sent a file`;
    } catch {}
    return `${prefix}${msg.content}`;
  }

  function formatTime(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    if (diff < 60000) return "now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
    if (diff < 604800000) {
      const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      return days[date.getDay()];
    }
    return `${date.getMonth() + 1}/${date.getDate()}`;
  }

  function isOnline(conv: Conversation): boolean {
    const other = conv.participants.find((p) => p.userId !== user?.id);
    return other ? onlineUsers.has(other.userId) : false;
  }

  const filtered = filterQuery
    ? conversations.filter((c) =>
        getConversationTitle(c).toLowerCase().includes(filterQuery.toLowerCase())
      )
    : conversations;

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Search bar */}
      <View style={styles.searchBarContainer}>
        <View style={[styles.searchBar, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <Text style={[styles.searchIcon, { color: theme.colors.textSecondary }]}>{"\u{1F50D}"}</Text>
          <TextInput
            style={[styles.searchInput, { color: theme.colors.text }]}
            placeholder="Search conversations..."
            placeholderTextColor={theme.colors.textSecondary}
            value={filterQuery}
            onChangeText={setFilterQuery}
          />
          {filterQuery.length > 0 && (
            <TouchableOpacity onPress={() => setFilterQuery("")}>
              <Text style={{ color: theme.colors.textSecondary, fontSize: 16 }}>{"\u2715"}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />
        }
        contentContainerStyle={filtered.length === 0 ? styles.emptyContainer : { paddingBottom: 80 }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={{ fontSize: 48, marginBottom: 16 }}>{"\u{1F4AC}"}</Text>
            <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
              No conversations yet
            </Text>
            <Text style={[styles.emptySubtitle, { color: theme.colors.textSecondary }]}>
              Tap the + button to start chatting
            </Text>
          </View>
        }
        ItemSeparatorComponent={() => (
          <View style={{ marginLeft: 80 }}>
            <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.border }} />
          </View>
        )}
        renderItem={({ item }) => {
          const title = getConversationTitle(item);
          const avatarColor = getAvatarColor(title, theme.colors.avatarColors);
          const online = isOnline(item);

          return (
            <TouchableOpacity
              style={[styles.item, { backgroundColor: theme.colors.background }]}
              onPress={() =>
                navigation.navigate("Chat", {
                  conversationId: item.id,
                  title,
                })
              }
              activeOpacity={0.6}
            >
              <View style={styles.avatarContainer}>
                <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
                  <Text style={styles.avatarText}>
                    {title[0]?.toUpperCase()}
                  </Text>
                </View>
                {online && (
                  <View style={[styles.onlineDot, { borderColor: theme.colors.background }]} />
                )}
              </View>

              <View style={styles.itemContent}>
                <View style={styles.itemHeader}>
                  <Text style={[styles.itemTitle, { color: theme.colors.text }]} numberOfLines={1}>
                    {title}
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
          );
        }}
      />

      {/* FAB */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: theme.colors.fab }]}
        onPress={() => setShowNew(true)}
        activeOpacity={0.8}
      >
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>

      {/* New conversation modal */}
      <Modal visible={showNew} animationType="slide" transparent>
        <View style={[styles.modalOverlay]}>
          <View style={[styles.modal, { backgroundColor: theme.colors.background }]}>
            <View style={[styles.modalHandle, { backgroundColor: theme.colors.border }]} />
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>New Chat</Text>
              <TouchableOpacity
                onPress={() => { setShowNew(false); setSearchQuery(""); setSearchResults([]); }}
                style={[styles.modalCloseBtn, { backgroundColor: theme.colors.card }]}
              >
                <Text style={{ color: theme.colors.textSecondary, fontSize: 16, fontWeight: "600" }}>{"\u2715"}</Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.modalSearchBar, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
              <Text style={{ color: theme.colors.textSecondary, fontSize: 16, marginRight: 8 }}>{"\u{1F50D}"}</Text>
              <TextInput
                style={[styles.modalSearchInput, { color: theme.colors.text }]}
                placeholder="Search by username..."
                placeholderTextColor={theme.colors.textSecondary}
                value={searchQuery}
                onChangeText={searchUsers}
                autoFocus
              />
            </View>

            {searchQuery.length > 0 && searchResults.length === 0 && (
              <View style={styles.noResults}>
                <Text style={{ color: theme.colors.textSecondary, fontSize: 15 }}>
                  {searchQuery.length < 2 ? "Type at least 2 characters" : "No users found"}
                </Text>
              </View>
            )}

            <FlatList
              data={searchResults}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => {
                const color = getAvatarColor(item.username, theme.colors.avatarColors);
                return (
                  <TouchableOpacity
                    style={styles.userItem}
                    onPress={() => startConversation(item)}
                    activeOpacity={0.6}
                  >
                    <View style={[styles.userAvatar, { backgroundColor: color }]}>
                      <Text style={styles.userAvatarText}>{item.username[0]?.toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.userName, { color: theme.colors.text }]}>
                        {item.displayName || item.username}
                      </Text>
                      <Text style={[styles.userHandle, { color: theme.colors.textSecondary }]}>
                        @{item.username}
                      </Text>
                    </View>
                    {onlineUsers.has(item.id) && (
                      <View style={[styles.userOnlineBadge, { backgroundColor: theme.colors.online }]}>
                        <Text style={{ color: "#fff", fontSize: 10, fontWeight: "600" }}>Online</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              }}
              ItemSeparatorComponent={() => (
                <View style={{ marginLeft: 68, height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.border }} />
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { justifyContent: "center", alignItems: "center" },
  searchBarContainer: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    height: 40,
    borderRadius: 20,
    paddingHorizontal: 14,
    borderWidth: 1,
  },
  searchIcon: { fontSize: 14, marginRight: 8 },
  searchInput: { flex: 1, fontSize: 15, height: 40 },
  item: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  avatarContainer: { position: "relative", marginRight: 14 },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: { color: "#FFF", fontSize: 20, fontWeight: "700" },
  onlineDot: {
    position: "absolute",
    bottom: 1,
    right: 1,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#22c55e",
    borderWidth: 2.5,
  },
  itemContent: { flex: 1 },
  itemHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  itemTitle: { fontSize: 16, fontWeight: "600", flex: 1, marginRight: 8 },
  itemTime: { fontSize: 12, fontWeight: "500" },
  itemPreview: { fontSize: 14, lineHeight: 19 },
  emptyContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyState: { alignItems: "center", paddingHorizontal: 40 },
  emptyTitle: { fontSize: 18, fontWeight: "600", marginBottom: 6 },
  emptySubtitle: { fontSize: 14, textAlign: "center" },
  fab: {
    position: "absolute",
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  fabIcon: { color: "#FFF", fontSize: 28, fontWeight: "300", marginTop: -2 },
  modalOverlay: { flex: 1, justifyContent: "flex-end" },
  modal: {
    flex: 1,
    marginTop: 60,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 8,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 12,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  modalTitle: { fontSize: 22, fontWeight: "700" },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  modalSearchBar: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    height: 44,
    borderRadius: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    marginBottom: 8,
  },
  modalSearchInput: { flex: 1, fontSize: 15, height: 44 },
  noResults: { alignItems: "center", paddingTop: 40 },
  userItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  userAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  userAvatarText: { color: "#FFF", fontSize: 17, fontWeight: "700" },
  userName: { fontSize: 16, fontWeight: "600" },
  userHandle: { fontSize: 13, marginTop: 1 },
  userOnlineBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
});
