import React, { useEffect, useMemo, useRef, useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { doc, getDocs, limit, onSnapshot, query, serverTimestamp, setDoc, where } from "firebase/firestore";

import { RootStackParamList } from "../navigation/RootNavigator";
import { useAuth } from "../auth/useAuth";
import { db } from "../config/firebase";
import Button from "../components/ui/Button";
import TextField from "../components/ui/TextField";
import EditWorkoutModal from "../components/workout/EditWorkoutModal";
import { groupMemberDoc, messagesCol, userWorkoutsCol } from "../firestore/paths";
import Card from "../components/ui/Card";
import SectionHeader from "../components/ui/SectionHeader";
import { useTheme } from "../theme/ThemeProvider";
import { countGoalWorkouts, readMemberGoals, type MemberGoal } from "../goals/memberGoals";

type R = RouteProp<RootStackParamList, "MemberProfile">;
type Nav = NativeStackNavigationProp<RootStackParamList>;

type GoalEntry = MemberGoal;

type WorkoutRow = {
  id: string;
  groupId?: string;
  performedAt?: any;
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
  const nav = useNavigation<Nav>();
  const { user, initializing } = useAuth();
  const { colors, shadow, spacing, typography } = useTheme();
  const [displayName, setDisplayName] = useState(params.userId.slice(0, 6));
  const [groupNickname, setGroupNickname] = useState<string | null>(null);
  const [nickname, setNickname] = useState("");
  const [savingNickname, setSavingNickname] = useState(false);
  const [showNicknameEditor, setShowNicknameEditor] = useState(false);
  const [goals, setGoals] = useState<GoalEntry[]>([]);
  const [workouts, setWorkouts] = useState<WorkoutRow[]>([]);
  const [editingWorkout, setEditingWorkout] = useState<WorkoutRow | null>(null);
  const [showWorkoutEditor, setShowWorkoutEditor] = useState(false);
  const [draggingGoalId, setDraggingGoalId] = useState<string | null>(null);
  const [dragPosition, setDragPosition] = useState(0);
  const [goalContainerHeight, setGoalContainerHeight] = useState(0);
  const dragStartOffset = useRef(0);
  const dragTouchStartY = useRef(0);
  const goalLayouts = useRef<Record<string, { y: number; height: number }>>({});
  const isSelf = user?.uid === params.userId;
  const goalsWithProgress = useMemo(
    () =>
      goals.map((goal) => ({
        ...goal,
        displayCompletedWorkouts: isSelf ? countGoalWorkouts(goal, params.groupId, workouts) : goal.completedWorkouts,
      })),
    [goals, isSelf, params.groupId, workouts]
  );

  useEffect(() => {
    if (initializing || !user) return;
    const unsubProfile = isSelf
      ? onSnapshot(doc(db, "users", params.userId), (snap) => {
          const dn = (snap.data() as any)?.displayName;
          if (typeof dn === "string" && dn.trim().length) setDisplayName(dn.trim());
        })
      : () => {};

    const unsubGoal = onSnapshot(doc(db, "groups", params.groupId, "goals", params.userId), (snap) => {
      if (!snap.exists()) {
        setGoals([]);
        return;
      }
      setGoals(readMemberGoals(snap.data(), snap.id));
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
  }, [initializing, isSelf, params.groupId, params.userId, user]);

  useEffect(() => {
    if (initializing || !user) return;
    (async () => {
      try {
        const wQuery = isSelf
          ? userWorkoutsCol(params.userId)
          : query(messagesCol(params.groupId), where("userId", "==", params.userId), limit(100));
        const wSnap = await getDocs(wQuery);
        const rows = wSnap.docs.flatMap((d) => {
          const data = d.data() as any;
          if (!isSelf && data?.type !== "workout") return [];
          if (isSelf) {
            if (data?.groupId !== params.groupId && data?.groupId !== "all") return [];
            return [{ id: d.id, ...(data as Omit<WorkoutRow, "id">) }];
          }
          return [{
            id: typeof data.workoutId === "string" ? data.workoutId : d.id,
            groupId: params.groupId,
            activityTypes: Array.isArray(data.activityTypes) ? data.activityTypes : [],
            durationMinutes: Number(data.durationMinutes ?? 0) || 0,
            date: data.workoutDate ?? data.createdAt,
            createdAt: data.createdAt,
            notes: typeof data.groupNote === "string" ? data.groupNote : "",
          }];
        });

        setWorkouts(sortWorkouts(rows));
      } catch (err: any) {
        Alert.alert("Workouts error", err?.message ?? "Unable to load workouts.");
      }
    })();
  }, [initializing, isSelf, params.groupId, params.userId, user]);

  const goalTitle = groupNickname ?? displayName;
  const draggingGoal = useMemo(
    () => (draggingGoalId ? goalsWithProgress.find((goal) => goal.id === draggingGoalId) ?? null : null),
    [draggingGoalId, goalsWithProgress]
  );

  function openWorkoutEditor(item: WorkoutRow) {
    setEditingWorkout(item);
    setShowWorkoutEditor(true);
  }

  function openMemberMenu() {
    if (!isSelf) return;
    Alert.alert("Member options", "Choose an action", [
      {
        text: showNicknameEditor ? "Hide nickname editor" : "Edit nickname",
        onPress: () => {
          if (showNicknameEditor) {
            setShowNicknameEditor(false);
            return;
          }
          setNickname(groupNickname ?? "");
          setShowNicknameEditor(true);
        },
      },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  function openGoalMenu(goalId?: string) {
    if (!isSelf) return;
    Alert.alert("Goal options", "Choose an action", [
      {
        text: "Edit goal",
        onPress: () => nav.navigate("GoalEdit", { groupId: params.groupId, userId: params.userId, goalId }),
      },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  function openWorkoutMenu(item: WorkoutRow) {
    if (!isSelf) return;
    Alert.alert("Workout options", "Choose an action", [
      { text: "Edit workout", onPress: () => openWorkoutEditor(item) },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  function handleWorkoutSaved(updated: WorkoutRow) {
    setWorkouts((prev) => {
      const next = prev.map((item) => (item.id === updated.id ? { ...item, ...updated } : item));
      return sortWorkouts(next);
    });
  }

  function getGoalIndex(id: string) {
    return goals.findIndex((goal) => goal.id === id);
  }

  async function saveNickname() {
    if (!user || !isSelf) return;
    const trimmed = nickname.trim();
    if (!trimmed.length) {
      Alert.alert("Nickname", "Enter a nickname to use for this group.");
      return;
    }

    setSavingNickname(true);
    try {
      await setDoc(
        doc(db, "groups", params.groupId, "members", user.uid),
        { nickname: trimmed, updatedAt: serverTimestamp() },
        { merge: true }
      );
      await setDoc(
        doc(db, "users", user.uid, "groups", params.groupId),
        { nickname: trimmed, updatedAt: serverTimestamp() },
        { merge: true }
      );
      setShowNicknameEditor(false);
      Alert.alert("Saved", "Your nickname for this group was updated.");
    } catch (err: any) {
      Alert.alert("Nickname error", err?.message ?? "Unable to update nickname.");
    } finally {
      setSavingNickname(false);
    }
  }

  async function persistGoalOrder(nextGoals: GoalEntry[]) {
    if (!user || !isSelf) return;
    try {
      await setDoc(
        doc(db, "groups", params.groupId, "goals", params.userId),
        {
          goalEntries: nextGoals.map((goal) => ({
            id: goal.id,
            targetWorkouts: goal.targetWorkouts,
            completedWorkouts: goal.completedWorkouts,
            goalDateISO: goal.goalDateISO ?? null,
            goalStartDateISO: goal.goalStartDateISO ?? null,
            goalDateReason: goal.goalDateReason ?? "",
          })),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (err: any) {
      Alert.alert("Goal order", err?.message ?? "Unable to save your goal order.");
    }
  }

  function startGoalDrag(goal: GoalEntry) {
    if (!isSelf || goals.length < 2) return;
    const layout = goalLayouts.current[goal.id];
    if (!layout) return;
    setDraggingGoalId(goal.id);
    dragStartOffset.current = layout.y;
    setDragPosition(layout.y);
  }

  function handleGoalMove(dy: number) {
    if (!draggingGoalId) return;
    const currentIndex = getGoalIndex(draggingGoalId);
    if (currentIndex === -1) return;

    const start = dragStartOffset.current;
    const nextPosition = start + dy;
    const boundedPosition = Math.max(0, Math.min(nextPosition, Math.max(0, goalContainerHeight - 1)));
    setDragPosition(boundedPosition);

    const nextIndex = getGoalIndexForPosition(draggingGoalId, boundedPosition);
    if (nextIndex === -1 || nextIndex === currentIndex) return;

    setGoals((prev) => moveArrayItem(prev, currentIndex, nextIndex));
  }

  function finishGoalDrag() {
    if (!draggingGoalId) return;
    const nextGoals = [...goals];
    setDraggingGoalId(null);
    persistGoalOrder(nextGoals);
  }

  function getGoalIndexForPosition(goalId: string, positionY: number) {
    const entries = Object.entries(goalLayouts.current).filter(([id]) =>
      goals.some((goal) => goal.id === id)
    );
    if (entries.length === 0) return -1;
    const sorted = entries.sort((a, b) => a[1].y - b[1].y);
    for (let i = 0; i < sorted.length; i += 1) {
      const [, layout] = sorted[i];
      const center = layout.y + layout.height / 2;
      if (positionY < center) return i;
    }
    return sorted.length - 1;
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background.primary }}>
      <FlatList
        data={workouts}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View style={{ paddingTop: spacing.lg }}>
            <View style={{ paddingHorizontal: spacing.lg }}>
              <SectionHeader
                title={goalTitle}
                subtitle={`Member summary for ${goalTitle} in this group.`}
                action={
                  isSelf ? (
                    <Pressable
                      onPress={openMemberMenu}
                      style={({ pressed }) => ({
                        paddingHorizontal: spacing.sm,
                        paddingVertical: spacing.xs,
                        borderRadius: spacing.md,
                        backgroundColor: pressed ? colors.surface.cardAlt : colors.surface.card,
                        borderWidth: StyleSheet.hairlineWidth,
                        borderColor: colors.border.subtle,
                      })}
                      accessibilityLabel="Member options"
                    >
                      <Text style={{ fontSize: typography.size.xl, fontWeight: typography.weight.bold, color: colors.text.primary }}>
                        ⋯
                      </Text>
                    </Pressable>
                  ) : null
                }
              />
            </View>

            {showNicknameEditor && isSelf ? (
              <Card style={{ marginTop: spacing.md, marginHorizontal: spacing.lg }}>
                <Text style={{ fontSize: typography.size.md, fontWeight: typography.weight.bold, color: colors.text.primary }}>
                  Your nickname in this group
                </Text>
                <Text style={{ marginTop: spacing.xs, color: colors.text.muted }}>
                  This nickname will show in chat and progress lists for this group.
                </Text>
                <TextField
                  label="Nickname"
                  value={nickname}
                  onChangeText={(value) => {
                    setNickname(value);
                  }}
                  placeholder="e.g., Chief"
                />
                <Button
                  title={savingNickname ? "Saving…" : "Save nickname"}
                  onPress={saveNickname}
                  disabled={savingNickname}
                />
              </Card>
            ) : null}

            {goals.length === 0 ? (
              <Card style={{ marginTop: spacing.md, marginHorizontal: spacing.lg }}>
                <Text style={{ color: colors.text.muted }}>No goals found yet for this group.</Text>
              </Card>
            ) : null}

            <View
              onLayout={(event) => setGoalContainerHeight(event.nativeEvent.layout.height)}
              onStartShouldSetResponder={() => false}
              onMoveShouldSetResponder={() => !!draggingGoalId}
              onResponderGrant={(event) => {
                dragTouchStartY.current = event.nativeEvent.pageY;
              }}
              onResponderMove={(event) => {
                handleGoalMove(event.nativeEvent.pageY - dragTouchStartY.current);
              }}
              onResponderRelease={finishGoalDrag}
              onResponderTerminationRequest={() => true}
              onResponderTerminate={finishGoalDrag}
            >
              {goalsWithProgress.map((goal) => {
                const isDragging = draggingGoalId === goal.id;
                return (
                  <View
                    key={goal.id}
                    onLayout={(event) => {
                      const { y, height } = event.nativeEvent.layout;
                      goalLayouts.current[goal.id] = { y, height };
                    }}
                    style={{ opacity: isDragging ? 0 : 1 }}
                  >
                    <GoalTile
                      goal={goal}
                      completedWorkouts={goal.displayCompletedWorkouts}
                      isSelf={isSelf}
                      onLongPress={() => startGoalDrag(goal)}
                      onMenuPress={() => openGoalMenu(goal.id)}
                    />
                  </View>
                );
              })}

              {draggingGoal ? (
                <View
                  pointerEvents="none"
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    top: dragPosition,
                    zIndex: 10,
                    paddingHorizontal: spacing.lg,
                  }}
                >
                  <GoalTile
                    goal={draggingGoal}
                    completedWorkouts={draggingGoal.displayCompletedWorkouts}
                    isSelf={isSelf}
                    onLongPress={() => {}}
                    onMenuPress={() => openGoalMenu(draggingGoal.id)}
                    style={shadow.md}
                  />
                </View>
              ) : null}
            </View>

            {isSelf ? (
              <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.md }}>
                <Button title="Add a goal" onPress={() => nav.navigate("GoalSetup", { groupId: params.groupId })} />
              </View>
            ) : null}

            <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm }}>
              <SectionHeader title="Workout summaries" subtitle="Recent sessions and notes." />
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <WorkoutTile
            workout={item}
            isSelf={isSelf}
            onMenuPress={() => openWorkoutMenu(item)}
          />
        )}
        contentContainerStyle={{ paddingBottom: spacing.xl }}
      />

      <EditWorkoutModal
        visible={showWorkoutEditor}
        onClose={() => setShowWorkoutEditor(false)}
        workout={editingWorkout}
        userId={params.userId}
        onSaved={handleWorkoutSaved}
      />
    </View>
  );
}

function sortWorkouts(rows: WorkoutRow[]) {
  return [...rows].sort((a, b) => {
    const ta = getWorkoutTime(a);
    const tb = getWorkoutTime(b);
    return tb - ta;
  });
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
    parts.push(formatFriendlyDate(when.toDate()));
  }
  return parts.join(" • ");
}

function getWorkoutTime(item: WorkoutRow) {
  const when = item.date ?? item.createdAt;
  if (when?.toMillis) return when.toMillis();
  return 0;
}

function formatGoalDate(iso: string) {
  const parsed = parseISOToUTCDate(iso);
  if (!parsed) return iso;
  return parsed.toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
  });
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
  const date = new Date(Date.UTC(y, mo - 1, da));
  return date.toISOString().slice(0, 10) === iso ? date : null;
}

function GoalTile({
  goal,
  completedWorkouts,
  isSelf,
  onLongPress,
  onMenuPress,
  style,
}: {
  goal: GoalEntry;
  completedWorkouts: number;
  isSelf: boolean;
  onLongPress: () => void;
  onMenuPress: () => void;
  style?: object;
}) {
  const { colors, radius, spacing, typography } = useTheme();
  const ratio = goal.targetWorkouts ? Math.min(1, completedWorkouts / goal.targetWorkouts) : 0;
  const reason = goal.goalDateReason?.trim() || "Why is this date important?";
  const targetLabel = goal.goalDateISO ? formatGoalDate(goal.goalDateISO) : "No target date";

  return (
    <Pressable
      onLongPress={onLongPress}
      delayLongPress={250}
      style={({ pressed }) => ({
        marginHorizontal: spacing.lg,
        marginBottom: spacing.md,
        opacity: pressed ? 0.92 : 1,
      })}
    >
      <Card style={style}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ fontWeight: typography.weight.semibold, color: colors.text.primary }}>
            Progress: {completedWorkouts} / {goal.targetWorkouts || "—"}
          </Text>
          {isSelf ? (
            <Pressable
              onPress={onMenuPress}
              style={({ pressed }) => ({
                paddingHorizontal: spacing.sm,
                paddingVertical: spacing.xs,
                borderRadius: spacing.md,
                backgroundColor: pressed ? colors.surface.cardAlt : colors.surface.card,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: colors.border.subtle,
              })}
            >
              <Text style={{ fontSize: typography.size.xl, fontWeight: typography.weight.bold, color: colors.text.primary }}>
                ⋯
              </Text>
            </Pressable>
          ) : null}
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
              color: goal.goalDateReason ? colors.text.primary : colors.text.muted,
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
            overflow: "hidden",
          }}
        >
          <View style={{ width: `${ratio * 100}%`, height: "100%", backgroundColor: colors.accent.primary }} />
        </View>
      </Card>
    </Pressable>
  );
}

function WorkoutTile({
  workout,
  isSelf,
  onMenuPress,
}: {
  workout: WorkoutRow;
  isSelf: boolean;
  onMenuPress: () => void;
}) {
  const { colors, spacing, typography } = useTheme();
  return (
    <Card style={{ marginHorizontal: spacing.lg, marginBottom: spacing.md }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={{ fontWeight: typography.weight.semibold, color: colors.text.primary }}>
          {formatWorkoutTitle(workout)}
        </Text>
        {isSelf ? (
          <Pressable
            onPress={onMenuPress}
            style={({ pressed }) => ({
              paddingHorizontal: spacing.sm,
              paddingVertical: spacing.xs,
              borderRadius: spacing.md,
              backgroundColor: pressed ? colors.surface.cardAlt : colors.surface.card,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: colors.border.subtle,
            })}
          >
            <Text style={{ fontSize: typography.size.xl, fontWeight: typography.weight.bold, color: colors.text.primary }}>
              ⋯
            </Text>
          </Pressable>
        ) : null}
      </View>
      {formatWorkoutMeta(workout) ? (
        <Text style={{ marginTop: spacing.xs, color: colors.text.muted }}>
          {formatWorkoutMeta(workout)}
        </Text>
      ) : null}
      {workout.notes ? (
        <Text style={{ marginTop: spacing.xs, color: colors.text.secondary }}>
          {String(workout.notes)}
        </Text>
      ) : null}
    </Card>
  );
}

function moveArrayItem<T>(list: T[], from: number, to: number) {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
