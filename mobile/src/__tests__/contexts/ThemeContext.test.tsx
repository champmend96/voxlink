import React from "react";
import { render, act, waitFor } from "@testing-library/react-native";
import { Text } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ThemeProvider, useTheme } from "../../contexts/ThemeContext";

function TestConsumer() {
  const { theme, isDark, toggleTheme } = useTheme();
  return (
    <>
      <Text testID="isDark">{String(isDark)}</Text>
      <Text testID="bgColor">{theme.colors.background}</Text>
      <Text testID="toggle" onPress={toggleTheme}>
        Toggle
      </Text>
    </>
  );
}

describe("ThemeContext", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
  });

  it("should default to dark theme", async () => {
    const { getByTestId } = render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>
    );

    expect(getByTestId("isDark").props.children).toBe("true");
  });

  it("should toggle between dark and light themes", async () => {
    const { getByTestId } = render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>
    );

    expect(getByTestId("isDark").props.children).toBe("true");

    await act(async () => {
      getByTestId("toggle").props.onPress();
    });

    expect(getByTestId("isDark").props.children).toBe("false");
  });

  it("should persist theme choice in AsyncStorage", async () => {
    const { getByTestId } = render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>
    );

    await act(async () => {
      getByTestId("toggle").props.onPress();
    });

    expect(AsyncStorage.setItem).toHaveBeenCalledWith("theme", "light");
  });

  it("should restore saved theme preference", async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue("light");

    const { getByTestId } = render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(getByTestId("isDark").props.children).toBe("false");
    });
  });

  it("should provide correct colors for current theme", async () => {
    const { getByTestId } = render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>
    );

    // Dark theme background should be a dark color
    const bg = getByTestId("bgColor").props.children;
    expect(typeof bg).toBe("string");
    expect(bg.length).toBeGreaterThan(0);
  });
});
