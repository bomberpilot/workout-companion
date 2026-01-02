import React, { useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";

import Button from "../ui/Button";
import TextField from "../ui/TextField";
import { logWorkoutFromGroupChat, logWorkoutToAllGroups } from "../../firestore/actions";

type Props = {
  visible: boolean;
  onClose: () => void;

  // Required
  userId: string;

  // If present, this modal is "contextual" to a specific group chat.
  // If absent, it's a global log that posts to all groups.
  groupId?: string;

  // Optional callback after a successful log (useful to close, refresh, etc.)
  onLogged?: () => void;
};

const ACTIVITY_OPTIONS = ["Cardio", "Strength", "Flexibility", "Sport", "Other"];

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function formatDateYYYYMMDD(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function parseYYYYMMDD(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const day = Number(m[3]);
  if (mo < 1 || mo > 12 || day < 1 || day > 31) return null;
  const d = new Date(y, mo - 1, day);
  // Validate round-trip (catches 2025-02-31)
  if (d.getFullYear() !== y || d.getMonth() !== mo - 1 || d.getDate() !== day) return null;
  return d;
}

export default function LogWorkoutModal({
  visible,
  onClose,
  userId,
  groupId,
  onLogged,
}: Props) {
  const isContextual = !!groupId;

  const [activityTypes, setActivityTypes] = useState<string[]>([]);
  const [hours, setHours] = useState<string>("0");
  const [minutes, setMinutes] = useState<string>("30");

  // Workout date: allow both graphical picker and manual entry
  const [workoutDate, setWorkoutDate] = useState<Date>(new Date());
  const [dateText, setDateText] = useState<string>(formatDateYYYYMMDD(new Date()));
  const [showPicker, setShowPicker] = useState<boolean>(false);

  // Global workout notes (stored on workout doc)
  const [notes, setNotes] = useState<string>("");

  // Group-only caption (stored only on the group message)
  const [groupNote, setGroupNote] = useState<string>("");

  const [busy, setBusy] = useState<boolean>(false);

  const durationMinutes = useMemo(() => {
    const h = Math.max(0, Math.floor(Number(hours || 0)));
    const m = Math.max(0, Math.floor(Number(minutes || 0)));
    return h * 60 + m;
  }, [hours, minutes]);

  function toggleActivity(label: string) {
    setActivityTypes((prev) => {
      const exists = prev.includes(label);
      if (exists) return prev.filter((x) => x !== label);
      return [...prev, label];
    });
  }

  function resetToDefaults() {
    const now = new Date();
    setActivityTypes([]);
    setHours("0");
    setMinutes("30");
    setWorkoutDate(now);
    setDateText(formatDateYYYYMMDD(now));
    setNotes("");
    setGroupNote("");
    setShowPicker(false);
    setBusy(false);
  }

  function handleClose() {
    // Keep state if you want; personally I prefer reset for a clean modal each time.
    resetToDefaults();
    onClose();
  }

  function validate(): { ok: boolean; message?: string } {
    if (!userId) return { ok: false, message: "Missing userId." };

    if (activityTypes.length === 0) {
      return { ok: false, message: "Select at least one activity type." };
    }

    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
      return { ok: false, message: "Enter a duration greater than 0 minutes." };
    }

    const parsed = parseYYYYMMDD(dateText);
    if (!parsed) {
      return { ok: false, message: "Enter a valid date as YYYY-MM-DD." };
    }

    return { ok: true };
  }

  async function onSubmit() {
    const v = validate();
    if (!v.ok) {
      Alert.alert("Check your entry", v.message || "Please correct the form.");
      return;
    }

    const parsed = parseYYYYMMDD(dateText)!;

    try {
      setBusy(true);

      if (isContextual && groupId) {
        await logWorkoutFromGroupChat({
          groupId,
          userId,
          activityTypes,
          durationMinutes,
          date: parsed,
          notes: notes.trim(), // GLOBAL notes persisted on workout doc
          groupNote: groupNote.trim(), // group-only caption persisted on message doc
        });
      } else {
        await logWorkoutToAllGroups({
          userId,
          activityTypes,
          durationMinutes,
          date: parsed,
          notes: notes.trim(), // GLOBAL notes persisted on workout doc
        });
      }

      onLogged?.();
      handleClose();
    } catch (e: any) {
      console.log("Log workout error:", e);
      Alert.alert("Could not log workout", e?.message || "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.35)",
          justifyContent: "flex-end",
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View
            style={{
              backgroundColor: "white",
              borderTopLeftRadius: 26,
              borderTopRightRadius: 26,
              paddingHorizontal: 16,
              paddingTop: 14,
              paddingBottom: 18,
              maxHeight: "92%",
            }}
          >
            {/* Header */}
            <View
              style={{
                alignItems: "center",
                paddingBottom: 10,
              }}
            >
              <View
                style={{
                  width: 44,
                  height: 5,
                  borderRadius: 999,
                  backgroundColor: "#e6e6e6",
                  marginBottom: 10,
                }}
              />
              <Text style={{ fontSize: 18, fontWeight: "900" }}>
                Log workout
              </Text>
              <Text style={{ marginTop: 4, opacity: 0.6 }}>
                {isContextual ? "Posts to this group" : "Posts to all groups"}
              </Text>
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 10 }}
              showsVerticalScrollIndicator={false}
            >
              {/* Activity multi-select */}
              <Text style={{ fontWeight: "900", marginTop: 6, marginBottom: 10 }}>
                Activities
              </Text>

              <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                {ACTIVITY_OPTIONS.map((label) => {
                  const selected = activityTypes.includes(label);
                  return (
                    <Pressable
                      key={label}
                      onPress={() => toggleActivity(label)}
                      style={{
                        paddingVertical: 10,
                        paddingHorizontal: 12,
                        borderRadius: 999,
                        borderWidth: 1,
                        borderColor: selected ? "#111" : "#e6e6e6",
                        backgroundColor: selected ? "#111" : "white",
                        marginRight: 10,
                        marginBottom: 10,
                      }}
                    >
                      <Text
                        style={{
                          fontWeight: "900",
                          color: selected ? "white" : "#111",
                        }}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* Duration */}
              <Text style={{ fontWeight: "900", marginTop: 8, marginBottom: 10 }}>
                Duration
              </Text>

              <View style={{ flexDirection: "row", gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: "800", opacity: 0.7, marginBottom: 6 }}>
                    Hours
                  </Text>
                  <TextField
                    value={hours}
                    onChangeText={setHours}
                    placeholder="0"
                    keyboardType="number-pad"
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: "800", opacity: 0.7, marginBottom: 6 }}>
                    Minutes
                  </Text>
                  <TextField
                    value={minutes}
                    onChangeText={setMinutes}
                    placeholder="30"
                    keyboardType="number-pad"
                  />
                </View>
              </View>

              <Text style={{ marginTop: 8, opacity: 0.65 }}>
                Total: {Math.floor(durationMinutes / 60)}h {durationMinutes % 60}m
              </Text>

              {/* Date */}
              <Text style={{ fontWeight: "900", marginTop: 16, marginBottom: 10 }}>
                Workout date
              </Text>

              <Text style={{ fontWeight: "800", opacity: 0.7, marginBottom: 6 }}>
                Type date (YYYY-MM-DD)
              </Text>
              <TextField
                value={dateText}
                onChangeText={(t) => {
                  setDateText(t);
                  const parsed = parseYYYYMMDD(t);
                  if (parsed) setWorkoutDate(parsed);
                }}
                placeholder="2025-12-29"
                autoCapitalize="none"
                autoCorrect={false}
              />

              <View style={{ height: 10 }} />

              <Button
                title={showPicker ? "Hide calendar" : "Pick from calendar"}
                onPress={() => setShowPicker((s) => !s)}
                variant="secondary"
                disabled={busy}
              />

              {showPicker ? (
                <View style={{ marginTop: 10 }}>
                  <DateTimePicker
                    value={workoutDate}
                    mode="date"
                    display={Platform.OS === "ios" ? "inline" : "default"}
                    onChange={(_, selected) => {
                      if (!selected) return;
                      setWorkoutDate(selected);
                      setDateText(formatDateYYYYMMDD(selected));
                    }}
                  />
                </View>
              ) : null}

              {/* Global Notes */}
              <Text style={{ fontWeight: "900", marginTop: 18, marginBottom: 10 }}>
                Notes (saved to your workout)
              </Text>

              <TextField
                value={notes}
                onChangeText={setNotes}
                placeholder="Optional notes for your workout..."
                multiline
              />

              {/* Group-only caption (contextual) */}
              {isContextual ? (
                <>
                  <Text style={{ fontWeight: "900", marginTop: 18, marginBottom: 10 }}>
                    Group caption (saved only to this group chat)
                  </Text>

                  <TextField
                    value={groupNote}
                    onChangeText={setGroupNote}
                    placeholder="Optional caption just for this group..."
                    multiline
                  />
                </>
              ) : null}

              {/* Actions */}
              <View style={{ height: 16 }} />

              <View style={{ flexDirection: "row", gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Button
                    title="Cancel"
                    onPress={handleClose}
                    variant="secondary"
                    disabled={busy}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Button
                    title={busy ? "Saving..." : "Save"}
                    onPress={onSubmit}
                    disabled={busy}
                  />
                </View>
              </View>

              <View style={{ height: 10 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}