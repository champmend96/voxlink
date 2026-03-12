export const lightTheme = {
  dark: false,
  colors: {
    primary: "#6C63FF",
    background: "#F5F5F8",
    card: "#FFFFFF",
    text: "#1A1A2E",
    textSecondary: "#6B7280",
    border: "#E5E7EB",
    notification: "#EF4444",
    inputBg: "#F0F0F5",
    messageSent: "#6C63FF",
    messageReceived: "#FFFFFF",
    messageSentText: "#FFFFFF",
    messageReceivedText: "#1A1A2E",
    online: "#22C55E",
    tabBar: "#FFFFFF",
  },
};

export const darkTheme = {
  dark: true,
  colors: {
    primary: "#7C73FF",
    background: "#0F0F1A",
    card: "#1A1A2E",
    text: "#F5F5F8",
    textSecondary: "#9CA3AF",
    border: "#2D2D44",
    notification: "#EF4444",
    inputBg: "#252540",
    messageSent: "#6C63FF",
    messageReceived: "#1A1A2E",
    messageSentText: "#FFFFFF",
    messageReceivedText: "#F5F5F8",
    online: "#22C55E",
    tabBar: "#1A1A2E",
  },
};

export type AppTheme = typeof lightTheme;
