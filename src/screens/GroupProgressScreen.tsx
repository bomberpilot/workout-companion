import React, { useEffect, useMemo, useState } from "react";
import { View, Text, FlatList, Alert } from "react-native";
import { RouteProp, useRoute } from "@react-navigation/native";
import { collection, onSnapshot } from "firebase/firestore";

import { RootStackParamList } from "../navigation/RootNavigator";
import { db } from "../config/firebase";
import Tile from "../components/ui/Tile";

type R = RouteProp<RootStackParamList, "GroupProgress">;

type Row = {
  userId: string;
  displayName: string;
  target: number;
  completed: number;
};

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

export default function GroupProgressScreen() {
  const { params } = useRoute<R>();
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    const goalsRef = collection(db, "groups", params.groupId, "goals");
    const unsub = onSnapshot(
      goalsRef,
      (snap) => {
        const next: Row[] = snap.docs.map((d) => {
          const gd = d.data() as any;
          const target = Number(gd?.targetWorkouts ?? 0) || 0;
          const completed = Number(gd?.completedWorkouts ?? 0) || 0;
          const displayName = String(gd?.displayName ?? "").trim() || d.id.slice(0, 6);
          return { userId: d.id, displayName, target, completed };
        });

        next.sort((a, b) => {
          const ra = a.target ? a.completed / a.target : 0;
          const rb = b.target ? b.completed / b.target : 0;
          return rb - ra || b.completed - a.completed;
        });

        setRows(next);
      },
      (err) => Alert.alert("Progress error", err.message)
    );

    return unsub;
  }, [params.groupId]);

  return (
    <View style={{ flex: 1, backgroundColor: "#f6f6f6", paddingTop: 12 }}>
      <FlatList
        data={rows}
        keyExtractor={(r) => r.userId}
        renderItem={({ item }) => <ProgressRow row={item} />}
        ListEmptyComponent={
          <View style={{ padding: 16 }}>
            <Text style={{ opacity: 0.7 }}>No goals found yet for this group.</Text>
          </View>
        }
      />
    </View>
  );
}

function ProgressRow({ row }: { row: Row }) {
  const pct = useMemo(() => (row.target ? clamp01(row.completed / row.target) : 0), [row.completed, row.target]);

  return (
    <Tile>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
        <Text style={{ fontSize: 16, fontWeight: "900" }}>{row.displayName}</Text>
        <Text style={{ opacity: 0.7, fontWeight: "800" }}>
          {row.completed} / {row.target || "—"}
        </Text>
      </View>

      <View
        style={{
          height: 10,
          borderRadius: 999,
          backgroundColor: "#e8e8e8",
          marginTop: 10,
          overflow: "hidden",
        }}
      >
        <View style={{ width: `${pct * 100}%`, height: "100%", backgroundColor: "#111" }} />
      </View>

      <Text style={{ marginTop: 8, opacity: 0.6 }}>
        {row.target ? `${Math.round(pct * 100)}%` : "Set a target to track progress"}
      </Text>
    </Tile>
  );
}
