import React, { useEffect } from "react";
import { ActivityIndicator, View, Text, StyleSheet } from "react-native";
import { NavigationContainer, useNavigation } from "@react-navigation/native";
import { createNativeStackNavigator, NativeStackNavigationProp } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { useCall } from "../contexts/CallContext";
import LoginScreen from "../screens/LoginScreen";
import RegisterScreen from "../screens/RegisterScreen";
import ConversationListScreen from "../screens/ConversationListScreen";
import ChatScreen from "../screens/ChatScreen";
import SettingsScreen from "../screens/SettingsScreen";
import ProfileScreen from "../screens/ProfileScreen";
import CallHistoryScreen from "../screens/CallHistoryScreen";
import OutgoingCallScreen from "../screens/OutgoingCallScreen";
import IncomingCallScreen from "../screens/IncomingCallScreen";
import ActiveCallScreen from "../screens/ActiveCallScreen";
import GroupCallScreen from "../screens/GroupCallScreen";

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  Chat: { conversationId: string; title: string };
  OutgoingCall: undefined;
  IncomingCall: undefined;
  ActiveCall: undefined;
  GroupCall: { conversationId: string };
};

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export type MainTabParamList = {
  Conversations: undefined;
  Calls: undefined;
  Settings: undefined;
  Profile: undefined;
};

const RootStack = createNativeStackNavigator<RootStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

const TAB_ICONS: Record<string, { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap }> = {
  Conversations: { active: "chatbubble-ellipses", inactive: "chatbubble-ellipses-outline" },
  Calls: { active: "call", inactive: "call-outline" },
  Settings: { active: "settings", inactive: "settings-outline" },
  Profile: { active: "person", inactive: "person-outline" },
};

function TabIcon({ label, focused, color }: { label: string; focused: boolean; color: string }) {
  const icons = TAB_ICONS[label];
  const iconName = icons ? (focused ? icons.active : icons.inactive) : "ellipse";
  return (
    <Ionicons name={iconName} size={22} color={color} />
  );
}

function AuthNavigator() {
  const { theme } = useTheme();
  return (
    <AuthStack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Register" component={RegisterScreen} />
    </AuthStack.Navigator>
  );
}

function MainTabNavigator() {
  const { theme } = useTheme();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerStyle: {
          backgroundColor: theme.colors.headerBg,
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: theme.colors.border,
        },
        headerTintColor: theme.colors.text,
        headerTitleStyle: { fontWeight: "700", fontSize: 18 },
        tabBarStyle: {
          backgroundColor: theme.colors.tabBar,
          borderTopColor: theme.colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          height: 84,
          paddingBottom: 28,
          paddingTop: 8,
        },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textSecondary,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
        tabBarIcon: ({ focused, color }) => (
          <TabIcon label={route.name} focused={focused} color={color} />
        ),
      })}
    >
      <Tab.Screen
        name="Conversations"
        component={ConversationListScreen}
        options={{ title: "Chats" }}
      />
      <Tab.Screen
        name="Calls"
        component={CallHistoryScreen}
        options={{ title: "Calls" }}
      />
      <Tab.Screen name="Settings" component={SettingsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

function IncomingCallNavigator() {
  const { callStatus } = useCall();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  useEffect(() => {
    if (callStatus === "ringing") {
      navigation.navigate("IncomingCall");
    }
  }, [callStatus, navigation]);

  return null;
}

export default function AppNavigator() {
  const { user, loading } = useAuth();
  const { theme } = useTheme();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: theme.colors.background }}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer
      theme={{
        dark: theme.dark,
        colors: {
          primary: theme.colors.primary,
          background: theme.colors.background,
          card: theme.colors.card,
          text: theme.colors.text,
          border: theme.colors.border,
          notification: theme.colors.notification,
        },
      }}
    >
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <>
            <RootStack.Screen name="Main">
              {() => (
                <>
                  <MainTabNavigator />
                  <IncomingCallNavigator />
                </>
              )}
            </RootStack.Screen>
            <RootStack.Screen
              name="Chat"
              component={ChatScreen}
              options={({ route }) => ({
                headerShown: true,
                title: route.params.title,
                headerStyle: {
                  backgroundColor: theme.colors.headerBg,
                },
                headerTintColor: theme.colors.text,
                headerTitleStyle: { fontWeight: "600", fontSize: 17 },
                headerShadowVisible: false,
                headerBackTitleVisible: false,
              })}
            />
            <RootStack.Screen
              name="OutgoingCall"
              component={OutgoingCallScreen}
              options={{
                headerShown: false,
                presentation: "fullScreenModal",
                animation: "slide_from_bottom",
              }}
            />
            <RootStack.Screen
              name="IncomingCall"
              component={IncomingCallScreen}
              options={{
                headerShown: false,
                presentation: "fullScreenModal",
                animation: "slide_from_bottom",
              }}
            />
            <RootStack.Screen
              name="ActiveCall"
              component={ActiveCallScreen}
              options={{
                headerShown: false,
                presentation: "fullScreenModal",
                gestureEnabled: false,
              }}
            />
            <RootStack.Screen
              name="GroupCall"
              component={GroupCallScreen}
              options={{
                headerShown: false,
                presentation: "fullScreenModal",
                gestureEnabled: false,
              }}
            />
          </>
        ) : (
          <RootStack.Screen name="Auth" component={AuthNavigator} />
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
