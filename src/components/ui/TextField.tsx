import React from "react";
import { View, Text, TextInput } from "react-native";

export default function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  secureTextEntry,
}: {
  label?: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "email-address" | "number-pad";
  secureTextEntry?: boolean;
}) {
  return (
    <View style={{ marginTop: 14 }}>
      {label ? (
        <Text style={{ fontWeight: "800", marginBottom: 6 }}>{label}</Text>
      ) : null}

      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        keyboardType={keyboardType ?? "default"}
        secureTextEntry={secureTextEntry}
        autoCapitalize="none"
        style={{
          backgroundColor: "white",
          borderRadius: 14,
          paddingHorizontal: 14,
          paddingVertical: 14,
          borderWidth: 1,
          borderColor: "#e6e6e6",
          fontSize: 16,
        }}
      />
    </View>
  );
}
