import React, { useEffect, useMemo, useState } from "react";
import { Alert, FlatList, Share, StyleSheet, Text, View } from "react-native";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";

import { RootStackParamList } from "../navigation/RootNavigator";
import { useAuth } from "../auth/useAuth";
import { db } from "../config/firebase";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import SectionHeader from "../components/ui/SectionHeader";
import { groupDoc, groupMemberDoc, groupMembersCol, userGroupDoc } from "../firestore/paths";
import { formatDurationMinutes } from "../utils/progress";
import { useTheme } from "../theme/ThemeProvider";

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

function readCompletedWorkouts(value: any) {
  return Number(value ?? 0) || 0;
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
  const { colors, spacing, typography } = useTheme();
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
            const completed = readCompletedWorkouts(gd?.completedWorkouts);
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
    <View style={{ flex: 1, backgroundColor: colors.background.primary }}>
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm }}>
        <SectionHeader
          title={group.name?.trim()?.length ? group.name : "Group progress"}
          subtitle="Track momentum across every member's goal."
        />
      </View>
      <FlatList
        data={rows}
        keyExtractor={(r) => r.userId}
        renderItem={({ item }) => <ProgressRow row={item} />}
        ListEmptyComponent={
          <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm }}>
            <Text style={{ color: colors.text.muted }}>
              No goals found yet for this group.
            </Text>
          </View>
        }
        contentContainerStyle={{ paddingBottom: spacing.xl }}
      />
      <View
        style={{
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border.subtle,
          backgroundColor: colors.background.primary,
        }}
      >
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <Button title="Share invite code" onPress={shareInviteCode} style={{ flex: 1 }} />
          <Button title="Leave group" onPress={confirmLeaveGroup} style={{ flex: 1 }} />
        </View>
      </View>
    </View>
  );
}

function ProgressRow({ row }: { row: Row }) {
  const { colors, radius, spacing, typography } = useTheme();
  const pct = useMemo(() => (row.target ? clamp01(row.completed / row.target) : 0), [row.completed, row.target]);
  const totalTimeLabel = useMemo(() => formatDurationMinutes(row.totalDurationMinutes || 0), [row.totalDurationMinutes]);
  const reason = row.goalDateReason?.trim() || "Why is this date important?";
  const targetLabel = row.goalDateISO ? formatGoalDate(row.goalDateISO) : "No target date";

  return (
    <Card style={{ marginHorizontal: spacing.lg, marginBottom: spacing.md }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
        <Text style={{ fontSize: typography.size.md, fontWeight: typography.weight.bold, color: colors.text.primary }}>
          {row.displayName}
        </Text>
        <Text style={{ color: colors.text.secondary, fontWeight: typography.weight.semibold }}>
          {row.completed} / {row.target || "—"}
        </Text>
      </View>

      <View
        style={{
          position: "relative",
          marginTop: spacing.sm,
          marginBottom: spacing.sm,
          minHeight: typography.lineHeight.normal,
          justifyContent: "center",
        }}
      >
        <Text
          style={{
            textAlign: "center",
            fontWeight: typography.weight.medium,
            color: row.goalDateReason ? colors.text.primary : colors.text.muted,
          }}
        >
          {reason}
        </Text>
        <View
          style={{
            position: "absolute",
            right: 0,
            top: 0,
            paddingHorizontal: spacing.sm,
            paddingVertical: spacing.xs,
            borderRadius: radius.pill,
            backgroundColor: colors.surface.cardAlt,
          }}
        >
          <Text style={{ fontSize: typography.size.xs, fontWeight: typography.weight.semibold, color: colors.text.secondary }}>
            {targetLabel}
          </Text>
        </View>
      </View>

      <View
        style={{
          height: spacing.xs,
          borderRadius: radius.pill,
          backgroundColor: colors.surface.cardAlt,
          marginTop: spacing.sm,
          overflow: "hidden",
        }}
      >
        <View style={{ width: `${pct * 100}%`, height: "100%", backgroundColor: colors.accent.primary }} />
      </View>

      <View style={{ marginTop: spacing.sm, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={{ color: colors.text.muted, fontSize: typography.size.xs }}>
          {row.target ? `${Math.round(pct * 100)}%` : "Set a target to track progress"}
        </Text>
        <Text style={{ color: colors.text.muted, fontSize: typography.size.xs, fontWeight: typography.weight.medium }}>
          Total Workout Time: {totalTimeLabel}
        </Text>
      </View>
    </Card>
  );
}
