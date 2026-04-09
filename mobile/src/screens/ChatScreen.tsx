import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Image,
  Alert,
  Linking,
  ActivityIndicator,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { useTheme } from "../contexts/ThemeContext";
import { useAuth } from "../contexts/AuthContext";
import { useSocket } from "../contexts/SocketContext";
import { useCall } from "../contexts/CallContext";
import { api } from "../services/api";
import { Message, Conversation, isFileMessage, FileMessageMetadata } from "../types";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation";
import { Ionicons } from "@expo/vector-icons";

type Props = NativeStackScreenProps<RootStackParamList, "Chat">;

const SERVER_URL = "https://voxlink-backend.onrender.com";

export default function ChatScreen({ route, navigation }: Props) {
  const { conversationId } = route.params;
  const { theme } = useTheme();
  const { user } = useAuth();
  const { socket } = useSocket();
  const { initiateCall } = useCall();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [typingUsers, setTypingUsers] = useState<Map<string, string>>(new Map());
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [isEncrypted, setIsEncrypted] = useState(false);
  const [loading, setLoading] = useState(true);
  const flatListRef = useRef<FlatList>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    loadMessages();
    loadConversation();
  }, [conversationId]);

  async function loadConversation() {
    try {
      const data = (await api.conversations.get(conversationId)) as Conversation;
      setConversation(data);
      const participantIds = data.participants.map((p) => p.userId);
      try {
        const { keys } = await api.keys.getPublicKeys(participantIds);
        const allHaveKeys = participantIds.every((id) => keys[id]);
        setIsEncrypted(allHaveKeys);
      } catch {}
    } catch {}
  }

  useEffect(() => {
    if (!conversation) return;

    const peer = conversation.isGroup
      ? null
      : conversation.participants.find((p) => p.userId !== user?.id);

    navigation.setOptions({
      headerRight: () => (
        <View style={{ flexDirection: "row", alignItems: "center", marginRight: 4, gap: 2 }}>
          {isEncrypted && (
            <View style={headerStyles.badge}>
              <Ionicons name="lock-closed" size={14} color={theme.colors.textSecondary} />
            </View>
          )}
          {conversation.isGroup && (
            <TouchableOpacity
              style={headerStyles.iconBtn}
              onPress={() => navigation.navigate("GroupCall", { conversationId })}
            >
              <Ionicons name="people" size={22} color={theme.colors.text} />
            </TouchableOpacity>
          )}
          {!conversation.isGroup && peer && (
            <>
              <TouchableOpacity
                style={headerStyles.iconBtn}
                onPress={() => {
                  initiateCall(peer.user.id, peer.user, "video");
                  navigation.navigate("OutgoingCall");
                }}
              >
                <Ionicons name="videocam" size={22} color={theme.colors.text} />
              </TouchableOpacity>
              <TouchableOpacity
                style={headerStyles.iconBtn}
                onPress={() => {
                  initiateCall(peer.user.id, peer.user, "audio");
                  navigation.navigate("OutgoingCall");
                }}
              >
                <Ionicons name="call" size={20} color={theme.colors.text} />
              </TouchableOpacity>
            </>
          )}
        </View>
      ),
    });
  }, [conversation, user?.id, navigation, initiateCall, isEncrypted]);

  useEffect(() => {
    if (!socket) return;

    socket.emit("join-room", conversationId);

    function onNewMessage(msg: Message) {
      if (msg.conversationId === conversationId) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [msg, ...prev];
        });
        if (msg.senderId !== user?.id) {
          socket!.emit("read-receipt", { conversationId, messageId: msg.id });
        }
      }
    }

    function onTyping(data: { userId: string; username: string; conversationId: string; isTyping: boolean }) {
      if (data.conversationId !== conversationId || data.userId === user?.id) return;
      setTypingUsers((prev) => {
        const next = new Map(prev);
        if (data.isTyping) next.set(data.userId, data.username);
        else next.delete(data.userId);
        return next;
      });
    }

    function onReadReceipt(data: { messageId: string; userId: string }) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === data.messageId && !m.readBy.includes(data.userId)
            ? { ...m, readBy: [...m.readBy, data.userId] }
            : m
        )
      );
    }

    socket.on("new-message", onNewMessage);
    socket.on("typing", onTyping);
    socket.on("read-receipt", onReadReceipt);

    return () => {
      socket.off("new-message", onNewMessage);
      socket.off("typing", onTyping);
      socket.off("read-receipt", onReadReceipt);
    };
  }, [socket, conversationId, user?.id]);

  async function loadMessages() {
    try {
      const data = (await api.messages.list(conversationId)) as {
        messages: Message[];
        hasMore: boolean;
      };
      setMessages(data.messages);
    } catch {} finally {
      setLoading(false);
    }
  }

  function handleSend() {
    if (!text.trim() || !socket) return;
    socket.emit("send-message", { conversationId, content: text.trim() });
    setText("");
    socket.emit("typing", { conversationId, isTyping: false });
  }

  function handleTyping(value: string) {
    setText(value);
    if (!socket) return;

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    if (value.length > 0) {
      socket.emit("typing", { conversationId, isTyping: true });
      typingTimeoutRef.current = setTimeout(() => {
        socket.emit("typing", { conversationId, isTyping: false });
      }, 2000);
    } else {
      socket.emit("typing", { conversationId, isTyping: false });
    }
  }

  async function handleAttachment() {
    Alert.alert("Attach", "Choose source", [
      {
        text: "Photo Library",
        onPress: async () => {
          try {
            const result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              quality: 0.8,
            });
            if (!result.canceled && result.assets[0]) {
              const asset = result.assets[0];
              const fileName = asset.fileName || `photo_${Date.now()}.jpg`;
              const mimeType = asset.mimeType || "image/jpeg";
              await api.upload.file(conversationId, asset.uri, fileName, mimeType);
            }
          } catch (err) {
            Alert.alert("Error", "Failed to upload image");
          }
        },
      },
      {
        text: "Document",
        onPress: async () => {
          try {
            const result = await DocumentPicker.getDocumentAsync({ type: "*/*" });
            if (!result.canceled && result.assets[0]) {
              const asset = result.assets[0];
              await api.upload.file(
                conversationId,
                asset.uri,
                asset.name,
                asset.mimeType || "application/octet-stream"
              );
            }
          } catch (err) {
            Alert.alert("Error", "Failed to upload file");
          }
        },
      },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  function formatTime(dateStr: string): string {
    return new Date(dateStr).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  const isMine = (msg: Message) => msg.senderId === user?.id;

  const typingText =
    typingUsers.size > 0
      ? `${Array.from(typingUsers.values()).join(", ")} typing...`
      : null;

  function renderFileContent(fileMeta: FileMessageMetadata, mine: boolean) {
    const isImage = fileMeta.mimeType.startsWith("image/");

    if (isImage && fileMeta.thumbnailUrl) {
      return (
        <TouchableOpacity
          onPress={() => Linking.openURL(`${SERVER_URL}${fileMeta.downloadUrl}`)}
        >
          <Image
            source={{ uri: `${SERVER_URL}${fileMeta.thumbnailUrl}` }}
            style={styles.imageThumb}
            resizeMode="cover"
          />
          <Text
            style={{
              color: mine ? "rgba(255,255,255,0.7)" : theme.colors.textSecondary,
              fontSize: 12,
              marginTop: 4,
            }}
          >
            {fileMeta.filename}
          </Text>
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity
        style={styles.fileRow}
        onPress={() => Linking.openURL(`${SERVER_URL}${fileMeta.downloadUrl}`)}
      >
        <View style={[styles.fileIconContainer, { backgroundColor: mine ? "rgba(255,255,255,0.15)" : theme.colors.primaryLight }]}>
          <Ionicons name="document" size={18} color={mine ? "#FFF" : theme.colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              color: mine ? theme.colors.messageSentText : theme.colors.messageReceivedText,
              fontSize: 14,
              fontWeight: "500",
            }}
            numberOfLines={1}
          >
            {fileMeta.filename}
          </Text>
          <Text
            style={{
              color: mine ? "rgba(255,255,255,0.6)" : theme.colors.textSecondary,
              fontSize: 12,
              marginTop: 1,
            }}
          >
            {formatFileSize(fileMeta.size)}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={90}
    >
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        inverted
        contentContainerStyle={messages.length === 0 ? styles.emptyContainer : styles.list}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="chatbubble-outline" size={40} color={theme.colors.textSecondary} style={{ marginBottom: 12 }} />
            <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
              Say hello!
            </Text>
          </View>
        }
        renderItem={({ item, index }) => {
          const mine = isMine(item);
          const fileMeta = isFileMessage(item.content);
          const showSender = !mine && item.sender && conversation?.isGroup;

          // Group consecutive messages from same sender
          const nextMsg = index < messages.length - 1 ? messages[index + 1] : null;
          const prevMsg = index > 0 ? messages[index - 1] : null;
          const isFirstInGroup = !nextMsg || nextMsg.senderId !== item.senderId;
          const isLastInGroup = !prevMsg || prevMsg.senderId !== item.senderId;

          return (
            <View style={[
              styles.bubble,
              mine ? styles.bubbleRight : styles.bubbleLeft,
              { marginTop: isFirstInGroup ? 8 : 1, marginBottom: isLastInGroup ? 0 : 0 },
            ]}>
              <View
                style={[
                  styles.bubbleInner,
                  {
                    backgroundColor: mine ? theme.colors.messageSent : theme.colors.messageReceived,
                    borderBottomRightRadius: mine && !isLastInGroup ? 6 : 20,
                    borderBottomLeftRadius: !mine && !isLastInGroup ? 6 : 20,
                    borderTopRightRadius: mine && !isFirstInGroup ? 6 : 20,
                    borderTopLeftRadius: !mine && !isFirstInGroup ? 6 : 20,
                  },
                ]}
              >
                {showSender && isFirstInGroup && (
                  <Text style={[styles.senderName, { color: theme.colors.primary }]}>
                    {item.sender!.displayName || item.sender!.username}
                  </Text>
                )}
                {fileMeta ? (
                  renderFileContent(fileMeta, mine)
                ) : (
                  <Text
                    style={{
                      color: mine ? theme.colors.messageSentText : theme.colors.messageReceivedText,
                      fontSize: 15,
                      lineHeight: 21,
                    }}
                  >
                    {item.content}
                  </Text>
                )}
                <View style={styles.meta}>
                  <Text
                    style={[
                      styles.time,
                      {
                        color: mine ? "rgba(255,255,255,0.6)" : theme.colors.textSecondary,
                      },
                    ]}
                  >
                    {formatTime(item.createdAt)}
                  </Text>
                  {mine && (
                    <Ionicons
                      name={item.readBy.length > 1 ? "checkmark-done" : "checkmark"}
                      size={14}
                      color={item.readBy.length > 1 ? "#22C55E" : "rgba(255,255,255,0.4)"}
                      style={{ marginLeft: 4 }}
                    />
                  )}
                </View>
              </View>
            </View>
          );
        }}
      />

      {typingText && (
        <View style={[styles.typingBar, { backgroundColor: theme.colors.background }]}>
          <View style={styles.typingDots}>
            <View style={[styles.typingDot, { backgroundColor: theme.colors.textSecondary }]} />
            <View style={[styles.typingDot, { backgroundColor: theme.colors.textSecondary, opacity: 0.7 }]} />
            <View style={[styles.typingDot, { backgroundColor: theme.colors.textSecondary, opacity: 0.4 }]} />
          </View>
          <Text style={[styles.typingText, { color: theme.colors.textSecondary }]}>
            {typingText}
          </Text>
        </View>
      )}

      <View style={[styles.inputBar, { backgroundColor: theme.colors.card, borderTopColor: theme.colors.border }]}>
        <TouchableOpacity
          style={styles.attachButton}
          onPress={handleAttachment}
        >
          <Ionicons name="add" size={24} color={theme.colors.textSecondary} />
        </TouchableOpacity>
        <TextInput
          style={[styles.input, { backgroundColor: theme.colors.inputBg, color: theme.colors.text }]}
          placeholder="Type a message..."
          placeholderTextColor={theme.colors.textSecondary}
          value={text}
          onChangeText={handleTyping}
          multiline
          maxLength={5000}
        />
        <TouchableOpacity
          style={[
            styles.sendButton,
            {
              backgroundColor: text.trim() ? theme.colors.primary : "transparent",
            },
          ]}
          onPress={handleSend}
          disabled={!text.trim()}
        >
          <Ionicons
            name="send"
            size={18}
            color={text.trim() ? "#FFF" : theme.colors.textSecondary}
          />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const headerStyles = StyleSheet.create({
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  badge: {
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { justifyContent: "center", alignItems: "center" },
  list: { paddingHorizontal: 12, paddingVertical: 8 },
  emptyContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyState: { alignItems: "center", transform: [{ scaleY: -1 }] },
  emptyText: { fontSize: 16 },
  bubble: { maxWidth: "78%" },
  bubbleRight: { alignSelf: "flex-end" },
  bubbleLeft: { alignSelf: "flex-start" },
  bubbleInner: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  senderName: { fontSize: 12, fontWeight: "700", marginBottom: 2 },
  meta: { flexDirection: "row", justifyContent: "flex-end", alignItems: "center", marginTop: 3 },
  time: { fontSize: 10 },
  readStatus: { fontSize: 11, fontWeight: "600" },
  typingBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 6,
  },
  typingDots: { flexDirection: "row", gap: 3, marginRight: 8 },
  typingDot: { width: 5, height: 5, borderRadius: 2.5 },
  typingText: { fontSize: 12, fontStyle: "italic" },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  attachButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 2,
  },
  input: {
    flex: 1,
    minHeight: 36,
    maxHeight: 100,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 15,
    marginHorizontal: 6,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 2,
  },
  sendIcon: { fontSize: 16 },
  imageThumb: {
    width: 200,
    height: 200,
    borderRadius: 14,
  },
  fileRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
  },
  fileIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
});
