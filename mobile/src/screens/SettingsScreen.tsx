import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Switch } from "react-native";
import { useTheme } from "../contexts/ThemeContext";
import { useAuth } from "../contexts/AuthContext";

export default function SettingsScreen() {
  const { theme, isDark, toggleTheme } = useTheme();
  const { logout } = useAuth();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.section, { backgroundColor: theme.colors.card }]}>
        <View style={[styles.row, { borderBottomColor: theme.colors.border }]}>
          <Text style={[styles.label, { color: theme.colors.text }]}>Dark Mode</Text>
          <Switch
            value={isDark}
            onValueChange={toggleTheme}
            trackColor={{ true: theme.colors.primary, false: theme.colors.border }}
          />
        </View>
      </View>

      <View style={[styles.section, { backgroundColor: theme.colors.card }]}>
        <TouchableOpacity style={styles.row} onPress={logout}>
          <Text style={[styles.label, { color: "#EF4444" }]}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      <Text style={[styles.version, { color: theme.colors.textSecondary }]}>
        VoxLink v1.0.0
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 20 },
  section: { marginHorizontal: 16, borderRadius: 12, marginBottom: 20, overflow: "hidden" },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  label: { fontSize: 16 },
  version: { textAlign: "center", marginTop: 20, fontSize: 13 },
});
