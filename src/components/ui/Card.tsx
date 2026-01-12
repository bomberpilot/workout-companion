import React, { useRef } from "react";
import { Animated, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { useTheme } from "../../theme/ThemeProvider";

type CardProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
};

export default function Card({ children, style, onPress }: CardProps) {
  const { colors, radius, shadow, spacing } = useTheme();
  const scale = useRef(new Animated.Value(1)).current;

  const baseStyle: ViewStyle = {
    backgroundColor: colors.surface.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.subtle,
    ...shadow.sm,
  };

  if (!onPress) {
    return <View style={[baseStyle, style]}>{children}</View>;
  }

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
          style={[
            baseStyle,
            style,
            {
              transform: [{ scale }],
              backgroundColor: pressed ? colors.surface.cardAlt : colors.surface.card,
            },
          ]}
        >
          {children}
        </Animated.View>
      )}
    </Pressable>
  );
}
