import React, { ReactElement } from "react";
import { render, RenderOptions } from "@testing-library/react-native";
import { NavigationContainer } from "@react-navigation/native";

// Mock providers wrapper for tests
function MockAuthProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function MockThemeProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function AllProviders({ children }: { children: React.ReactNode }) {
  return (
    <NavigationContainer>
      <MockThemeProvider>
        <MockAuthProvider>{children}</MockAuthProvider>
      </MockThemeProvider>
    </NavigationContainer>
  );
}

export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, "wrapper">
) {
  return render(ui, { wrapper: AllProviders, ...options });
}

export function createMockNavigation() {
  return {
    navigate: jest.fn(),
    goBack: jest.fn(),
    replace: jest.fn(),
    setOptions: jest.fn(),
    addListener: jest.fn().mockReturnValue(jest.fn()),
    dispatch: jest.fn(),
    reset: jest.fn(),
    isFocused: jest.fn().mockReturnValue(true),
    canGoBack: jest.fn().mockReturnValue(true),
    getId: jest.fn(),
    getParent: jest.fn(),
    getState: jest.fn(),
  } as any;
}

export function createMockRoute(params: Record<string, any> = {}) {
  return {
    key: "test-key",
    name: "TestScreen",
    params,
  } as any;
}
