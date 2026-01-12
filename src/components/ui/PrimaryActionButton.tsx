import React, { useRef } from "react";
import { Animated, Pressable, Text, View } from "react-native";

import { useTheme } from "../../theme/ThemeProvider";

type PrimaryActionButtonProps = {
  title: string;
  subtitle?: string;
  onPress: () => void;
};

export default function PrimaryActionButton({ title, subtitle, onPress }: PrimaryActionButtonProps) {
  const { colors, radius, spacing, typography } = useTheme();
  const scale = useRef(new Animated.Value(1)).current;

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        Animated.timing(scale, {
          toValue: 0.98,
          duration: 140,
          useNativeDriver: true,
        }).start();
      }}
      onPressOut={() => {
        Animated.timing(scale, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }).start();
      }}
    >
      {({ pressed }) => (
        <Animated.View
          style={{
            transform: [{ scale }],
            backgroundColor: pressed ? colors.accent.primaryMuted : colors.accent.primary,
            borderRadius: radius.lg,
            paddingVertical: spacing.lg,
            paddingHorizontal: spacing.xl,
            alignItems: "center",
          }}
        >
          <Text
            style={{
              color: colors.accent.onAccent,
              fontSize: typography.size.md,
              fontWeight: typography.weight.bold,
            }}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text
              style={{
                marginTop: spacing.xs,
                color: colors.accent.onAccent,
                fontSize: typography.size.sm,
                opacity: 0.82,
              }}
            >
              {subtitle}
            </Text>
          ) : null}
        </Animated.View>
      )}
    </Pressable>
  );
}
