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
import { WorkoutType } from "../../types/models";

const TYPES: WorkoutType[] = ["cardio", "strength", "flexibility", "sport", "other"];

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function GlobalWorkoutLogModal({
  visible,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (payload: { type: WorkoutType; notes?: string }) => Promise<void>;
}) {
  const insets = useSafeAreaInsets();
  const [type, setType] = useState<WorkoutType>("strength");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const notesClean = useMemo(() => {
    const t = notes.trim();
    return t.length ? t : undefined;
  }, [notes]);

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
                paddingBottom: Math.max(16, insets.bottom + 12),
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ fontSize: 18, fontWeight: "900" }}>Log workout</Text>
                <Pressable
                  onPress={() => {
                    Keyboard.dismiss();
                    onClose();
                  }}
                  style={{ padding: 8 }}
                >
                  <Text style={{ fontSize: 16, opacity: 0.7, fontWeight: "800" }}>Close</Text>
                </Pressable>
              </View>

              <Text style={{ marginTop: 10, opacity: 0.7 }}>
                This will post to every group you are in.
              </Text>

              <ScrollView keyboardShouldPersistTaps="handled">
                <Text style={{ marginTop: 14, fontWeight: "800" }}>Type</Text>

                <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 8 }}>
                  {TYPES.map((t) => (
                    <Pressable
                      key={t}
                      onPress={() => setType(t)}
                      style={{
                        paddingVertical: 8,
                        paddingHorizontal: 12,
                        borderRadius: 999,
                        borderWidth: 1,
                        borderColor: type === t ? "#111" : "#ddd",
                        marginRight: 8,
                        marginBottom: 8,
                        backgroundColor: type === t ? "#111" : "white",
                      }}
                    >
                      <Text style={{ fontWeight: "700", color: type === t ? "white" : "#111" }}>
                        {cap(t)}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <TextField
                  label="Notes (optional)"
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="A few notes, or a complaint"
                />

                <Pressable
                  onPress={submit}
                  disabled={submitting}
                  style={{
                    marginTop: 12,
                    backgroundColor: "#111",
                    borderRadius: 16,
                    paddingVertical: 14,
                    alignItems: "center",
                    opacity: submitting ? 0.7 : 1,
                  }}
                >
                  <Text style={{ color: "white", fontWeight: "900" }}>
                    {submitting ? "Posting…" : "Post to all groups"}
                  </Text>
                </Pressable>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}
