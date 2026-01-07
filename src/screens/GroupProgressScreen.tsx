import React, { useEffect, useMemo, useState } from "react";
import { View, Text, FlatList, Alert, Share } from "react-native";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";

import { RootStackParamList } from "../navigation/RootNavigator";
import { useAuth } from "../auth/useAuth";
import { db } from "../config/firebase";
import Tile from "../components/ui/Tile";
import Button from "../components/ui/Button";
import { groupDoc, groupMemberDoc, groupMembersCol, userGroupDoc } from "../firestore/paths";
import { formatDurationMinutes } from "../utils/progress";

type R = RouteProp<RootStackParamList, "GroupProgress">;
type Nav = NativeStackNavigationProp<RootStackParamList, "GroupProgress">;

type Row = {
  userId: string;
  displayName: string;
  target: number;
  completed: number;
  totalDurationMinutes: number;
  goalDateISO?: string;
  goalDateReason?: string;
};

type GoalRow = {
  userId: string;
  target: number;
  completed: number;
  totalDurationMinutes: number;
  displayName?: string;
  goalDateISO?: string;
  goalDateReason?: string;
};

type GroupMeta = {
  name?: string;
  inviteCode?: string;
};

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
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

export default function GroupProgressScreen() {
  const { params } = useRoute<R>();
  const nav = useNavigation<Nav>();
  const { user, initializing } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [goalRows, setGoalRows] = useState<GoalRow[]>([]);
  const [memberNames, setMemberNames] = useState<Record<string, string>>({});
  const [group, setGroup] = useState<GroupMeta>({});

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
            const goalDateISO = typeof gd?.goalDateISO === "string" ? gd.goalDateISO : undefined;
            const goalDateReason = typeof gd?.goalDateReason === "string" ? gd.goalDateReason : undefined;
            return {
              userId: d.id,
              displayName,
              target,
              completed,
              totalDurationMinutes,
              goalDateISO,
              goalDateReason,
            };
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
    if (!user) return;
    const unsub = onSnapshot(
      groupDoc(params.groupId),
      (snap) => {
        const d = snap.data() as any;
        setGroup({ name: d?.name, inviteCode: d?.inviteCode });
      },
      (err) => Alert.alert("Group error", err.message)
    );
    return unsub;
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
      goalDateISO: row.goalDateISO,
      goalDateReason: row.goalDateReason,
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

  async function shareInviteCode() {
    const inviteCode = group.inviteCode?.trim();
    if (!inviteCode) {
      Alert.alert("Invite code", "No invite code available yet.");
      return;
    }

    const groupName = group.name?.trim();
    const message = groupName
      ? `Join my group "${groupName}" on Workout Companion! Use invite code: ${inviteCode}`
      : `Join my group on Workout Companion! Use invite code: ${inviteCode}`;

    try {
      await Share.share({ message });
    } catch (err: any) {
      Alert.alert("Share error", err?.message ?? "Unable to share invite code.");
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#f6f6f6", paddingTop: 12 }}>
      <Tile>
        <Text style={{ fontSize: 16, fontWeight: "900" }}>Membership</Text>
        <Text style={{ marginTop: 6, opacity: 0.7 }}>
          Leaving removes this group from your list and stops future messages.
        </Text>
      </Tile>

      <FlatList
        data={rows}
        keyExtractor={(r) => r.userId}
        renderItem={({ item }) => <ProgressRow row={item} />}
        ListEmptyComponent={
          <View style={{ padding: 16 }}>
            <Text style={{ opacity: 0.7 }}>No goals found yet for this group.</Text>
          </View>
        }
        ListFooterComponent={
          <View style={{ paddingHorizontal: 16, paddingBottom: 24 }}>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <Button title="Share invite code" onPress={shareInviteCode} style={{ flex: 1 }} />
              <Button title="Leave group" onPress={confirmLeaveGroup} style={{ flex: 1 }} />
            </View>
          </View>
        }
      />
    </View>
  );
}

function ProgressRow({ row }: { row: Row }) {
  const pct = useMemo(() => (row.target ? clamp01(row.completed / row.target) : 0), [row.completed, row.target]);
  const totalTimeLabel = useMemo(() => formatDurationMinutes(row.totalDurationMinutes || 0), [row.totalDurationMinutes]);
  const reason = row.goalDateReason?.trim() || "Why is this date important?";
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
          position: "relative",
          marginTop: 8,
          marginBottom: 8,
          minHeight: 22,
          justifyContent: "center",
        }}
      >
        <Text style={{ textAlign: "center", fontWeight: "700", opacity: row.goalDateReason ? 0.9 : 0.6 }}>
          {reason}
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
    </Tile>
  );
}
