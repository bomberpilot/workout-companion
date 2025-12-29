// src/theme/ThemeProvider.tsx
import React, { createContext, useContext, useMemo } from "react";
import { useColorScheme } from "react-native";
import { getTheme, type Theme } from "./theme";

const ThemeContext = createContext<Theme | null>(null);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const scheme = useColorScheme() === "dark" ? "dark" : "light";

  const theme = useMemo(() => getTheme(scheme), [scheme]);

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): Theme => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
};
