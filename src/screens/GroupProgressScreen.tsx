// src/screens/GroupProgressScreen.tsx

import React, { useEffect, useMemo, useState } from "react";
import { View, Text, FlatList, Alert } from "react-native";
import { RouteProp, useRoute } from "@react-navigation/native";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";

import { RootStackParamList } from "../navigation/RootNavigator";
import { db } from "../config/firebase";
import Tile from "../components/ui/Tile";
import type { Group, GroupMember, Workout } from "../types/models";
import { calculateGroupProgress, formatDurationMinutes } from "../utils/progress";

type R = RouteProp<RootStackParamList, "GroupProgress">;

type Row = {
  userId: string;
  name: string;
  completed: number;
  target: number;
  pct: number;
};

export default function GroupProgressScreen() {
  const { params } = useRoute<R>();
  const [rows, setRows] = useState<Row[]>([]);
  const [goalTypeLabel, setGoalTypeLabel] = useState<string>("");

  useEffect(() => {
    (async () => {
      try {
        const gSnap = await getDoc(doc(db, "groups", params.groupId));
        if (!gSnap.exists()) throw new Error("Group not found.");
        const g = { id: gSnap.id, ...(gSnap.data() as any) } as Group;

        setGoalTypeLabel(g.goalType === "duration" ? "Minutes" : "Workouts");

        // Members
        const mSnap = await getDocs(collection(db, "groups", params.groupId, "members"));
        const members = mSnap.docs.map((d) => d.data() as GroupMember);

        const next: Row[] = [];

        for (const mem of members) {
          // Fallback to global displayName if nickname empty
          let name = (mem.nickname || "").trim();
          if (!name) {
            const uSnap = await getDoc(doc(db, "users", mem.userId));
            name = ((uSnap.data() as any)?.displayName as string) || mem.userId.slice(0, 6);
          }

          // Load workouts and compute progress
          const wSnap = await getDocs(collection(db, "users", mem.userId, "workouts"));
          const workouts: Workout[] = wSnap.docs.map((wd) => {
            const data = wd.data() as any;
            return {
              id: wd.id,
              userId: mem.userId,
              activityTypes: data.activityTypes ?? [],
              durationMinutes: Number(data.durationMinutes ?? 0) || 0,
              date: data.date,
              createdAt: data.createdAt,
              updatedAt: data.updatedAt,
            };
          });

          const p = calculateGroupProgress({
            goalType: g.goalType,
            targetValue: g.targetValue,
            startDate: g.startDate,
            endDate: g.endDate,
            workouts,
          });

          next.push({ userId: mem.userId, name, completed: p.completed, target: p.target, pct: p.pct });
        }

        next.sort((a, b) => b.pct - a.pct || b.completed - a.completed);
        setRows(next);
      } catch (e: any) {
        Alert.alert("Progress error", e?.message ?? "Unknown error");
      }
    })();
  }, [params.groupId]);

  return (
    <View style={{ flex: 1, backgroundColor: "#f6f6f6", paddingTop: 12 }}>
      <FlatList
        data={rows}
        keyExtractor={(r) => r.userId}
        renderItem={({ item }) => <ProgressRow row={item} goalTypeLabel={goalTypeLabel} />}
        ListEmptyComponent={
          <View style={{ padding: 16 }}>
            <Text style={{ opacity: 0.7 }}>No members found yet for this group.</Text>
          </View>
        }
      />
    </View>
  );
}

function ProgressRow({ row, goalTypeLabel }: { row: Row; goalTypeLabel: string }) {
  const pctText = useMemo(() => `${Math.round(row.pct * 100)}%`, [row.pct]);

  const rightLabel = useMemo(() => {
    if (goalTypeLabel === "Minutes") {
      return `${formatDurationMinutes(row.completed)} / ${formatDurationMinutes(row.target)}`;
    }
    return `${row.completed} / ${row.target || "—"}`;
  }, [row.completed, row.target, goalTypeLabel]);

  return (
    <Tile>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
        <Text style={{ fontSize: 16, fontWeight: "900" }}>{row.name}</Text>
        <Text style={{ opacity: 0.7, fontWeight: "800" }}>{rightLabel}</Text>
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
        <View style={{ width: `${row.pct * 100}%`, height: "100%", backgroundColor: "#111" }} />
      </View>

      <Text style={{ marginTop: 8, opacity: 0.6 }}>{row.target ? pctText : "Set a target to track progress"}</Text>
    </Tile>
  );
}