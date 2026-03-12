import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";

// Mock contexts
const mockLogin = jest.fn();
const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
};

jest.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({
    login: mockLogin,
    user: null,
    loading: false,
  }),
}));

jest.mock("../../contexts/ThemeContext", () => ({
  useTheme: () => ({
    theme: {
      colors: {
        background: "#1A1A2E",
        primary: "#6C63FF",
        text: "#FFFFFF",
        textSecondary: "#888",
        inputBg: "#2A2A4A",
        border: "#333",
      },
    },
  }),
}));

jest.spyOn(Alert, "alert");

import LoginScreen from "../../screens/LoginScreen";

describe("LoginScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should render email and password fields", () => {
    const { getByPlaceholderText } = render(
      <LoginScreen navigation={mockNavigation as any} />
    );

    expect(getByPlaceholderText("Email")).toBeTruthy();
    expect(getByPlaceholderText("Password")).toBeTruthy();
  });

  it("should render sign in button", () => {
    const { getByText } = render(
      <LoginScreen navigation={mockNavigation as any} />
    );

    expect(getByText("Sign In")).toBeTruthy();
  });

  it("should trigger login on submit", async () => {
    mockLogin.mockResolvedValue(undefined);

    const { getByPlaceholderText, getByText } = render(
      <LoginScreen navigation={mockNavigation as any} />
    );

    fireEvent.changeText(getByPlaceholderText("Email"), "test@example.com");
    fireEvent.changeText(getByPlaceholderText("Password"), "SecurePass1");
    fireEvent.press(getByText("Sign In"));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith("test@example.com", "SecurePass1");
    });
  });

  it("should show validation error for empty fields", () => {
    const { getByText } = render(
      <LoginScreen navigation={mockNavigation as any} />
    );

    fireEvent.press(getByText("Sign In"));

    expect(Alert.alert).toHaveBeenCalledWith("Error", "Please fill in all fields");
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it("should navigate to register screen", () => {
    const { getByText } = render(
      <LoginScreen navigation={mockNavigation as any} />
    );

    fireEvent.press(getByText(/Sign Up/));

    expect(mockNavigation.navigate).toHaveBeenCalledWith("Register");
  });

  it("should show loading state during login", async () => {
    // Make login take time
    mockLogin.mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 1000)));

    const { getByPlaceholderText, getByText } = render(
      <LoginScreen navigation={mockNavigation as any} />
    );

    fireEvent.changeText(getByPlaceholderText("Email"), "test@example.com");
    fireEvent.changeText(getByPlaceholderText("Password"), "password");
    fireEvent.press(getByText("Sign In"));

    await waitFor(() => {
      expect(getByText("Signing in...")).toBeTruthy();
    });
  });

  it("should show error alert on login failure", async () => {
    mockLogin.mockRejectedValue(new Error("Invalid credentials"));

    const { getByPlaceholderText, getByText } = render(
      <LoginScreen navigation={mockNavigation as any} />
    );

    fireEvent.changeText(getByPlaceholderText("Email"), "test@example.com");
    fireEvent.changeText(getByPlaceholderText("Password"), "wrong");
    fireEvent.press(getByText("Sign In"));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith("Login Failed", "Invalid credentials");
    });
  });
});
