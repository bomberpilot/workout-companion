import React, { useEffect, useMemo, useState } from "react";
import { Alert, FlatList, Share, StyleSheet, Text, View } from "react-native";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { collection, onSnapshot } from "firebase/firestore";

import { RootStackParamList } from "../navigation/RootNavigator";
import { useAuth } from "../auth/useAuth";
import { db } from "../config/firebase";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import SectionHeader from "../components/ui/SectionHeader";
import { groupDoc, groupMembersCol } from "../firestore/paths";
import { useTheme } from "../theme/ThemeProvider";
import { leaveGroup as leaveGroupAction } from "../firestore/actions";
import { readMemberGoals, type MemberGoal } from "../goals/memberGoals";

type R = RouteProp<RootStackParamList, "GroupProgress">;
type Nav = NativeStackNavigationProp<RootStackParamList, "GroupProgress">;

type Row = {
  userId: string;
  displayName: string;
  goals: MemberGoal[];
};

type GoalRow = {
  displayName?: string;
  goals: MemberGoal[];
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
  return parsed.toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
  });
}

function parseISOToUTCDate(iso: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const da = Number(m[3]);
  if (mo < 1 || mo > 12 || da < 1 || da > 31) return null;
  const date = new Date(Date.UTC(y, mo - 1, da));
  return date.toISOString().slice(0, 10) === iso ? date : null;
}

export default function GroupProgressScreen() {
  const { params } = useRoute<R>();
  const nav = useNavigation<Nav>();
  const { user, initializing } = useAuth();
  const { colors, spacing } = useTheme();
  const [goalRows, setGoalRows] = useState<Record<string, GoalRow>>({});
  const [memberNames, setMemberNames] = useState<Record<string, string>>({});
  const [group, setGroup] = useState<GroupMeta>({});

  useEffect(() => {
    if (!user) return;
    const goalsRef = collection(db, "groups", params.groupId, "goals");
    return onSnapshot(
      goalsRef,
      (snap) => {
        const next: Record<string, GoalRow> = {};
        snap.docs.forEach((d) => {
          const gd = d.data() as any;
          const displayName = String(gd?.displayName ?? "").trim() || d.id.slice(0, 6);
          next[d.id] = { displayName, goals: readMemberGoals(gd, d.id) };
        });

        setGoalRows(next);
      },
      (err) => Alert.alert("Progress error", err.message)
    );
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
          next[docSnap.id] = typeof nick === "string" && nick.trim().length ? nick.trim() : docSnap.id.slice(0, 6);
        });
        setMemberNames(next);
      },
      (err) => Alert.alert("Members error", err.message)
    );
    return unsub;
  }, [initializing, params.groupId, user]);

  const rows = useMemo(() => {
    const nextRows: Row[] = Object.keys(memberNames).map((userId) => ({
      userId,
      displayName: memberNames[userId] ?? goalRows[userId]?.displayName ?? userId.slice(0, 6),
      goals: goalRows[userId]?.goals ?? [],
    }));

    nextRows.sort((a, b) => a.displayName.localeCompare(b.displayName));

    return nextRows;
  }, [goalRows, memberNames]);

  function confirmLeaveGroup() {
    Alert.alert("Leave group?", "You will stop seeing this group and its messages.", [
      { text: "Cancel", style: "cancel" },
      { text: "Leave", style: "destructive", onPress: leaveGroup },
    ]);
  }

  async function leaveGroup() {
    if (!user) return;
    try {
      await leaveGroupAction({ groupId: params.groupId });
      nav.navigate("Home");
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
          subtitle="See what each person is working toward."
        />
      </View>
      <FlatList
        data={rows}
        keyExtractor={(r) => r.userId}
        renderItem={({ item }) => <ProgressRow row={item} onPress={() => nav.navigate("MemberProfile", { groupId: params.groupId, userId: item.userId })} />}
        ListEmptyComponent={
          <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm }}>
            <Text style={{ color: colors.text.muted }}>
              No members found yet for this group.
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

function ProgressRow({ row, onPress }: { row: Row; onPress: () => void }) {
  const { colors, radius, spacing, typography } = useTheme();
  return (
    <Card onPress={onPress} style={{ marginHorizontal: spacing.lg, marginBottom: spacing.md }}>
      <Text style={{ fontSize: typography.size.md, fontWeight: typography.weight.bold, color: colors.text.primary }}>
        {row.displayName} ›
      </Text>
      {row.goals.length === 0 ? (
        <Text style={{ color: colors.text.muted, marginTop: spacing.sm }}>No personal goals yet. Tap to view this member.</Text>
      ) : row.goals.map((goal) => {
        const pct = clamp01(goal.completedWorkouts / goal.targetWorkouts);
        return (
          <View key={goal.id} style={{ marginTop: spacing.md }}>
            <Text style={{ color: colors.text.primary, fontWeight: typography.weight.semibold }}>
              {goal.goalDateReason || `${goal.targetWorkouts} workouts`}
            </Text>
            <Text style={{ color: colors.text.muted, fontSize: typography.size.sm, marginTop: spacing.xs }}>
              {goal.completedWorkouts} of {goal.targetWorkouts} workouts{goal.goalDateISO ? ` · by ${formatGoalDate(goal.goalDateISO)}` : ""}
            </Text>
            <View style={{ height: spacing.xs, borderRadius: radius.pill, backgroundColor: colors.surface.cardAlt, marginTop: spacing.sm, overflow: "hidden" }}>
              <View style={{ width: `${pct * 100}%`, height: "100%", backgroundColor: colors.accent.primary }} />
            </View>
          </View>
        );
      })}
    </Card>
  );
}
