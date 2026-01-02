import React, { useMemo, useState } from "react";
import {
  Modal,
  View,
  Text,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableWithoutFeedback,
  Keyboard,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import TextField from "../ui/TextField";

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const TYPE_OPTIONS = ["strength", "cardio", "sport", "mobility", "other"] as const;
type WorkoutTypeLite = (typeof TYPE_OPTIONS)[number];

export default function GlobalWorkoutLogModal({
  visible,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (payload: { type: string; notes?: string }) => Promise<void>;
}) {
  const insets = useSafeAreaInsets();
  const [type, setType] = useState<WorkoutTypeLite>("strength");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const notesClean = useMemo(() => (notes ?? "").trim(), [notes]);

  async function submit() {
    if (submitting) return;
    setSubmitting(true);
    try {
      await onSubmit({ type, notes: notesClean });
      setNotes("");
      setType("strength");
      Keyboard.dismiss();
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent presentationStyle="overFullScreen">
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" }}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <View
              style={{
                backgroundColor: "white",
                padding: 16,
                borderTopLeftRadius: 18,
                borderTopRightRadius: 18,
                paddingBottom: Math.max(16, insets.bottom + 10),
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ fontSize: 18, fontWeight: "900" }}>Log workout</Text>
                <Pressable onPress={onClose} style={{ padding: 8 }}>
                  <Text style={{ fontWeight: "900" }}>Close</Text>
                </Pressable>
              </View>

              <Text style={{ opacity: 0.7, marginTop: 6 }}>
                This logs to your personal workouts and posts a message to each group.
              </Text>

              <Text style={{ marginTop: 14, fontWeight: "800" }}>Type</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  {TYPE_OPTIONS.map((t) => {
                    const selected = t === type;
                    return (
                      <Pressable
                        key={t}
                        onPress={() => setType(t)}
                        style={{
                          paddingVertical: 10,
                          paddingHorizontal: 14,
                          borderRadius: 999,
                          borderWidth: 1,
                          borderColor: selected ? "#111" : "#ddd",
                          backgroundColor: selected ? "#111" : "white",
                        }}
                      >
                        <Text style={{ fontWeight: "900", color: selected ? "white" : "#111" }}>
                          {cap(t)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>

              <TextField
                label="Notes (optional)"
                value={notes}
                onChangeText={setNotes}
                placeholder="Anything you want to add…"
                multiline
              />

              <Pressable
                onPress={submit}
                style={{
                  marginTop: 12,
                  backgroundColor: submitting ? "#444" : "#111",
                  borderRadius: 18,
                  paddingVertical: 14,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: "white", fontWeight: "900" }}>
                  {submitting ? "Logging…" : "Log workout"}
                </Text>
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}
