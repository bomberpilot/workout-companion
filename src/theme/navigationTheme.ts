import {
  DarkTheme as NavDark,
  DefaultTheme as NavLight,
  Theme as NavTheme,
} from "@react-navigation/native";
import type { Theme } from "./theme";

export const toNavigationTheme = (t: Theme): NavTheme => {
  const base = t.scheme === "dark" ? NavDark : NavLight;

  return {
    ...base,
    colors: {
      ...base.colors,
      background: t.colors.background.primary,
      card: t.colors.surface.card,
      text: t.colors.text.primary,
      border: t.colors.border.subtle,
      primary: t.colors.accent.primary,
      notification: t.colors.accent.secondary,
    },
  };
};
