// src/components/ui/Button.tsx

import React from "react";
import { Pressable, Text, ViewStyle } from "react-native";

type ButtonVariant = "primary" | "secondary" | "ghost";

type Props = {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: ButtonVariant;
  style?: ViewStyle;
};

export default function Button({ title, onPress, disabled, variant = "primary", style }: Props) {
  const base = {
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 16,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    opacity: disabled ? 0.55 : 1,
  };

  const variants: Record<ButtonVariant, ViewStyle> = {
    primary: {
      backgroundColor: "#111",
      borderWidth: 1,
      borderColor: "#111",
    },
    secondary: {
      backgroundColor: "white",
      borderWidth: 1,
      borderColor: "#e6e6e6",
    },
    ghost: {
      backgroundColor: "transparent",
      borderWidth: 1,
      borderColor: "transparent",
    },
  };

  const textColor =
    variant === "primary" ? "white" : variant === "secondary" ? "#111" : "#111";

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        base,
        variants[variant],
        pressed && !disabled ? { transform: [{ scale: 0.99 }] } : null,
        style,
      ]}
    >
      <Text style={{ fontSize: 16, fontWeight: "900", color: textColor }}>
        {title}
      </Text>
    </Pressable>
  );
}
