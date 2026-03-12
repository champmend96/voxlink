import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";

const mockRegister = jest.fn();
const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
};

jest.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({
    register: mockRegister,
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

import RegisterScreen from "../../screens/RegisterScreen";

describe("RegisterScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should render all required fields", () => {
    const { getByPlaceholderText } = render(
      <RegisterScreen navigation={mockNavigation as any} />
    );

    expect(getByPlaceholderText("Username")).toBeTruthy();
    expect(getByPlaceholderText("Email")).toBeTruthy();
    expect(getByPlaceholderText("Password")).toBeTruthy();
  });

  it("should show validation error for empty fields", () => {
    const { getByText } = render(
      <RegisterScreen navigation={mockNavigation as any} />
    );

    fireEvent.press(getByText("Create Account"));

    expect(Alert.alert).toHaveBeenCalledWith("Error", "Please fill in all fields");
  });

  it("should call register with correct data", async () => {
    mockRegister.mockResolvedValue(undefined);

    const { getByPlaceholderText, getByText } = render(
      <RegisterScreen navigation={mockNavigation as any} />
    );

    fireEvent.changeText(getByPlaceholderText("Username"), "newuser");
    fireEvent.changeText(getByPlaceholderText("Email"), "new@example.com");
    fireEvent.changeText(getByPlaceholderText("Password"), "SecurePass1");
    fireEvent.press(getByText("Create Account"));

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith("newuser", "new@example.com", "SecurePass1");
    });
  });

  it("should show error on registration failure", async () => {
    mockRegister.mockRejectedValue(new Error("Email already exists"));

    const { getByPlaceholderText, getByText } = render(
      <RegisterScreen navigation={mockNavigation as any} />
    );

    fireEvent.changeText(getByPlaceholderText("Username"), "user");
    fireEvent.changeText(getByPlaceholderText("Email"), "used@example.com");
    fireEvent.changeText(getByPlaceholderText("Password"), "SecurePass1");
    fireEvent.press(getByText("Create Account"));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith("Registration Failed", "Email already exists");
    });
  });

  it("should navigate back to login screen", () => {
    const { getByText } = render(
      <RegisterScreen navigation={mockNavigation as any} />
    );

    fireEvent.press(getByText(/Sign In/));

    expect(mockNavigation.goBack).toHaveBeenCalled();
  });

  it("should show loading state during registration", async () => {
    mockRegister.mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 1000)));

    const { getByPlaceholderText, getByText } = render(
      <RegisterScreen navigation={mockNavigation as any} />
    );

    fireEvent.changeText(getByPlaceholderText("Username"), "user");
    fireEvent.changeText(getByPlaceholderText("Email"), "e@e.com");
    fireEvent.changeText(getByPlaceholderText("Password"), "pass");
    fireEvent.press(getByText("Create Account"));

    await waitFor(() => {
      expect(getByText("Creating...")).toBeTruthy();
    });
  });
});
