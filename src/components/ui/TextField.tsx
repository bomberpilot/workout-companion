import React from "react";
import { Text, TextInput, View, TextInputProps } from "react-native";

type Props = {
  label?: string;
} & TextInputProps;

export default function TextField({ label, style, ...props }: Props) {
  const multiline = !!props.multiline;

  return (
    <View style={{ marginBottom: 10 }}>
      {label ? (
        <Text style={{ fontWeight: "800", opacity: 0.7, marginBottom: 6 }}>
          {label}
        </Text>
      ) : null}

      <TextInput
        {...props}
        style={[
          {
            backgroundColor: "white",
            borderRadius: 14,
            borderWidth: 1,
            borderColor: "#e6e6e6",
            paddingHorizontal: 12,
            paddingVertical: multiline ? 12 : 12,
            fontSize: 16,
          },
          multiline ? { minHeight: 96, textAlignVertical: "top" as const } : null,
          style,
        ]}
      />
    </View>
  );
}

