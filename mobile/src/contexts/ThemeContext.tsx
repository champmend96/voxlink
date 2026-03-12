import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { lightTheme, darkTheme, AppTheme } from "../theme";

interface ThemeContextType {
  theme: AppTheme;
  isDark: boolean;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: darkTheme,
  isDark: true,
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem("theme").then((val) => {
      if (val !== null) setIsDark(val === "dark");
    });
  }, []);

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    AsyncStorage.setItem("theme", next ? "dark" : "light");
  };

  return (
    <ThemeContext.Provider value={{ theme: isDark ? darkTheme : lightTheme, isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
