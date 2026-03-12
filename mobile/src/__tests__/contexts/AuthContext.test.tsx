import React from "react";
import { render, act, waitFor } from "@testing-library/react-native";
import { Text } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AuthProvider, useAuth } from "../../contexts/AuthContext";

// Mock the API module
jest.mock("../../services/api", () => ({
  api: {
    auth: {
      login: jest.fn(),
      register: jest.fn(),
      me: jest.fn(),
    },
  },
}));

const { api } = require("../../services/api");

function TestConsumer() {
  const { user, loading, login, register, logout } = useAuth();
  return (
    <>
      <Text testID="loading">{String(loading)}</Text>
      <Text testID="user">{user ? JSON.stringify(user) : "null"}</Text>
      <Text testID="login" onPress={() => login("test@example.com", "password")}>
        Login
      </Text>
      <Text testID="register" onPress={() => register("user", "test@example.com", "password")}>
        Register
      </Text>
      <Text testID="logout" onPress={() => logout()}>
        Logout
      </Text>
    </>
  );
}

describe("AuthContext", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
  });

  it("should store tokens on login", async () => {
    const mockResponse = {
      user: { id: "1", username: "test", email: "test@example.com" },
      accessToken: "access-token",
      refreshToken: "refresh-token",
    };
    api.auth.login.mockResolvedValue(mockResponse);

    const { getByTestId } = render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(getByTestId("loading").props.children).toBe("false");
    });

    await act(async () => {
      getByTestId("login").props.onPress();
    });

    expect(AsyncStorage.setItem).toHaveBeenCalledWith("accessToken", "access-token");
    expect(AsyncStorage.setItem).toHaveBeenCalledWith("refreshToken", "refresh-token");
  });

  it("should clear tokens on logout", async () => {
    const { getByTestId } = render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(getByTestId("loading").props.children).toBe("false");
    });

    await act(async () => {
      getByTestId("logout").props.onPress();
    });

    expect(AsyncStorage.multiRemove).toHaveBeenCalledWith(["accessToken", "refreshToken"]);
  });

  it("should auto-check auth on mount when token exists", async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue("stored-token");
    api.auth.me.mockResolvedValue({ id: "1", username: "test" });

    const { getByTestId } = render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(getByTestId("loading").props.children).toBe("false");
      expect(getByTestId("user").props.children).not.toBe("null");
    });

    expect(api.auth.me).toHaveBeenCalled();
  });

  it("should register and store tokens", async () => {
    const mockResponse = {
      user: { id: "2", username: "newuser", email: "new@example.com" },
      accessToken: "new-access",
      refreshToken: "new-refresh",
    };
    api.auth.register.mockResolvedValue(mockResponse);

    const { getByTestId } = render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(getByTestId("loading").props.children).toBe("false");
    });

    await act(async () => {
      getByTestId("register").props.onPress();
    });

    expect(AsyncStorage.setItem).toHaveBeenCalledWith("accessToken", "new-access");
    expect(AsyncStorage.setItem).toHaveBeenCalledWith("refreshToken", "new-refresh");
  });

  it("should clear tokens when auto-check fails", async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue("expired-token");
    api.auth.me.mockRejectedValue(new Error("Invalid token"));

    const { getByTestId } = render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(getByTestId("loading").props.children).toBe("false");
      expect(getByTestId("user").props.children).toBe("null");
    });

    expect(AsyncStorage.multiRemove).toHaveBeenCalledWith(["accessToken", "refreshToken"]);
  });
});
