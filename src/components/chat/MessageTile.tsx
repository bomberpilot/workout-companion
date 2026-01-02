import React, { useMemo } from "react";
import { View, Text, Pressable, Dimensions } from "react-native";
import { ChatMessage } from "../../types/models";

export default function MessageTile({
  message,
  isMine,
  displayName,
  onPressUser,
}: {
  message: ChatMessage;
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
  const groupNote = (message as any)?.groupNote as string | undefined;
 const workoutNotes = (message as any)?.workoutNotes as string | undefined;
  const legacyNotes = (message as any)?.notes as string | undefined;
  const activityTypesRaw =
    (message as any)?.activityTypes ??
    (message as any)?.activityType ??
    (message as any)?.workoutTypes ??
    (message as any)?.workoutType;
  const activityTypes = Array.isArray(activityTypesRaw)
    ? activityTypesRaw
    : typeof activityTypesRaw === "string"
      ? [activityTypesRaw]
      : undefined;
  const durationMinutes = (message as any)?.durationMinutes as number | undefined;
  const type = (message as any)?.type as string | undefined;
  const notesText = groupNote || workoutNotes || legacyNotes || text;

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
            {activityTypes?.length
              ? activityTypes.map((t) => cap(String(t))).join(", ")
              : "Workout"}
          </Text>
        ) : null}

        {type === "workout" && typeof durationMinutes === "number" && durationMinutes > 0 ? (
          <Text style={{ marginTop: 6, opacity: 0.7 }}>{Math.round(durationMinutes)} min</Text>
        ) : null}

        {type === "workout" && notesText ? (
          <Text style={{ marginTop: 10, fontSize: 15, lineHeight: 20, opacity: 0.9 }}>
            {notesText}
          </Text>
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
