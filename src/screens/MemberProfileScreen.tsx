import React, { useEffect, useMemo, useState } from "react";
import { Alert, FlatList, Text, View } from "react-native";
import { RouteProp, useRoute } from "@react-navigation/native";
import { doc, getDocs, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc } from "firebase/firestore";

import { RootStackParamList } from "../navigation/RootNavigator";
import { useAuth } from "../auth/useAuth";
import { db } from "../config/firebase";
import Tile from "../components/ui/Tile";
import TextField from "../components/ui/TextField";
import Button from "../components/ui/Button";
import DatePickerModal from "../components/ui/DatePickerModal";
import { groupMemberDoc, userWorkoutsCol } from "../firestore/paths";

type R = RouteProp<RootStackParamList, "MemberProfile">;

type WorkoutRow = {
  activityTypes?: string[];
  durationMinutes?: number;
  date?: any;
  createdAt?: any;
  type?: string;
  workoutType?: string;
  notes?: string | null;
};

export default function MemberProfileScreen() {
  const { params } = useRoute<R>();
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState(params.userId.slice(0, 6));
  const [groupNickname, setGroupNickname] = useState<string | null>(null);
  const [target, setTarget] = useState<number | null>(null);
  const [workouts, setWorkouts] = useState<WorkoutRow[]>([]);
  const [goalDateISO, setGoalDateISO] = useState<string>(todayISO());
  const [goalStartDateISO, setGoalStartDateISO] = useState<string>(todayISO());
  const [targetWorkouts, setTargetWorkouts] = useState("0");
  const [showGoalCalendar, setShowGoalCalendar] = useState(false);
  const [showStartCalendar, setShowStartCalendar] = useState(false);
  const [savingGoal, setSavingGoal] = useState(false);
  const isSelf = user?.uid === params.userId;

  useEffect(() => {
    const unsubProfile = onSnapshot(doc(db, "users", params.userId), (snap) => {
      const dn = (snap.data() as any)?.displayName;
      if (typeof dn === "string" && dn.trim().length) setDisplayName(dn.trim());
    });

    const unsubGoal = onSnapshot(doc(db, "groups", params.groupId, "goals", params.userId), (snap) => {
      const g = snap.data() as any;
      if (typeof g?.targetWorkouts === "number") {
        setTarget(g.targetWorkouts);
        setTargetWorkouts(String(g.targetWorkouts));
      } else if (typeof g?.targetValue === "number") {
        setTarget(g.targetValue);
        setTargetWorkouts(String(g.targetValue));
      } else {
        setTarget(null);
        setTargetWorkouts("0");
      }
      if (typeof g?.goalDateISO === "string") {
        setGoalDateISO(g.goalDateISO);
      }
      if (typeof g?.goalStartDateISO === "string") {
        setGoalStartDateISO(g.goalStartDateISO);
      }
    });

    const unsubMember = onSnapshot(groupMemberDoc(params.groupId, params.userId), (snap) => {
      const nick = (snap.data() as any)?.nickname;
      if (typeof nick === "string" && nick.trim().length) {
        setGroupNickname(nick.trim());
      } else {
        setGroupNickname(null);
      }
    });

    return () => {
      unsubProfile();
      unsubGoal();
      unsubMember();
    };
  }, [params.groupId, params.userId]);

  useEffect(() => {
    (async () => {
      try {
        const wQuery = query(userWorkoutsCol(params.userId), orderBy("createdAt", "desc"), limit(40));
        const wSnap = await getDocs(wQuery);
        const rows = wSnap.docs.map((d) => d.data() as WorkoutRow);

        rows.sort((a, b) => {
          const ta = getWorkoutTime(a);
          const tb = getWorkoutTime(b);
          return tb - ta;
        });

        setWorkouts(rows);
      } catch (err: any) {
        Alert.alert("Workouts error", err?.message ?? "Unable to load workouts.");
      }
    })();
  }, [params.userId]);

  const completed = workouts.length;
  const ratio = useMemo(() => (target ? Math.min(1, completed / target) : 0), [completed, target]);
  const targetNum = useMemo(() => {
    const n = Number(targetWorkouts);
    return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
  }, [targetWorkouts]);

  async function saveGoal() {
    if (!user || !isSelf) return;
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

    setSavingGoal(true);
    try {
      await setDoc(
        doc(db, "groups", params.groupId, "goals", params.userId),
        {
          targetWorkouts: targetNum,
          goalDateISO: iso,
          goalStartDateISO: startIso,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      Alert.alert("Saved", "Your goal was updated.");
    } catch (err: any) {
      Alert.alert("Goal error", err?.message ?? "Unable to update goal.");
    } finally {
      setSavingGoal(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#f6f6f6", paddingTop: 12 }}>
      <FlatList
        data={workouts}
        keyExtractor={(_, idx) => String(idx)}
        ListHeaderComponent={
          <View>
            <Tile>
              <Text style={{ fontSize: 18, fontWeight: "900" }}>{groupNickname ?? displayName}</Text>
              <Text style={{ marginTop: 8, fontWeight: "800" }}>
                Progress: {completed} / {target ?? "—"}
              </Text>

              <View
                style={{
                  height: 10,
                  borderRadius: 999,
                  backgroundColor: "#e8e8e8",
                  marginTop: 10,
                  overflow: "hidden",
                }}
              >
                <View style={{ width: `${ratio * 100}%`, height: "100%", backgroundColor: "#111" }} />
              </View>

              <Text style={{ marginTop: 8, opacity: 0.6 }}>Recent workouts</Text>
            </Tile>

            {isSelf ? (
              <Tile>
                <Text style={{ fontSize: 16, fontWeight: "900" }}>Edit your goal</Text>
                <Text style={{ opacity: 0.7, marginTop: 6 }}>
                  Update your dates or total workouts for this group.
                </Text>

                <Text style={{ marginTop: 14, fontWeight: "800" }}>Goal start date</Text>
                <TextField
                  label="Goal start date (YYYY-MM-DD)"
                  value={goalStartDateISO}
                  onChangeText={setGoalStartDateISO}
                  placeholder="2026-01-01"
                />
                <Button title="Select start date" onPress={() => setShowStartCalendar(true)} />

                <Text style={{ marginTop: 14, fontWeight: "800" }}>Goal date</Text>
                <TextField
                  label="Goal date (YYYY-MM-DD)"
                  value={goalDateISO}
                  onChangeText={setGoalDateISO}
                  placeholder="2026-01-15"
                />
                <Button title="Select goal date" onPress={() => setShowGoalCalendar(true)} />

                <TextField
                  label="Workouts by that date"
                  value={targetWorkouts}
                  onChangeText={setTargetWorkouts}
                  placeholder="e.g., 12"
                  keyboardType="number-pad"
                />

                <Button
                  title={savingGoal ? "Saving…" : "Save goal updates"}
                  onPress={saveGoal}
                  disabled={savingGoal}
                />
              </Tile>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <Tile>
            <Text style={{ fontWeight: "900" }}>{formatWorkoutTitle(item)}</Text>
            {formatWorkoutMeta(item) ? (
              <Text style={{ marginTop: 6, opacity: 0.7 }}>{formatWorkoutMeta(item)}</Text>
            ) : null}
            {item.notes ? <Text style={{ marginTop: 6, opacity: 0.85 }}>{String(item.notes)}</Text> : null}
          </Tile>
        )}
      />

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
    </View>
  );
}

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
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

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatWorkoutTitle(item: WorkoutRow) {
  if (item.activityTypes?.length) return item.activityTypes.map((t) => cap(String(t))).join(", ");
  if (item.workoutType) return cap(String(item.workoutType));
  if (item.type) return cap(String(item.type));
  return "Workout";
}

function formatWorkoutMeta(item: WorkoutRow) {
  const parts: string[] = [];
  if (typeof item.durationMinutes === "number" && item.durationMinutes > 0) {
    parts.push(`${Math.round(item.durationMinutes)} min`);
  }
  const when = item.date ?? item.createdAt;
  if (when?.toDate) {
    parts.push(when.toDate().toLocaleDateString());
  }
  return parts.join(" • ");
}

function getWorkoutTime(item: WorkoutRow) {
  const when = item.date ?? item.createdAt;
  if (when?.toMillis) return when.toMillis();
  return 0;
}
