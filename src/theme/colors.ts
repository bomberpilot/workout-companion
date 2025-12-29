// src/theme/colors.ts
// Semantic color tokens for a minimalist blue system (light + dark).
// Keep usage semantic (accent.primary), never "blue500" in UI code.

export type ColorSchemeName = "light" | "dark";

export type Colors = {
  background: {
    primary: string;
    secondary: string;
    elevated: string;
  };
  surface: {
    card: string;
    cardAlt: string;
    input: string;
    modal: string;
  };
  text: {
    primary: string;
    secondary: string;
    muted: string;
    inverse: string;
  };
  border: {
    subtle: string;
    strong: string;
  };
  divider: {
    subtle: string;
  };
  accent: {
    primary: string;
    primaryMuted: string;
    secondary: string;
    onAccent: string;
  };
  state: {
    success: string;
    warning: string;
    danger: string;
    info: string;
  };
  overlay: {
    scrim: string;
  };
  shadow: {
    // Use for iOS shadowColor. Android uses elevation.
    color: string;
  };
};

const core = {
  // Blues (calm, modern, not neon)
  blue: {
    50: "#EEF6FF",
    100: "#D9ECFF",
    200: "#BBDCFF",
    300: "#8EC5FF",
    400: "#4FA6FF",
    500: "#1F8BFF",
    600: "#0B6FE6",
    700: "#0759B8",
  },

  // Neutrals (cool-leaning to match the blue system)
  neutral: {
    0: "#FFFFFF",
    25: "#FAFBFC",
    50: "#F5F7FA",
    100: "#EEF2F6",
    200: "#D9E1EA",
    300: "#C1CCD8",
    400: "#97A6B8",
    500: "#6E7F93",
    600: "#4D5B6C",
    700: "#33404D",
    800: "#1F2A33",
    900: "#0F1720",
    950: "#0A0F16",
  },

  // States (restrained)
  green: { 600: "#1F9D5A" },
  amber: { 600: "#D9822B" },
  red: { 600: "#D64545" },
};

export const lightColors: Colors = {
  background: {
    primary: core.neutral[25],
    secondary: core.neutral[50],
    elevated: core.neutral[0],
  },
  surface: {
    card: core.neutral[0],
    cardAlt: core.neutral[50],
    input: core.neutral[0],
    modal: core.neutral[0],
  },
  text: {
    primary: core.neutral[900],
    secondary: core.neutral[700],
    muted: core.neutral[500],
    inverse: core.neutral[0],
  },
  border: {
    subtle: core.neutral[100],
    strong: core.neutral[200],
  },
  divider: {
    subtle: core.neutral[100],
  },
  accent: {
    primary: core.blue[600],
    primaryMuted: core.blue[100],
    secondary: core.blue[500],
    onAccent: core.neutral[0],
  },
  state: {
    success: core.green[600],
    warning: core.amber[600],
    danger: core.red[600],
    info: core.blue[600],
  },
  overlay: {
    scrim: "rgba(15, 23, 32, 0.35)",
  },
  shadow: {
    color: "rgba(15, 23, 32, 0.18)",
  },
};

export const darkColors: Colors = {
  background: {
    primary: core.neutral[950],
    secondary: core.neutral[900],
    elevated: core.neutral[800],
  },
  surface: {
    card: core.neutral[900],
    cardAlt: core.neutral[800],
    input: core.neutral[900],
    modal: core.neutral[900],
  },
  text: {
    primary: core.neutral[0],
    secondary: core.neutral[200],
    muted: core.neutral[400],
    inverse: core.neutral[950],
  },
  border: {
    subtle: "rgba(217, 225, 234, 0.10)",
    strong: "rgba(217, 225, 234, 0.18)",
  },
  divider: {
    subtle: "rgba(217, 225, 234, 0.10)",
  },
  accent: {
    primary: core.blue[400],
    primaryMuted: "rgba(79, 166, 255, 0.16)",
    secondary: core.blue[300],
    onAccent: core.neutral[950],
  },
  state: {
    success: "#33C17A",
    warning: "#F2A65A",
    danger: "#FF6B6B",
    info: core.blue[400],
  },
  overlay: {
    scrim: "rgba(0, 0, 0, 0.55)",
  },
  shadow: {
    color: "rgba(0, 0, 0, 0.45)",
  },
};

// Optional helper for consistent alpha usage in JS without adding deps.
// Use sparingly, prefer tokens when possible.
export const withAlpha = (hex: string, alpha: number) => {
  const a = Math.max(0, Math.min(1, alpha));
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
};

export const colorsByScheme: Record<ColorSchemeName, Colors> = {
  light: lightColors,
  dark: darkColors,
};
