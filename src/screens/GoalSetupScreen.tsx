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
  const [displayName, setDisplayName] = useState("");

  // Optional: pull displayName for future UI (non-blocking)
  React.useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        const d = snap.data() as any;
        if (d?.displayName) setDisplayName(d.displayName);
      } catch {
        // ignore
      }
    })();
  }, [user]);

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

    // Write goal fields onto the USER membership mirror doc:
    // users/{uid}/groups/{groupId}
    await setDoc(
      doc(db, "users", user.uid, "groups", params.groupId),
      {
        nickname: displayName || undefined,
        targetWorkouts: targetNum,
        goalDateISO: iso,
        goalUpdatedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
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

        <Pressable
          onPress={save}
          style={{
            marginTop: 12,
            backgroundColor: "#111",
            borderRadius: 18,
            paddingVertical: 14,
            alignItems: "center",
          }}
        >
          <Text style={{ color: "white", fontWeight: "900" }}>Save goal</Text>
        </Pressable>

        <View style={{ height: 10 }} />

        <Button title="Skip for now" onPress={() => nav.navigate("Chat", { groupId: params.groupId })} />
      </Tile>
    </View>
  );
}
