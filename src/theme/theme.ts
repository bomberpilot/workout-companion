// src/theme/theme.ts
import { darkColors, lightColors, type Colors, type ColorSchemeName } from "./colors";

export type Theme = {
  scheme: ColorSchemeName;
  colors: Colors;

  // Design primitives (add as you formalize the system)
  radius: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
    pill: number;
  };
  spacing: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
    "2xl": number;
    "3xl": number;
  };
  typography: {
    // Keep simple now; expand later
    size: {
      xs: number;
      sm: number;
      md: number;
      lg: number;
      xl: number;
      "2xl": number;
    };
    weight: {
      regular: "400";
      medium: "500";
      semibold: "600";
      bold: "700";
    };
    lineHeight: {
      tight: number;
      normal: number;
      relaxed: number;
    };
  };
  shadow: {
    // iOS-friendly; Android should use elevation on components
    sm: {
      shadowColor: string;
      shadowOpacity: number;
      shadowRadius: number;
      shadowOffset: { width: number; height: number };
    };
    md: {
      shadowColor: string;
      shadowOpacity: number;
      shadowRadius: number;
      shadowOffset: { width: number; height: number };
    };
  };
};

const base = {
  radius: {
    xs: 6,
    sm: 10,
    md: 14,
    lg: 18,
    xl: 24,
    pill: 999,
  },
  spacing: {
    xs: 6,
    sm: 10,
    md: 14,
    lg: 18,
    xl: 24,
    "2xl": 32,
    "3xl": 40,
  },
  typography: {
    size: {
      xs: 12,
      sm: 14,
      md: 16,
      lg: 18,
      xl: 22,
      "2xl": 28,
    },
    weight: {
      regular: "400",
      medium: "500",
      semibold: "600",
      bold: "700",
    } as const,
    lineHeight: {
      tight: 18,
      normal: 22,
      relaxed: 26,
    },
  },
};

export const lightTheme: Theme = {
  scheme: "light",
  colors: lightColors,
  ...base,
  shadow: {
    sm: {
      shadowColor: lightColors.shadow.color,
      shadowOpacity: 1,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
    },
    md: {
      shadowColor: lightColors.shadow.color,
      shadowOpacity: 1,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 8 },
    },
  },
};

export const darkTheme: Theme = {
  scheme: "dark",
  colors: darkColors,
  ...base,
  shadow: {
    sm: {
      shadowColor: darkColors.shadow.color,
      shadowOpacity: 1,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 6 },
    },
    md: {
      shadowColor: darkColors.shadow.color,
      shadowOpacity: 1,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 10 },
    },
  },
};

export const getTheme = (scheme: ColorSchemeName): Theme =>
  scheme === "dark" ? darkTheme : lightTheme;
