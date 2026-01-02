import React, { useEffect, useMemo, useState } from "react";
import { View, Text, FlatList, Alert } from "react-native";
import { RouteProp, useRoute } from "@react-navigation/native";
import { doc, getDocs, limit, onSnapshot, orderBy, query } from "firebase/firestore";

import { RootStackParamList } from "../navigation/RootNavigator";
import { db } from "../config/firebase";
import Tile from "../components/ui/Tile";
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
  const [displayName, setDisplayName] = useState(params.userId.slice(0, 6));
  const [groupNickname, setGroupNickname] = useState<string | null>(null);
  const [target, setTarget] = useState<number | null>(null);
  const [workouts, setWorkouts] = useState<WorkoutRow[]>([]);

  useEffect(() => {
    const unsubProfile = onSnapshot(doc(db, "users", params.userId), (snap) => {
      const dn = (snap.data() as any)?.displayName;
      if (typeof dn === "string" && dn.trim().length) setDisplayName(dn.trim());
    });

    const unsubGoal = onSnapshot(doc(db, "groups", params.groupId, "goals", params.userId), (snap) => {
      const g = snap.data() as any;
      if (typeof g?.targetWorkouts === "number") {
        setTarget(g.targetWorkouts);
      } else if (typeof g?.targetValue === "number") {
        setTarget(g.targetValue);
      } else {
        setTarget(null);
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

  return (
    <View style={{ flex: 1, backgroundColor: "#f6f6f6", paddingTop: 12 }}>
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

      <FlatList
        data={workouts}
        keyExtractor={(_, idx) => String(idx)}
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
    </View>
  );
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
