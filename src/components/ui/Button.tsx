import React from "react";
import { Pressable, Text } from "react-native";

export default function Button({
  title,
  onPress,
  disabled,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={{
        marginTop: 14,
        backgroundColor: "#111",
        borderRadius: 16,
        paddingVertical: 14,
        alignItems: "center",
        opacity: disabled ? 0.7 : 1,
      }}
    >
      <Text style={{ color: "white", fontWeight: "900", fontSize: 16 }}>{title}</Text>
    </Pressable>
  );
}
