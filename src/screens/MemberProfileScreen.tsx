import React, { useEffect, useMemo, useState } from "react";
import { View, Text, FlatList } from "react-native";
import { RouteProp, useRoute } from "@react-navigation/native";
import { collection, doc, getDocs, onSnapshot } from "firebase/firestore";

import { RootStackParamList } from "../navigation/RootNavigator";
import { db } from "../config/firebase";
import Tile from "../components/ui/Tile";
import { goalDoc } from "../firestore/paths";

type R = RouteProp<RootStackParamList, "MemberProfile">;

type WorkoutRow = {
  type: string;
  notes?: string | null;
  performedAt?: any;
};

export default function MemberProfileScreen() {
  const { params } = useRoute<R>();
  const [displayName, setDisplayName] = useState(params.userId.slice(0, 6));
  const [target, setTarget] = useState<number | null>(null);
  const [workouts, setWorkouts] = useState<WorkoutRow[]>([]);

  useEffect(() => {
    const unsubProfile = onSnapshot(doc(db, "users", params.userId), (snap) => {
      const dn = (snap.data() as any)?.displayName;
      if (typeof dn === "string" && dn.trim().length) setDisplayName(dn.trim());
    });

    const unsubGoal = onSnapshot(goalDoc(params.groupId, params.userId), (snap) => {
      const g = snap.data() as any;
      setTarget(typeof g?.targetWorkouts === "number" ? g.targetWorkouts : null);
    });

    return () => {
      unsubProfile();
      unsubGoal();
    };
  }, [params.groupId, params.userId]);

  useEffect(() => {
    (async () => {
      const wSnap = await getDocs(collection(db, "users", params.userId, "workouts"));
      const rows = wSnap.docs.map((d) => d.data() as any);

      // Sort locally by performedAt if present
      rows.sort((a: any, b: any) => {
        const ta = a.performedAt?.toMillis ? a.performedAt.toMillis() : 0;
        const tb = b.performedAt?.toMillis ? b.performedAt.toMillis() : 0;
        return tb - ta;
      });

      setWorkouts(rows.slice(0, 40));
    })();
  }, [params.userId]);

  const completed = workouts.length;
  const ratio = useMemo(() => (target ? Math.min(1, completed / target) : 0), [completed, target]);

  return (
    <View style={{ flex: 1, backgroundColor: "#f6f6f6", paddingTop: 12 }}>
      <Tile>
        <Text style={{ fontSize: 18, fontWeight: "900" }}>{displayName}</Text>
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
            <Text style={{ fontWeight: "900" }}>{cap(String(item.type ?? "workout"))}</Text>
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
