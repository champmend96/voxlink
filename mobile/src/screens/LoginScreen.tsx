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
} from "react-native";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { AuthStackParamList } from "../navigation";

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, "Login">;
};

export default function LoginScreen({ navigation }: Props) {
  const { login } = useAuth();
  const { theme } = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email || !password) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }
    setLoading(true);
    try {
      await login(email, password);
    } catch (err: any) {
      Alert.alert("Login Failed", err.message);
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
        <Text style={[styles.title, { color: theme.colors.primary }]}>VoxLink</Text>
        <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
          Sign in to continue
        </Text>

        <TextInput
          style={[styles.input, { backgroundColor: theme.colors.inputBg, color: theme.colors.text, borderColor: theme.colors.border }]}
          placeholder="Email"
          placeholderTextColor={theme.colors.textSecondary}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <TextInput
          style={[styles.input, { backgroundColor: theme.colors.inputBg, color: theme.colors.text, borderColor: theme.colors.border }]}
          placeholder="Password"
          placeholderTextColor={theme.colors.textSecondary}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.colors.primary }]}
          onPress={handleLogin}
          disabled={loading}
        >
          <Text style={styles.buttonText}>{loading ? "Signing in..." : "Sign In"}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate("Register")}>
          <Text style={[styles.link, { color: theme.colors.primary }]}>
            Don't have an account? Sign Up
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { flex: 1, justifyContent: "center", paddingHorizontal: 32 },
  title: { fontSize: 40, fontWeight: "800", textAlign: "center", marginBottom: 8 },
  subtitle: { fontSize: 16, textAlign: "center", marginBottom: 40 },
  input: {
    height: 52,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  button: {
    height: 52,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
    marginBottom: 24,
  },
  buttonText: { color: "#FFFFFF", fontSize: 17, fontWeight: "700" },
  link: { fontSize: 15, textAlign: "center" },
});
