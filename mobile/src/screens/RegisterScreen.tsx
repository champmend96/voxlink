import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { AuthStackParamList } from "../navigation";
import { Ionicons } from "@expo/vector-icons";

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, "Register">;
};

export default function RegisterScreen({ navigation }: Props) {
  const { register } = useAuth();
  const { theme } = useTheme();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    if (!username || !email || !password) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }
    if (password.length < 6) {
      Alert.alert("Error", "Password must be at least 6 characters");
      return;
    }
    setLoading(true);
    try {
      await register(username, email, password);
    } catch (err: any) {
      Alert.alert("Registration Failed", err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.inner}>
        <View style={styles.headerSection}>
          <View style={[styles.logoCircle, { backgroundColor: theme.colors.primary }]}>
            <Ionicons name="chatbubbles" size={34} color="#FFF" />
          </View>
          <Text style={[styles.title, { color: theme.colors.text }]}>Create Account</Text>
          <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
            Join VoxLink today
          </Text>
        </View>

        <View style={styles.form}>
          <Text style={[styles.fieldLabel, { color: theme.colors.textSecondary }]}>Username</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.colors.card, color: theme.colors.text, borderColor: theme.colors.border }]}
            placeholder="Pick a username"
            placeholderTextColor={theme.colors.textSecondary}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
          />

          <Text style={[styles.fieldLabel, { color: theme.colors.textSecondary }]}>Email</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.colors.card, color: theme.colors.text, borderColor: theme.colors.border }]}
            placeholder="you@example.com"
            placeholderTextColor={theme.colors.textSecondary}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <Text style={[styles.fieldLabel, { color: theme.colors.textSecondary }]}>Password</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.colors.card, color: theme.colors.text, borderColor: theme.colors.border }]}
            placeholder="Min 6 characters"
            placeholderTextColor={theme.colors.textSecondary}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity
            style={[styles.button, { backgroundColor: theme.colors.primary, opacity: loading ? 0.7 : 1 }]}
            onPress={handleRegister}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <Text style={styles.buttonText}>Create Account</Text>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.linkRow}>
          <Text style={[styles.linkText, { color: theme.colors.textSecondary }]}>
            Already have an account?{" "}
          </Text>
          <Text style={[styles.linkAction, { color: theme.colors.primary }]}>Sign In</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { flex: 1, justifyContent: "center", paddingHorizontal: 28 },
  headerSection: { alignItems: "center", marginBottom: 36 },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  logoEmoji: { fontSize: 32 },
  title: { fontSize: 28, fontWeight: "800", marginBottom: 6 },
  subtitle: { fontSize: 15 },
  form: {},
  fieldLabel: { fontSize: 13, fontWeight: "600", marginBottom: 6, marginLeft: 4 },
  input: {
    height: 50,
    borderRadius: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  button: {
    height: 50,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 4,
  },
  buttonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  linkRow: { flexDirection: "row", justifyContent: "center", marginTop: 28 },
  linkText: { fontSize: 14 },
  linkAction: { fontSize: 14, fontWeight: "700" },
});
