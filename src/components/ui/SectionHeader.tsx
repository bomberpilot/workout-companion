import React from "react";
import { Text, View, type StyleProp, type ViewStyle } from "react-native";

import { useTheme } from "../../theme/ThemeProvider";

type SectionHeaderProps = {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

export default function SectionHeader({ title, subtitle, action, style }: SectionHeaderProps) {
  const { colors, spacing, typography } = useTheme();

  return (
    <View style={[{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, style]}>
      <View style={{ flex: 1, paddingRight: spacing.sm }}>
        <Text style={{ fontSize: typography.size.lg, fontWeight: typography.weight.bold, color: colors.text.primary }}>
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={{
              marginTop: spacing.xs,
              fontSize: typography.size.sm,
              color: colors.text.muted,
              lineHeight: typography.lineHeight.relaxed,
            }}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {action ? <View>{action}</View> : null}
    </View>
  );
}
