import React, { useEffect } from "react";
import { Platform } from "react-native";
import { StatusBar } from "expo-status-bar";
import { ThemeProvider, useTheme } from "./src/contexts/ThemeContext";
import { AuthProvider, useAuth } from "./src/contexts/AuthContext";
import { SocketProvider } from "./src/contexts/SocketContext";
import { CallProvider } from "./src/contexts/CallContext";
import AppNavigator from "./src/navigation";
import { encryptionService } from "./src/services/encryption";
import { api } from "./src/services/api";

function PushRegistration() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    // Initialize E2E encryption and upload public key
    (async () => {
      try {
        const publicKey = await encryptionService.initialize();
        await api.keys.updateMyPublicKey(publicKey);
      } catch (err) {
        console.warn("E2E encryption init failed:", err);
      }
    })();

    // Register for push notifications
    (async () => {
      try {
        const Notifications = await import("expo-notifications");
        const { status } = await Notifications.requestPermissionsAsync();
        if (status === "granted") {
          const tokenData = await Notifications.getExpoPushTokenAsync();
          const platform = Platform.OS === "ios" ? "ios" : "android";
          await api.devices.register(tokenData.data, platform as "ios" | "android");
        }
      } catch {
        // Push notifications not available (e.g., simulator)
      }
    })();
  }, [user]);

  return null;
}

function AppContent() {
  const { isDark } = useTheme();
  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} />
      <AuthProvider>
        <SocketProvider>
          <CallProvider>
            <PushRegistration />
            <AppNavigator />
          </CallProvider>
        </SocketProvider>
      </AuthProvider>
    </>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}
