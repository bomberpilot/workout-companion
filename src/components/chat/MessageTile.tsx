import React, { useMemo } from "react";
import { View, Text, Pressable, Dimensions } from "react-native";
import { Message } from "../../types/models";

export default function MessageTile({
  message,
  isMine,
  displayName,
  onPressUser,
}: {
  message: Message;
  isMine: boolean;
  displayName: string;
  onPressUser?: (userId: string) => void;
}) {
  const screenW = Dimensions.get("window").width;

  // 60% of available width, but bounded for tablets
  const bubbleW = useMemo(() => {
    const w = Math.floor(screenW * 0.6);
    return Math.max(220, Math.min(w, 360));
  }, [screenW]);

  const uid = (message as any)?.userId as string | undefined;
  const text = (message as any)?.text as string | undefined;
  const type = (message as any)?.type as string | undefined;

  return (
    <View
      style={{
        paddingHorizontal: 12,
        paddingVertical: 6,
        flexDirection: "row",
        justifyContent: isMine ? "flex-end" : "flex-start",
      }}
    >
      <View
        style={{
          width: bubbleW,
          borderRadius: 18,
          backgroundColor: "white",
          borderWidth: 1,
          borderColor: "#e6e6e6",
          padding: 12,
          minHeight: 120, // pushes toward "square-ish"
          shadowColor: "#000",
          shadowOpacity: 0.06,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 6 },
        }}
      >
        <Pressable
          disabled={!uid || !onPressUser}
          onPress={() => uid && onPressUser?.(uid)}
          style={{ alignSelf: "flex-start" }}
        >
          <Text style={{ fontWeight: "900", opacity: 0.85 }}>{displayName}</Text>
        </Pressable>

        {type === "workout" ? (
          <Text style={{ marginTop: 10, fontSize: 16, fontWeight: "900" }}>
            {(message as any)?.workoutType ? cap(String((message as any).workoutType)) : "Workout"}
          </Text>
        ) : null}

        {text ? (
          <Text style={{ marginTop: 10, fontSize: 15, lineHeight: 20, opacity: 0.9 }}>{text}</Text>
        ) : null}

        {/* subtle alignment cue */}
        <View style={{ flex: 1 }} />
        <View style={{ marginTop: 10, alignItems: isMine ? "flex-end" : "flex-start" }}>
          <View
            style={{
              height: 6,
              width: 22,
              borderRadius: 999,
              backgroundColor: isMine ? "#111" : "#cfcfcf",
              opacity: 0.35,
            }}
          />
        </View>
      </View>
    </View>
  );
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
