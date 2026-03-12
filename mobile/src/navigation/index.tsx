import React, { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { NavigationContainer, useNavigation } from "@react-navigation/native";
import { createNativeStackNavigator, NativeStackNavigationProp } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
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
import { Text } from "react-native";

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  Chat: { conversationId: string; title: string };
  OutgoingCall: undefined;
  IncomingCall: undefined;
  ActiveCall: undefined;
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

function TabIcon({ label, focused, color }: { label: string; focused: boolean; color: string }) {
  const icons: Record<string, string> = {
    Conversations: "\u{1F4AC}",
    Calls: "\u{1F4DE}",
    Settings: "\u2699\uFE0F",
    Profile: "\u{1F464}",
  };
  return (
    <Text style={{ fontSize: focused ? 24 : 20, opacity: focused ? 1 : 0.6 }}>
      {icons[label] || "\u2022"}
    </Text>
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
        headerStyle: { backgroundColor: theme.colors.card },
        headerTintColor: theme.colors.text,
        tabBarStyle: {
          backgroundColor: theme.colors.tabBar,
          borderTopColor: theme.colors.border,
        },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textSecondary,
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
                headerStyle: { backgroundColor: theme.colors.card },
                headerTintColor: theme.colors.text,
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
          </>
        ) : (
          <RootStack.Screen name="Auth" component={AuthNavigator} />
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
