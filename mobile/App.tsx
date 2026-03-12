import React from "react";
import { StatusBar } from "expo-status-bar";
import { ThemeProvider, useTheme } from "./src/contexts/ThemeContext";
import { AuthProvider } from "./src/contexts/AuthContext";
import { SocketProvider } from "./src/contexts/SocketContext";
import { CallProvider } from "./src/contexts/CallContext";
import AppNavigator from "./src/navigation";

function AppContent() {
  const { isDark } = useTheme();
  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} />
      <AuthProvider>
        <SocketProvider>
          <CallProvider>
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
