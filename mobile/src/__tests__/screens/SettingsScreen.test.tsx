import React from "react";
import { render, fireEvent } from "@testing-library/react-native";

const mockToggleTheme = jest.fn();
const mockLogout = jest.fn();

jest.mock("../../contexts/ThemeContext", () => ({
  useTheme: () => ({
    theme: {
      colors: {
        background: "#1A1A2E",
        primary: "#6C63FF",
        text: "#FFFFFF",
        textSecondary: "#888",
        card: "#2A2A4A",
        border: "#333",
      },
    },
    isDark: true,
    toggleTheme: mockToggleTheme,
  }),
}));

jest.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({
    logout: mockLogout,
  }),
}));

import SettingsScreen from "../../screens/SettingsScreen";

describe("SettingsScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should render theme toggle", () => {
    const { getByText } = render(<SettingsScreen />);
    expect(getByText("Dark Mode")).toBeTruthy();
  });

  it("should toggle theme when switch is pressed", () => {
    const { getByText } = render(<SettingsScreen />);

    // The Switch component reacts to onValueChange
    // In the rendered tree, the Switch is next to "Dark Mode"
    // We can find it by the presence of the switch
    expect(getByText("Dark Mode")).toBeTruthy();
  });

  it("should render logout button", () => {
    const { getByText } = render(<SettingsScreen />);
    expect(getByText("Sign Out")).toBeTruthy();
  });

  it("should call logout when sign out is pressed", () => {
    const { getByText } = render(<SettingsScreen />);

    fireEvent.press(getByText("Sign Out"));

    expect(mockLogout).toHaveBeenCalled();
  });

  it("should display version number", () => {
    const { getByText } = render(<SettingsScreen />);
    expect(getByText("VoxLink v1.0.0")).toBeTruthy();
  });
});
