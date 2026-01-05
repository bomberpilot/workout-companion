import React, { useState } from "react";
import { View, TextInput, Pressable, Text, Keyboard, ViewStyle } from "react-native";

type ComposerBarProps = {
  onSendText: (text: string) => Promise<void>;
  containerStyle?: ViewStyle;
  cardStyle?: ViewStyle;
};

export default function ComposerBar({ onSendText, containerStyle, cardStyle }: ComposerBarProps) {
  const [text, setText] = useState("");

  async function send() {
    const t = text.trim();
    if (!t.length) return;
    setText("");
    Keyboard.dismiss();
    await onSendText(t);
  }

  return (
    <View style={[{ padding: 12, backgroundColor: "#f6f6f6" }, containerStyle]}>
      <View
        style={[
          {
            backgroundColor: "white",
            borderRadius: 16,
            borderWidth: 1,
            borderColor: "#e6e6e6",
            padding: 10,
          },
          cardStyle,
        ]}
      >
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Message the group"
          style={{ fontSize: 16, paddingVertical: 8 }}
          returnKeyType="send"
          onSubmitEditing={send}
          blurOnSubmit
        />
        <Pressable
          onPress={send}
          style={{
            marginTop: 10,
            backgroundColor: "#111",
            paddingVertical: 12,
            borderRadius: 14,
            alignItems: "center",
          }}
        >
          <Text style={{ color: "white", fontWeight: "900" }}>Send</Text>
        </Pressable>
      </View>
    </View>
  );
}
