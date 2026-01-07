import React, { useEffect, useMemo, useState } from "react";
import { View, Text, FlatList, Alert } from "react-native";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";

import { RootStackParamList } from "../navigation/RootNavigator";
import { useAuth } from "../auth/useAuth";
import { db } from "../config/firebase";
import Tile from "../components/ui/Tile";
import Button from "../components/ui/Button";
import { groupMemberDoc, groupMembersCol, userGroupDoc } from "../firestore/paths";
import { formatDurationMinutes } from "../utils/progress";

type R = RouteProp<RootStackParamList, "GroupProgress">;
type Nav = NativeStackNavigationProp<RootStackParamList, "GroupProgress">;

type Row = {
  userId: string;
  displayName: string;
  target: number;
  completed: number;
  totalDurationMinutes: number;
  goalDateReason?: string;
  goalDateISO?: string;
};

type GoalRow = {
  userId: string;
  target: number;
  completed: number;
  totalDurationMinutes: number;
  displayName?: string;
  goalDateReason?: string;
  goalDateISO?: string;
};

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

export default function GroupProgressScreen() {
  const { params } = useRoute<R>();
  const nav = useNavigation<Nav>();
  const { user, initializing } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [goalRows, setGoalRows] = useState<GoalRow[]>([]);
  const [memberNames, setMemberNames] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!user) return;
    let active = true;
    let unsub = () => {};

    (async () => {
      try {
        await setDoc(
          doc(db, "groups", params.groupId, "members", user.uid),
          { userId: user.uid, joinDate: serverTimestamp() },
          { merge: true }
        );
      } catch {
        // non-fatal
      }

      if (!active) return;
      const goalsRef = collection(db, "groups", params.groupId, "goals");
      unsub = onSnapshot(
        goalsRef,
        (snap) => {
          const next: GoalRow[] = snap.docs.map((d) => {
            const gd = d.data() as any;
            const target = Number(gd?.targetWorkouts ?? 0) || 0;
            const completed = Number(gd?.completedWorkouts ?? 0) || 0;
            const totalDurationMinutes = Number(gd?.totalDurationMinutes ?? 0) || 0;
            const displayName = String(gd?.displayName ?? "").trim() || d.id.slice(0, 6);
            const goalEntries = Array.isArray(gd?.goalEntries) ? gd.goalEntries : [];
            const entryReason = goalEntries.find((entry: any) => typeof entry?.goalDateReason === "string");
            const entryDate = goalEntries.find((entry: any) => typeof entry?.goalDateISO === "string");
            const goalDateReason =
              (typeof entryReason?.goalDateReason === "string" ? entryReason.goalDateReason : undefined) ??
              (typeof gd?.goalDateReason === "string" ? gd.goalDateReason : undefined);
            const goalDateISO =
              (typeof entryDate?.goalDateISO === "string" ? entryDate.goalDateISO : undefined) ??
              (typeof gd?.goalDateISO === "string" ? gd.goalDateISO : undefined);
            return { userId: d.id, displayName, target, completed, totalDurationMinutes, goalDateReason, goalDateISO };
          });

          setGoalRows(next);
        },
        (err) => Alert.alert("Progress error", err.message)
      );
    })();

    return () => {
      active = false;
      unsub();
    };
  }, [params.groupId, user]);

  useEffect(() => {
    if (initializing || !user) return;
    const unsub = onSnapshot(
      groupMembersCol(params.groupId),
      (snap) => {
        const next: Record<string, string> = {};
        snap.docs.forEach((docSnap) => {
          const nick = (docSnap.data() as any)?.nickname;
          if (typeof nick === "string" && nick.trim().length) {
            next[docSnap.id] = nick.trim();
          }
        });
        setMemberNames(next);
      },
      (err) => Alert.alert("Members error", err.message)
    );
    return unsub;
  }, [initializing, params.groupId, user]);

  useEffect(() => {
    const nextRows: Row[] = goalRows.map((row) => ({
      userId: row.userId,
      target: row.target,
      completed: row.completed,
      totalDurationMinutes: row.totalDurationMinutes,
      displayName: memberNames[row.userId] ?? row.displayName ?? row.userId.slice(0, 6),
      goalDateReason: row.goalDateReason,
      goalDateISO: row.goalDateISO,
    }));

    nextRows.sort((a, b) => {
      const ra = a.target ? a.completed / a.target : 0;
      const rb = b.target ? b.completed / b.target : 0;
      return rb - ra || b.completed - a.completed;
    });

    setRows(nextRows);
  }, [goalRows, memberNames]);

  function confirmLeaveGroup() {
    Alert.alert("Leave group?", "You will stop seeing this group and its messages.", [
      { text: "Cancel", style: "cancel" },
      { text: "Leave", style: "destructive", onPress: leaveGroup },
    ]);
  }

  async function leaveGroup() {
    if (!user) return;
    nav.navigate("Home");
    try {
      await deleteDoc(groupMemberDoc(params.groupId, user.uid));
      await deleteDoc(userGroupDoc(user.uid, params.groupId));
    } catch (err: any) {
      Alert.alert("Leave group error", err?.message ?? "Unable to leave this group.");
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#f6f6f6", paddingTop: 12 }}>
      <FlatList
        data={rows}
        keyExtractor={(r) => r.userId}
        renderItem={({ item }) => <ProgressRow row={item} />}
        contentContainerStyle={{ paddingBottom: 16 }}
        ListEmptyComponent={
          <View style={{ padding: 16 }}>
            <Text style={{ opacity: 0.7 }}>No goals found yet for this group.</Text>
          </View>
        }
      />
      <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
        <Tile>
          <Text style={{ fontSize: 16, fontWeight: "900" }}>Membership</Text>
          <Text style={{ marginTop: 6, opacity: 0.7 }}>
            Leaving removes this group from your list and stops future messages.
          </Text>
          <Button title="Leave group" onPress={confirmLeaveGroup} />
        </Tile>
      </View>
    </View>
  );
}

function ProgressRow({ row }: { row: Row }) {
  const pct = useMemo(() => (row.target ? clamp01(row.completed / row.target) : 0), [row.completed, row.target]);
  const totalTimeLabel = useMemo(() => formatDurationMinutes(row.totalDurationMinutes || 0), [row.totalDurationMinutes]);
  const reasonLabel = row.goalDateReason?.trim() || "Why is this date important?";
  const targetLabel = row.goalDateISO ? formatGoalDate(row.goalDateISO) : "No target date";

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

      <View style={{ marginTop: 8, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={{ opacity: 0.6 }}>
          {row.target ? `${Math.round(pct * 100)}%` : "Set a target to track progress"}
        </Text>
        <Text style={{ opacity: 0.6, fontWeight: "700" }}>
          Total Workout Time: {totalTimeLabel}
        </Text>
      </View>

      <View
        style={{
          position: "relative",
          marginTop: 8,
          minHeight: 22,
          justifyContent: "center",
        }}
      >
        <Text style={{ textAlign: "center", fontWeight: "700", opacity: row.goalDateReason ? 0.9 : 0.6 }}>
          {reasonLabel}
        </Text>
        <View
          style={{
            position: "absolute",
            right: 0,
            top: 0,
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: 999,
            backgroundColor: "#f3f3f3",
          }}
        >
          <Text style={{ fontSize: 12, fontWeight: "800" }}>{targetLabel}</Text>
        </View>
      </View>
    </Tile>
  );
}

function formatGoalDate(iso: string) {
  const parsed = parseISOToUTCDate(iso);
  if (!parsed) return iso;
  return formatFriendlyDate(parsed);
}

function formatFriendlyDate(d: Date) {
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
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
