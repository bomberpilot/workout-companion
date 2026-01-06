import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import DateTimePicker from "@react-native-community/datetimepicker";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";

import { RootStackParamList } from "../navigation/RootNavigator";
import { useAuth } from "../auth/useAuth";
import { db } from "../config/firebase";
import Tile from "../components/ui/Tile";
import TextField from "../components/ui/TextField";
import Button from "../components/ui/Button";
import DatePickerModal from "../components/ui/DatePickerModal";

type R = RouteProp<RootStackParamList, "GoalEdit">;
type Nav = NativeStackNavigationProp<RootStackParamList>;

type GoalEntry = {
  id: string;
  targetWorkouts: number;
  completedWorkouts?: number;
  goalDateISO?: string | null;
  goalStartDateISO?: string | null;
  goalDateReason?: string | null;
};

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function isoFromDate(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function dateFromISO(iso: string) {
  const [y, m, d] = iso.split("-").map((x) => Number(x));
  const dt = new Date();
  dt.setFullYear(y || dt.getFullYear());
  dt.setMonth((m || 1) - 1);
  dt.setDate(d || 1);
  dt.setHours(12, 0, 0, 0);
  return dt;
}

function parseISOToUTCDate(iso: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const da = Number(m[3]);
  if (mo < 1 || mo > 12 || da < 1 || da > 31) return null;
  return new Date(Date.UTC(y, mo - 1, da));
}

function inclusiveDaysBetween(startISO: string, endISO: string) {
  const start = parseISOToUTCDate(startISO);
  const end = parseISOToUTCDate(endISO);
  if (!start || !end) return 0;
  const ms = end.getTime() - start.getTime();
  if (ms < 0) return 0;
  return Math.floor(ms / 86400000) + 1;
}

function isValidISO(iso: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const da = Number(m[3]);
  if (mo < 1 || mo > 12) return false;
  if (da < 1 || da > 31) return false;
  if (y < 2000 || y > 2100) return false;
  return true;
}

function formatDateLabel(iso: string) {
  const parsed = parseISOToUTCDate(iso);
  if (!parsed) return iso;
  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function GoalEditScreen() {
  const { params } = useRoute<R>();
  const nav = useNavigation<Nav>();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [targetWorkouts, setTargetWorkouts] = useState("12");
  const [goalDateISO, setGoalDateISO] = useState<string>(todayISO());
  const [goalStartDateISO, setGoalStartDateISO] = useState<string>(todayISO());
  const [goalDateReason, setGoalDateReason] = useState("");
  const [showStartCalendar, setShowStartCalendar] = useState(false);
  const [saving, setSaving] = useState(false);
  const [goalEntries, setGoalEntries] = useState<GoalEntry[] | null>(null);
  const [goalIndex, setGoalIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "groups", params.groupId, "goals", params.userId));
        if (!snap.exists() || !active) return;
        const data = snap.data() as any;
        if (Array.isArray(data?.goalEntries)) {
          const entries: GoalEntry[] = data.goalEntries;
          const index = params.goalId
            ? entries.findIndex((entry) => entry.id === params.goalId)
            : 0;
          const resolvedIndex = index >= 0 ? index : 0;
          const entry = entries[resolvedIndex];
          setGoalEntries(entries);
          setGoalIndex(resolvedIndex);
          if (entry) {
            if (typeof entry.targetWorkouts === "number") setTargetWorkouts(String(entry.targetWorkouts));
            if (typeof entry.goalDateISO === "string") setGoalDateISO(entry.goalDateISO);
            if (typeof entry.goalStartDateISO === "string") setGoalStartDateISO(entry.goalStartDateISO);
            if (typeof entry.goalDateReason === "string") setGoalDateReason(entry.goalDateReason);
          }
          return;
        }

        const target = Number(data?.targetWorkouts ?? data?.targetValue ?? 0) || 0;
        if (target > 0) setTargetWorkouts(String(target));
        if (typeof data?.goalDateISO === "string") setGoalDateISO(data.goalDateISO);
        if (typeof data?.goalStartDateISO === "string") setGoalStartDateISO(data.goalStartDateISO);
        if (typeof data?.goalDateReason === "string") setGoalDateReason(data.goalDateReason);
      } catch (err: any) {
        Alert.alert("Goal error", err?.message ?? "Unable to load this goal.");
      }
    })();

    return () => {
      active = false;
    };
  }, [params.goalId, params.groupId, params.userId, user]);

  const targetNum = useMemo(() => {
    const n = Number(targetWorkouts);
    return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
  }, [targetWorkouts]);

  const workoutsPerDay = useMemo(() => {
    if (!isValidISO(goalStartDateISO) || !isValidISO(goalDateISO)) return null;
    const days = inclusiveDaysBetween(goalStartDateISO.trim(), goalDateISO.trim());
    if (days <= 0 || targetNum <= 0) return null;
    return targetNum / days;
  }, [goalStartDateISO, goalDateISO, targetNum]);

  const minGoalDate = useMemo(() => {
    if (!isValidISO(goalStartDateISO)) return undefined;
    return dateFromISO(goalStartDateISO);
  }, [goalStartDateISO]);

  async function save() {
    if (!user) return;

    if (targetNum < 1) {
      return Alert.alert("Goal", "Set a target workouts number (at least 1).");
    }

    const iso = goalDateISO.trim();
    const startIso = goalStartDateISO.trim();

    if (!isValidISO(startIso)) return Alert.alert("Goal start date", "Use format YYYY-MM-DD.");
    if (!isValidISO(iso)) return Alert.alert("Goal date", "Use format YYYY-MM-DD.");

    if (startIso > iso) {
      return Alert.alert("Goal dates", "Start date must be on or before the goal date.");
    }

    setSaving(true);
    try {
      const goalRef = doc(db, "groups", params.groupId, "goals", params.userId);
      if (goalEntries && goalIndex !== null) {
        const nextEntries = goalEntries.map((entry, idx) =>
          idx === goalIndex
            ? {
                ...entry,
                targetWorkouts: targetNum,
                goalDateISO: iso,
                goalStartDateISO: startIso,
                goalDateReason: goalDateReason.trim(),
              }
            : entry
        );
        const patch: Record<string, any> = {
          goalEntries: nextEntries,
          updatedAt: serverTimestamp(),
        };
        if (goalIndex === 0) {
          patch.targetWorkouts = targetNum;
          patch.goalDateISO = iso;
          patch.goalStartDateISO = startIso;
          patch.goalDateReason = goalDateReason.trim();
        }
        await setDoc(goalRef, patch, { merge: true });
      } else {
        await setDoc(
          goalRef,
          {
            targetWorkouts: targetNum,
            goalDateISO: iso,
            goalStartDateISO: startIso,
            goalDateReason: goalDateReason.trim(),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      }
      Alert.alert("Saved", "Your goal was updated.");
      nav.goBack();
    } catch (err: any) {
      Alert.alert("Goal error", err?.message ?? "Unable to update goal.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    Alert.alert("Delete goal?", "This will remove the goal from this group.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: deleteGoal },
    ]);
  }

  async function deleteGoal() {
    if (!user) return;
    setSaving(true);
    try {
      const goalRef = doc(db, "groups", params.groupId, "goals", params.userId);
      if (goalEntries && goalIndex !== null) {
        const nextEntries = goalEntries.filter((_, idx) => idx !== goalIndex);
        const patch: Record<string, any> = {
          goalEntries: nextEntries,
          updatedAt: serverTimestamp(),
        };
        if (nextEntries.length > 0) {
          const primary = nextEntries[0];
          patch.targetWorkouts = primary?.targetWorkouts ?? null;
          patch.goalDateISO = primary?.goalDateISO ?? null;
          patch.goalStartDateISO = primary?.goalStartDateISO ?? null;
          patch.goalDateReason = primary?.goalDateReason ?? "";
        } else {
          patch.targetWorkouts = null;
          patch.goalDateISO = null;
          patch.goalStartDateISO = null;
          patch.goalDateReason = "";
          patch.completedWorkouts = 0;
        }
        await setDoc(goalRef, patch, { merge: true });
      } else {
        await setDoc(
          goalRef,
          {
            targetWorkouts: null,
            goalDateISO: null,
            goalStartDateISO: null,
            goalDateReason: "",
            completedWorkouts: 0,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      }
      nav.goBack();
    } catch (err: any) {
      Alert.alert("Delete goal", err?.message ?? "Unable to delete this goal.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#f6f6f6" }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={headerHeight + insets.top}
    >
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 260 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets
      >
        <Tile>
          <Text style={{ fontSize: 20, fontWeight: "900" }}>Edit your goal</Text>
          <Text style={{ opacity: 0.7, marginTop: 6 }}>
            Update your target date, start date, and total workouts for this group.
          </Text>

          <Text style={{ marginTop: 18, fontWeight: "800" }}>Goal date</Text>

          <View
            style={{
              marginTop: 10,
              backgroundColor: "white",
              borderRadius: 16,
              borderWidth: 1,
              borderColor: "#e6e6e6",
              padding: 14,
              gap: 12,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View>
                <Text style={{ fontSize: 16, fontWeight: "900" }}>{formatDateLabel(goalDateISO)}</Text>
                <Text style={{ marginTop: 4, opacity: 0.65 }}>Select your updated target date</Text>
              </View>
              <View
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 999,
                  backgroundColor: "#f3f3f3",
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: "800" }}>{goalDateISO}</Text>
              </View>
            </View>

            <View style={{ borderRadius: 14, overflow: "hidden", backgroundColor: "#fafafa" }}>
              <DateTimePicker
                value={dateFromISO(goalDateISO)}
                mode="date"
                display={Platform.OS === "ios" ? "inline" : "calendar"}
                minimumDate={minGoalDate}
                themeVariant="light"
                onChange={(_, d) => {
                  if (d) setGoalDateISO(isoFromDate(d));
                }}
              />
            </View>

            <TextField
              label="Why is that date important? (optional)"
              value={goalDateReason}
              onChangeText={setGoalDateReason}
              placeholder="e.g., My trip to Hawaii"
            />
          </View>

          <View style={{ marginTop: 12, marginBottom: 6, flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={{ fontWeight: "800" }}>Workouts by that date</Text>
            <TextInput
              value={targetWorkouts}
              onChangeText={setTargetWorkouts}
              placeholder="12"
              keyboardType="number-pad"
              style={{
                minWidth: 64,
                textAlign: "center",
                backgroundColor: "white",
                borderRadius: 12,
                borderWidth: 1,
                borderColor: "#e6e6e6",
                paddingHorizontal: 10,
                paddingVertical: 6,
                fontSize: 16,
                fontWeight: "700",
              }}
            />
          </View>

          <View style={{ marginTop: 2, marginBottom: 6 }}>
            {workoutsPerDay !== null ? (
              <Text style={{ fontWeight: "800", color: workoutsPerDay > 1 ? "#b00020" : "#111" }}>
                Workouts per day: {workoutsPerDay.toFixed(2)}
              </Text>
            ) : (
              <Text style={{ opacity: 0.6 }}>Enter valid dates and a target to see workouts per day.</Text>
            )}
          </View>

          <Button title={saving ? "Saving…" : "Save goal"} onPress={save} disabled={saving} />

          <Pressable
            onPress={() => setShowStartCalendar(true)}
            style={{
              marginTop: 12,
              backgroundColor: "white",
              borderRadius: 14,
              borderWidth: 1,
              borderColor: "#e6e6e6",
              paddingVertical: 12,
              paddingHorizontal: 12,
              alignItems: "center",
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: "900" }}>Adjust goal start date</Text>
            <Text style={{ marginTop: 4, opacity: 0.65 }}>{goalStartDateISO}</Text>
          </Pressable>

          <View style={{ marginTop: 12 }}>
            <Button title="Delete goal" onPress={confirmDelete} disabled={saving} />
          </View>
        </Tile>
      </ScrollView>

      <DatePickerModal
        visible={showStartCalendar}
        title="Select your goal start date"
        initialDateISO={goalStartDateISO}
        maxDateISO={goalDateISO}
        onClose={() => setShowStartCalendar(false)}
        onSelect={(iso) => {
          setGoalStartDateISO(iso);
          if (iso > goalDateISO) setGoalDateISO(iso);
          setShowStartCalendar(false);
        }}
      />
    </KeyboardAvoidingView>
  );
}
