import React, { useEffect, useMemo, useRef, useState } from "react";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Timestamp, doc, serverTimestamp, updateDoc } from "firebase/firestore";

import Button from "../ui/Button";
import TextField from "../ui/TextField";
import { userWorkoutsCol } from "../../firestore/paths";

type WorkoutRow = {
  id: string;
  activityTypes?: string[];
  durationMinutes?: number;
  date?: any;
  createdAt?: any;
  type?: string;
  workoutType?: string;
  notes?: string | null;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  workout: WorkoutRow | null;
  userId: string;
  onSaved?: (updated: WorkoutRow) => void;
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
  if (d.getFullYear() !== y || d.getMonth() !== mo - 1 || d.getDate() !== day) return null;
  return d;
}

function getWorkoutDate(workout: WorkoutRow | null) {
  if (workout?.date?.toDate) return workout.date.toDate();
  if (workout?.createdAt?.toDate) return workout.createdAt.toDate();
  return new Date();
}

export default function EditWorkoutModal({ visible, onClose, workout, userId, onSaved }: Props) {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView | null>(null);

  const [activityTypes, setActivityTypes] = useState<string[]>([]);
  const [hours, setHours] = useState<string>("0");
  const [minutes, setMinutes] = useState<string>("30");
  const [workoutDate, setWorkoutDate] = useState<Date>(new Date());
  const [dateText, setDateText] = useState<string>(formatDateYYYYMMDD(new Date()));
  const [showPicker, setShowPicker] = useState<boolean>(false);
  const [notes, setNotes] = useState<string>("");
  const [busy, setBusy] = useState<boolean>(false);

  useEffect(() => {
    if (!workout) return;
    const date = getWorkoutDate(workout);
    const duration = Math.max(0, Math.floor(Number(workout.durationMinutes || 0)));
    setActivityTypes(workout.activityTypes?.length ? workout.activityTypes : []);
    setHours(String(Math.floor(duration / 60)));
    setMinutes(String(duration % 60 || 0));
    setWorkoutDate(date);
    setDateText(formatDateYYYYMMDD(date));
    setNotes(String(workout.notes ?? ""));
    setShowPicker(false);
  }, [workout]);

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

  function handleClose() {
    onClose();
  }

  function validate(): { ok: boolean; message?: string } {
    if (!userId) return { ok: false, message: "Missing userId." };
    if (!workout?.id) return { ok: false, message: "Missing workout." };
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
      const payload = {
        activityTypes,
        durationMinutes,
        date: Timestamp.fromDate(parsed),
        notes: notes.trim(),
        updatedAt: serverTimestamp(),
      };

      await updateDoc(doc(userWorkoutsCol(userId), workout!.id), payload);

      onSaved?.({
        ...workout!,
        activityTypes,
        durationMinutes,
        date: Timestamp.fromDate(parsed),
        notes: notes.trim(),
      });
      handleClose();
    } catch (e: any) {
      Alert.alert("Could not update workout", e?.message || "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.35)",
          justifyContent: "flex-end",
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? insets.top : 0}
          style={{ flex: 1, justifyContent: "flex-end" }}
        >
          <View
            style={{
              backgroundColor: "white",
              borderTopLeftRadius: 26,
              borderTopRightRadius: 26,
              paddingHorizontal: 16,
              paddingTop: 14,
              paddingBottom: Math.max(18, insets.bottom + 12),
              maxHeight: "92%",
            }}
          >
            <View style={{ alignItems: "center", paddingBottom: 10 }}>
              <View
                style={{
                  width: 44,
                  height: 5,
                  borderRadius: 999,
                  backgroundColor: "#e6e6e6",
                  marginBottom: 10,
                }}
              />
              <Text style={{ fontSize: 18, fontWeight: "900" }}>Edit workout</Text>
              <Text style={{ marginTop: 4, opacity: 0.6 }}>Update the details for this entry.</Text>
            </View>

            <ScrollView
              ref={scrollRef}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: Math.max(40, insets.bottom + 40) }}
              showsVerticalScrollIndicator={false}
            >
              <Text style={{ fontWeight: "900", marginTop: 6, marginBottom: 10 }}>Activities</Text>

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
                        marginRight: 8,
                        marginBottom: 8,
                      }}
                    >
                      <Text style={{ color: selected ? "white" : "#111", fontWeight: "700" }}>{label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={{ fontWeight: "900", marginTop: 8 }}>Duration</Text>
              <View style={{ flexDirection: "row", gap: 12, marginTop: 8 }}>
                <TextField
                  label="Hours"
                  value={hours}
                  onChangeText={setHours}
                  keyboardType="number-pad"
                  placeholder="0"
                />
                <TextField
                  label="Minutes"
                  value={minutes}
                  onChangeText={setMinutes}
                  keyboardType="number-pad"
                  placeholder="30"
                />
              </View>

              <Text style={{ fontWeight: "900", marginTop: 12 }}>Workout date</Text>
              <TextField
                label="Date (YYYY-MM-DD)"
                value={dateText}
                onChangeText={setDateText}
                placeholder="2026-01-05"
              />
              <Pressable
                onPress={() => setShowPicker(true)}
                style={{
                  marginTop: 8,
                  alignSelf: "flex-start",
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 999,
                  backgroundColor: "#f3f3f3",
                }}
              >
                <Text style={{ fontWeight: "800" }}>Select date</Text>
              </Pressable>

              {showPicker ? (
                <View style={{ marginTop: 10, borderRadius: 14, overflow: "hidden", backgroundColor: "#fafafa" }}>
                  <DateTimePicker
                    value={workoutDate}
                    mode="date"
                    display={Platform.OS === "ios" ? "inline" : "calendar"}
                    themeVariant="light"
                    onChange={(_, d) => {
                      if (!d) return;
                      setWorkoutDate(d);
                      setDateText(formatDateYYYYMMDD(d));
                      if (Platform.OS !== "ios") setShowPicker(false);
                    }}
                  />
                </View>
              ) : null}

              <TextField
                label="Notes (optional)"
                value={notes}
                onChangeText={setNotes}
                placeholder="Add notes"
                multiline
              />

              <View style={{ marginTop: 12 }}>
                <Button title={busy ? "Saving…" : "Save changes"} onPress={onSubmit} disabled={busy} />
              </View>

              <View style={{ marginTop: 8 }}>
                <Button title="Cancel" onPress={handleClose} />
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}