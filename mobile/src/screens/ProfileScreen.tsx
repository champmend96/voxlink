import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { useTheme } from "../contexts/ThemeContext";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../services/api";

export default function ProfileScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await api.users.updateProfile({ displayName });
      Alert.alert("Success", "Profile updated");
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.avatarSection}>
        <View style={[styles.avatar, { backgroundColor: theme.colors.primary }]}>
          <Text style={styles.avatarText}>{user?.username?.[0]?.toUpperCase()}</Text>
        </View>
        <Text style={[styles.username, { color: theme.colors.textSecondary }]}>
          @{user?.username}
        </Text>
      </View>

      <View style={[styles.section, { backgroundColor: theme.colors.card }]}>
        <Text style={[styles.fieldLabel, { color: theme.colors.textSecondary }]}>
          Display Name
        </Text>
        <TextInput
          style={[styles.input, { backgroundColor: theme.colors.inputBg, color: theme.colors.text, borderColor: theme.colors.border }]}
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="Display name"
          placeholderTextColor={theme.colors.textSecondary}
        />

        <Text style={[styles.fieldLabel, { color: theme.colors.textSecondary, marginTop: 16 }]}>
          Email
        </Text>
        <Text style={[styles.emailText, { color: theme.colors.text }]}>{user?.email}</Text>
      </View>

      <TouchableOpacity
        style={[styles.saveButton, { backgroundColor: theme.colors.primary }]}
        onPress={handleSave}
        disabled={saving}
      >
        <Text style={styles.saveText}>{saving ? "Saving..." : "Save Changes"}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 20 },
  avatarSection: { alignItems: "center", marginBottom: 24 },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  avatarText: { color: "#FFF", fontSize: 32, fontWeight: "700" },
  username: { fontSize: 16 },
  section: { marginHorizontal: 16, borderRadius: 12, padding: 16, marginBottom: 20 },
  fieldLabel: { fontSize: 13, marginBottom: 6 },
  input: {
    height: 44,
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 16,
    borderWidth: 1,
  },
  emailText: { fontSize: 16 },
  saveButton: {
    marginHorizontal: 16,
    height: 48,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  saveText: { color: "#FFF", fontSize: 16, fontWeight: "700" },
});
