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

type Props = NativeStackScreenProps<RootStackParamList, "Chat">;

const SERVER_URL = "http://localhost:3000";

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
      // Check if all participants have public keys for E2E indicator
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
        <View style={{ flexDirection: "row", alignItems: "center", marginRight: 8, gap: 4 }}>
          {isEncrypted && (
            <Text style={{ fontSize: 16, marginRight: 4 }}>{"\uD83D\uDD12"}</Text>
          )}
          {conversation.isGroup && (
            <TouchableOpacity
              style={{ padding: 4 }}
              onPress={() => {
                navigation.navigate("GroupCall", { conversationId });
              }}
            >
              <Text style={{ fontSize: 22 }}>{"\uD83D\uDC65"}</Text>
            </TouchableOpacity>
          )}
          {!conversation.isGroup && peer && (
            <>
              <TouchableOpacity
                style={{ padding: 4 }}
                onPress={() => {
                  initiateCall(peer.user.id, peer.user, "video");
                  navigation.navigate("OutgoingCall");
                }}
              >
                <Text style={{ fontSize: 22 }}>{"\u{1F4F9}"}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ padding: 4 }}
                onPress={() => {
                  initiateCall(peer.user.id, peer.user, "audio");
                  navigation.navigate("OutgoingCall");
                }}
              >
                <Text style={{ fontSize: 22 }}>{"\u{1F4DE}"}</Text>
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
        setMessages((prev) => [msg, ...prev]);
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
    } catch {}
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
        <Text style={styles.fileIcon}>{"\uD83D\uDCC4"}</Text>
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
              color: mine ? "rgba(255,255,255,0.7)" : theme.colors.textSecondary,
              fontSize: 12,
            }}
          >
            {formatFileSize(fileMeta.size)}
          </Text>
        </View>
        <Text style={{ fontSize: 18, marginLeft: 8 }}>{"\u2B07\uFE0F"}</Text>
      </TouchableOpacity>
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
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const mine = isMine(item);
          const fileMeta = isFileMessage(item.content);

          return (
            <View style={[styles.bubble, mine ? styles.bubbleRight : styles.bubbleLeft]}>
              <View
                style={[
                  styles.bubbleInner,
                  {
                    backgroundColor: mine
                      ? theme.colors.messageSent
                      : theme.colors.messageReceived,
                  },
                ]}
              >
                {!mine && item.sender && (
                  <Text style={[styles.senderName, { color: theme.colors.primary }]}>
                    {item.sender.displayName || item.sender.username}
                  </Text>
                )}
                {fileMeta ? (
                  renderFileContent(fileMeta, mine)
                ) : (
                  <Text
                    style={{
                      color: mine
                        ? theme.colors.messageSentText
                        : theme.colors.messageReceivedText,
                      fontSize: 15,
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
                        color: mine
                          ? "rgba(255,255,255,0.7)"
                          : theme.colors.textSecondary,
                      },
                    ]}
                  >
                    {formatTime(item.createdAt)}
                  </Text>
                  {mine && (
                    <Text
                      style={[
                        styles.readStatus,
                        {
                          color:
                            item.readBy.length > 1
                              ? "#22C55E"
                              : "rgba(255,255,255,0.5)",
                        },
                      ]}
                    >
                      {item.readBy.length > 1 ? " \u2713\u2713" : " \u2713"}
                    </Text>
                  )}
                </View>
              </View>
            </View>
          );
        }}
      />

      {typingText && (
        <View style={styles.typingBar}>
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
          <Text style={{ fontSize: 22, color: theme.colors.textSecondary }}>{"\uD83D\uDCCE"}</Text>
        </TouchableOpacity>
        <TextInput
          style={[styles.input, { backgroundColor: theme.colors.inputBg, color: theme.colors.text }]}
          placeholder="Message..."
          placeholderTextColor={theme.colors.textSecondary}
          value={text}
          onChangeText={handleTyping}
          multiline
          maxLength={5000}
        />
        <TouchableOpacity
          style={[styles.sendButton, { backgroundColor: text.trim() ? theme.colors.primary : theme.colors.inputBg }]}
          onPress={handleSend}
          disabled={!text.trim()}
        >
          <Text style={[styles.sendIcon, { color: text.trim() ? "#FFF" : theme.colors.textSecondary }]}>
            \u27A4
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { paddingHorizontal: 12, paddingVertical: 8 },
  bubble: { marginVertical: 2, maxWidth: "80%" },
  bubbleRight: { alignSelf: "flex-end" },
  bubbleLeft: { alignSelf: "flex-start" },
  bubbleInner: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18 },
  senderName: { fontSize: 12, fontWeight: "600", marginBottom: 2 },
  meta: { flexDirection: "row", justifyContent: "flex-end", marginTop: 2 },
  time: { fontSize: 11 },
  readStatus: { fontSize: 11 },
  typingBar: { paddingHorizontal: 20, paddingVertical: 4 },
  typingText: { fontSize: 13, fontStyle: "italic" },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  attachButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    marginRight: 8,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  sendIcon: { fontSize: 18 },
  imageThumb: {
    width: 180,
    height: 180,
    borderRadius: 12,
  },
  fileRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
  },
  fileIcon: {
    fontSize: 28,
    marginRight: 8,
  },
});
