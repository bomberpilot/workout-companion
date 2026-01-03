import React, { useMemo, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";

import { RootStackParamList } from "../navigation/RootNavigator";
import { useAuth } from "../auth/useAuth";
import { db } from "../config/firebase";
import Tile from "../components/ui/Tile";
import TextField from "../components/ui/TextField";
import Button from "../components/ui/Button";
import DatePickerModal from "../components/ui/DatePickerModal";

type R = RouteProp<RootStackParamList, "GoalSetup">;
type Nav = NativeStackNavigationProp<RootStackParamList>;

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
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

export default function GoalSetupScreen() {
  const { params } = useRoute<R>();
  const nav = useNavigation<Nav>();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [targetWorkouts, setTargetWorkouts] = useState("12");
  const [goalDateISO, setGoalDateISO] = useState<string>(todayISO());
  const [goalStartDateISO, setGoalStartDateISO] = useState<string>(todayISO());
  const [showGoalCalendar, setShowGoalCalendar] = useState(false);
  const [showStartCalendar, setShowStartCalendar] = useState(false);

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

    // Pull your own displayName so progress doesn't need cross-user reads
    let displayName = "";
    try {
      const snap = await getDoc(doc(db, "users", user.uid));
      displayName = String((snap.data() as any)?.displayName ?? "").trim();
    } catch {
      // non-fatal
    }
    if (!displayName) displayName = user.uid.slice(0, 6);

    // Ensure membership exists before writing goals
    try {
      await setDoc(
        doc(db, "groups", params.groupId, "members", user.uid),
        { userId: user.uid, joinDate: serverTimestamp() },
        { merge: true }
      );
    } catch {
      // non-fatal
    }

    await setDoc(
      doc(db, "groups", params.groupId, "goals", user.uid),
      {
        displayName,
        targetWorkouts: targetNum,
        goalDateISO: iso,
        goalStartDateISO: startIso,
        completedWorkouts: 0,
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      },
      { merge: true }
    );

    nav.navigate("Chat", { groupId: params.groupId });
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
          <Text style={{ fontSize: 20, fontWeight: "900" }}>Set your goal</Text>
          <Text style={{ opacity: 0.7, marginTop: 6 }}>
            Choose a goal start date, goal date, and how many workouts you want by then.
          </Text>

          <Text style={{ marginTop: 14, fontWeight: "800" }}>Goal start date</Text>

          <Pressable
            onPress={() => setShowStartCalendar(true)}
            style={{
              marginTop: 8,
              backgroundColor: "white",
              borderRadius: 14,
              borderWidth: 1,
              borderColor: "#e6e6e6",
              paddingVertical: 14,
              paddingHorizontal: 12,
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: "900" }}>{goalStartDateISO}</Text>
            <Text style={{ marginTop: 4, opacity: 0.65 }}>Tap to open calendar</Text>
          </Pressable>

          <TextField
            label="Goal start date (YYYY-MM-DD)"
            value={goalStartDateISO}
            onChangeText={setGoalStartDateISO}
            placeholder="2026-01-01"
          />

          <Text style={{ marginTop: 14, fontWeight: "800" }}>Goal date</Text>

          <Pressable
            onPress={() => setShowGoalCalendar(true)}
            style={{
              marginTop: 8,
              backgroundColor: "white",
              borderRadius: 14,
              borderWidth: 1,
              borderColor: "#e6e6e6",
              paddingVertical: 14,
              paddingHorizontal: 12,
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: "900" }}>{goalDateISO}</Text>
            <Text style={{ marginTop: 4, opacity: 0.65 }}>Tap to open calendar</Text>
          </Pressable>

          <TextField
            label="Goal date (YYYY-MM-DD)"
            value={goalDateISO}
            onChangeText={setGoalDateISO}
            placeholder="2026-01-15"
          />

          <TextField
            label="Workouts by that date"
            value={targetWorkouts}
            onChangeText={setTargetWorkouts}
            placeholder="e.g., 12"
            keyboardType="number-pad"
          />

          <View style={{ marginTop: 6, marginBottom: 6 }}>
            {workoutsPerDay !== null ? (
              <Text style={{ fontWeight: "800", color: workoutsPerDay > 1 ? "#b00020" : "#111" }}>
                Workouts per day: {workoutsPerDay.toFixed(2)}
              </Text>
            ) : (
              <Text style={{ opacity: 0.6 }}>Enter valid dates and a target to see workouts per day.</Text>
            )}
          </View>

          <Button title="Save goal" onPress={save} />
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
          setShowStartCalendar(false);
        }}
      />

      <DatePickerModal
        visible={showGoalCalendar}
        title="Select your goal date"
        initialDateISO={goalDateISO}
        minDateISO={goalStartDateISO}
        onClose={() => setShowGoalCalendar(false)}
        onSelect={(iso) => {
          setGoalDateISO(iso);
          setShowGoalCalendar(false);
        }}
      />
    </KeyboardAvoidingView>
  );
}
