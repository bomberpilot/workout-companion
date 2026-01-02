import React, { useMemo, useState } from "react";
import { View, Text, Pressable, Alert } from "react-native";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
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

export default function GoalSetupScreen() {
  const { params } = useRoute<R>();
  const nav = useNavigation<Nav>();
  const { user } = useAuth();

  const [targetWorkouts, setTargetWorkouts] = useState("12");
  const [goalDateISO, setGoalDateISO] = useState<string>(todayISO());
  const [showCalendar, setShowCalendar] = useState(false);

  const targetNum = useMemo(() => {
    const n = Number(targetWorkouts);
    return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
  }, [targetWorkouts]);

  async function save() {
    if (!user) return;

    if (targetNum < 1) {
      return Alert.alert("Goal", "Set a target workouts number (at least 1).");
    }

    const iso = goalDateISO.trim();
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    if (!m) return Alert.alert("Goal date", "Use format YYYY-MM-DD.");

    // Basic range sanity (doesn't check month lengths precisely, but blocks obvious typos)
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const da = Number(m[3]);
    if (mo < 1 || mo > 12) return Alert.alert("Goal date", "Month must be 01–12.");
    if (da < 1 || da > 31) return Alert.alert("Goal date", "Day must be 01–31.");
    if (y < 2000 || y > 2100) return Alert.alert("Goal date", "Year looks off. Use 2000–2100.");

    // Pull your own displayName so progress doesn't need cross-user reads
    let displayName = "";
    try {
      const snap = await getDoc(doc(db, "users", user.uid));
      displayName = String((snap.data() as any)?.displayName ?? "").trim();
    } catch {
      // non-fatal
    }
    if (!displayName) displayName = user.uid.slice(0, 6);

    await setDoc(
      doc(db, "groups", params.groupId, "goals", user.uid),
      {
        displayName,
        targetWorkouts: targetNum,
        goalDateISO: iso,
        completedWorkouts: 0,
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      },
      { merge: true }
    );

    nav.navigate("Chat", { groupId: params.groupId });
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#f6f6f6", padding: 16 }}>
      <Tile>
        <Text style={{ fontSize: 20, fontWeight: "900" }}>Set your goal</Text>
        <Text style={{ opacity: 0.7, marginTop: 6 }}>
          Choose a goal date and how many workouts you want by then.
        </Text>

        <Text style={{ marginTop: 14, fontWeight: "800" }}>Goal date</Text>

        <Pressable
          onPress={() => setShowCalendar(true)}
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

        <Button title="Save goal" onPress={save} />
      </Tile>

      <DatePickerModal
        visible={showCalendar}
        title="Select your goal date"
        initialDateISO={goalDateISO}
        minDateISO={todayISO()}
        onClose={() => setShowCalendar(false)}
        onSelect={(iso) => {
          setGoalDateISO(iso);
          setShowCalendar(false);
        }}
      />
    </View>
  );
}
