import React, { useEffect, useMemo, useState } from "react";
import { Alert, Dimensions, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import {
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";

import { RootStackParamList } from "../navigation/RootNavigator";
import { useAuth } from "../auth/useAuth";
import {
  groupDoc,
  userGroupsCol,
  userNotificationDoc,
  userNotificationsCol,
  userSettingsDoc,
} from "../firestore/paths";
import LogWorkoutModal from "../components/workout/LogWorkoutModal";
import { db } from "../config/firebase";
import type { AppNotification, UserSettings } from "../types/models";
import { useTheme } from "../theme/ThemeProvider";
import Card from "../components/ui/Card";
import SectionHeader from "../components/ui/SectionHeader";
import PrimaryActionButton from "../components/ui/PrimaryActionButton";

type Nav = NativeStackNavigationProp<RootStackParamList, "Home">;

type GoalCard = {
  groupId: string;
  groupName: string;
  inviteCode?: string;
  targetWorkouts?: number;
  goalDateISO?: string;
};

export default function HomeScreen() {
  const nav = useNavigation<Nav>();
  const { user } = useAuth();
  const { colors, radius, spacing, typography } = useTheme();

  const [cards, setCards] = useState<GoalCard[]>([]);
  const [showLog, setShowLog] = useState(false);
  const [globalCompleted, setGlobalCompleted] = useState(0);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  // Global workout count for current user (MVP: all-time)
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const snap = await getDocs(collection(db, "users", user.uid, "workouts"));
        setGlobalCompleted(snap.size);
      } catch {
        // non-fatal
      }
    })();
  }, [user]);

  // Subscribe to user's groups and hydrate minimal tile data
  useEffect(() => {
    if (!user) return;

    const unsub = onSnapshot(
      query(userGroupsCol(user.uid)),
      (snap) => {
        const groupIds = snap.docs.map((d) => d.id);
        const unsubs: Array<() => void> = [];
        const next: Record<string, GoalCard> = {};

        for (const gid of groupIds) {
          const u1 = onSnapshot(groupDoc(gid), (gs) => {
            const g = gs.data() as any;
            next[gid] = {
              ...(next[gid] ?? { groupId: gid, groupName: "Group" }),
              groupId: gid,
              groupName: g?.name ?? "Group",
              inviteCode: g?.inviteCode,
            };
            setCards(Object.values(next));
          });

          const u2 = (() => {
            let unsubGoal = () => {};
            (async () => {
              try {
                await setDoc(
                  doc(db, "groups", gid, "members", user.uid),
                  { userId: user.uid, joinDate: serverTimestamp() },
                  { merge: true }
                );
              } catch {
                // non-fatal
              }

              unsubGoal = onSnapshot(
                doc(db, "groups", gid, "goals", user.uid),
                (goalSnap) => {
                  const gd = goalSnap.data() as any;
                  const primaryGoal =
                    Array.isArray(gd?.goalEntries) && gd.goalEntries.length > 0 ? gd.goalEntries[0] : gd;
                  next[gid] = {
                    ...(next[gid] ?? { groupId: gid, groupName: "Group" }),
                    groupId: gid,
                    targetWorkouts: primaryGoal?.targetWorkouts ?? undefined,
                    goalDateISO: primaryGoal?.goalDateISO ?? undefined,
                  };
                  setCards(Object.values(next));
                },
                (err) => Alert.alert("Goal error", err.message)
              );
            })();

            return () => unsubGoal();
          })();

          unsubs.push(u1, u2);
        }

        return () => unsubs.forEach((f) => f());
      },
      (err) => Alert.alert("Home error", err.message)
    );

    return unsub;
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const settingsUnsub = onSnapshot(
      userSettingsDoc(user.uid),
      (snap) => {
        const data = snap.data() as UserSettings | undefined;
        setNotificationsEnabled(data?.notificationsEnabled ?? true);
      },
      () => setNotificationsEnabled(true)
    );

    return settingsUnsub;
  }, [user]);

  useEffect(() => {
    if (!user || !notificationsEnabled) {
      setNotifications([]);
      return;
    }

    const qy = query(userNotificationsCol(user.uid), orderBy("createdAt", "desc"), limit(10));
    const unsub = onSnapshot(
      qy,
      (snap) => {
        const next = snap.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<AppNotification, "id">),
        }));
        setNotifications(next.filter((notification) => !notification.read));
      },
      () => setNotifications([])
    );

    return unsub;
  }, [user, notificationsEnabled]);

  async function dismissNotification(notificationId: string) {
    if (!user) return;
    try {
      await updateDoc(userNotificationDoc(user.uid, notificationId), { read: true });
    } catch {
      // non-fatal
    }
  }

  async function dismissAllNotifications() {
    if (!user || notifications.length === 0) return;
    const batch = writeBatch(db);
    notifications.forEach((notification) => {
      batch.update(userNotificationDoc(user.uid, notification.id), { read: true });
    });
    try {
      await batch.commit();
    } catch {
      // non-fatal
    }
  }

  async function refreshWorkoutCount() {
    if (!user) return;
    try {
      const snap = await getDocs(collection(db, "users", user.uid, "workouts"));
      setGlobalCompleted(snap.size);
    } catch (e: any) {
      Alert.alert("Log workout error", e?.message ?? "Something went wrong.");
    }
  }

  const width = Dimensions.get("window").width;
  const sidePadding = spacing.xl;
  const tileGap = spacing.sm;
  const tileWidth = useMemo(() => {
    const usable = width - sidePadding * 2 - tileGap;
    return Math.floor(usable / 2);
  }, [sidePadding, tileGap, width]);

  const primaryGoal = useMemo(() => cards.find((card) => card.targetWorkouts) ?? cards[0], [cards]);
  const targetWorkouts = primaryGoal?.targetWorkouts ?? 0;
  const progressRatio = targetWorkouts ? globalCompleted / targetWorkouts : 0;
  const progressLabel = targetWorkouts
    ? `${globalCompleted} of ${targetWorkouts} workouts`
    : "Set a goal to start tracking momentum";

  const visibleNotifications = notifications.slice(0, 2); // Keep height stable for the no-scroll layout.
  const remainingNotifications = notifications.length - visibleNotifications.length;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background.primary }}>
      <View style={{ flex: 1, paddingHorizontal: sidePadding, paddingTop: spacing.xl, paddingBottom: spacing.lg }}>
        <View style={{ marginBottom: spacing.xl }}>
          <SectionHeader title="Momentum" subtitle="Stay calm and consistent—small steps add up." />
          <Card style={{ marginTop: spacing.md }}>
            <Text style={{ color: colors.text.primary, fontSize: typography.size.lg, fontWeight: typography.weight.bold }}>
              {progressLabel}
            </Text>
            <Text
              style={{
                marginTop: spacing.xs,
                color: colors.text.muted,
                fontSize: typography.size.sm,
                lineHeight: typography.lineHeight.relaxed,
              }}
            >
              {targetWorkouts ? "Momentum is based on your primary group goal." : "Choose a group goal to see progress."}
            </Text>
            <View
              style={{
                marginTop: spacing.lg,
                height: spacing.xs,
                borderRadius: radius.pill,
                backgroundColor: colors.surface.cardAlt,
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  width: `${Math.max(0, Math.min(1, progressRatio)) * 100}%`,
                  height: "100%",
                  backgroundColor: colors.accent.primary,
                  borderRadius: radius.pill,
                }}
              />
            </View>
          </Card>

          <SectionHeader
            title="Your groups"
            subtitle="Tap a group to open its chat and goal."
            style={{ marginTop: spacing.lg }}
          />
          <FlatList
            data={cards}
            horizontal
            keyExtractor={(i) => i.groupId}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingTop: spacing.md, paddingBottom: spacing.xs }}
            ItemSeparatorComponent={() => <View style={{ width: tileGap }} />}
            renderItem={({ item }) => {
              const target = item.targetWorkouts ?? 0;
              const ratio = target ? globalCompleted / target : 0;
              const progressText = target ? `${globalCompleted}/${target} complete` : "Set a goal";
              const subtitle = item.inviteCode ? `Invite: ${item.inviteCode}` : "Invite: —";

              return (
                <Card style={{ width: tileWidth }} onPress={() => nav.navigate("Chat", { groupId: item.groupId })}>
                  <Text
                    style={{
                      color: colors.text.primary,
                      fontSize: typography.size.md,
                      fontWeight: typography.weight.bold,
                    }}
                    numberOfLines={1}
                  >
                    {item.groupName}
                  </Text>
                  <Text
                    style={{
                      marginTop: spacing.xs,
                      color: colors.text.muted,
                      fontSize: typography.size.sm,
                    }}
                    numberOfLines={1}
                  >
                    {subtitle}
                  </Text>
                  <Text
                    style={{
                      marginTop: spacing.md,
                      color: colors.text.secondary,
                      fontSize: typography.size.sm,
                      fontWeight: typography.weight.semibold,
                    }}
                  >
                    {progressText}
                  </Text>
                  <View
                    style={{
                      marginTop: spacing.sm,
                      height: spacing.xs,
                      borderRadius: radius.pill,
                      backgroundColor: colors.surface.cardAlt,
                      overflow: "hidden",
                    }}
                  >
                    <View
                      style={{
                        width: `${Math.max(0, Math.min(1, ratio)) * 100}%`,
                        height: "100%",
                        backgroundColor: colors.accent.primary,
                        borderRadius: radius.pill,
                      }}
                    />
                  </View>
                </Card>
              );
            }}
            ListEmptyComponent={
              <Text style={{ color: colors.text.muted, fontSize: typography.size.sm }}>
                No groups yet. Create or join one to begin.
              </Text>
            }
          />
        </View>

        <View style={{ marginBottom: spacing.xl }}>
          <SectionHeader
            title="Recent group activity"
            subtitle="A gentle pulse of what your friends are up to."
            action={
              <Pressable
                onPress={dismissAllNotifications}
                disabled={!notifications.length || !notificationsEnabled}
                style={({ pressed }) => ({
                  opacity: !notifications.length || !notificationsEnabled ? 0.35 : pressed ? 0.7 : 1,
                })}
              >
                <Text style={{ color: colors.text.secondary, fontWeight: typography.weight.semibold }}>
                  Dismiss all
                </Text>
              </Pressable>
            }
          />
          <Card style={{ marginTop: spacing.md }}>
            {!notificationsEnabled ? (
              <Text style={{ color: colors.text.muted, fontSize: typography.size.sm }}>
                Notifications are turned off in settings.
              </Text>
            ) : visibleNotifications.length ? (
              <View style={{ gap: spacing.sm }}>
                {visibleNotifications.map((notification) => {
                  const createdAt = notification.createdAt?.toDate?.();
                  const timeLabel = createdAt ? createdAt.toLocaleString() : "Just now";
                  return (
                    <View
                      key={notification.id}
                      style={{
                        backgroundColor: colors.surface.cardAlt,
                        borderRadius: radius.md,
                        padding: spacing.md,
                      }}
                    >
                      <Text style={{ color: colors.text.primary, fontWeight: typography.weight.semibold }}>
                        {notification.message}
                      </Text>
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginTop: spacing.xs,
                        }}
                      >
                        <Text style={{ color: colors.text.muted, fontSize: typography.size.xs }}>{timeLabel}</Text>
                        <Pressable
                          onPress={() => dismissNotification(notification.id)}
                          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                        >
                          <Text style={{ color: colors.text.secondary, fontSize: typography.size.xs }}>
                            Dismiss
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  );
                })}
                {remainingNotifications > 0 ? (
                  <Text style={{ color: colors.text.muted, fontSize: typography.size.xs }}>
                    {`+${remainingNotifications} more update${remainingNotifications > 1 ? "s" : ""}`}
                  </Text>
                ) : null}
              </View>
            ) : (
              <Text style={{ color: colors.text.muted, fontSize: typography.size.sm }}>
                You’re all caught up!
              </Text>
            )}
          </Card>
        </View>

        <View style={{ marginTop: "auto" }}>
          <PrimaryActionButton
            title="Log workout"
            subtitle="Posts to every group"
            onPress={() => setShowLog(true)}
          />

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginTop: spacing.md,
            }}
          >
            <Pressable
              onPress={() => nav.navigate("CreateGroup")}
              style={({ pressed }) => ({
                flex: 1,
                marginRight: spacing.sm,
                backgroundColor: pressed ? colors.surface.cardAlt : colors.surface.card,
                borderRadius: radius.md,
                paddingVertical: spacing.md,
                alignItems: "center",
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: colors.border.subtle,
              })}
            >
              <Text style={{ color: colors.text.primary, fontWeight: typography.weight.semibold }}>
                Create group
              </Text>
            </Pressable>

            <Pressable
              onPress={() => nav.navigate("JoinGroup")}
              style={({ pressed }) => ({
                flex: 1,
                marginRight: spacing.sm,
                backgroundColor: pressed ? colors.surface.cardAlt : colors.surface.card,
                borderRadius: radius.md,
                paddingVertical: spacing.md,
                alignItems: "center",
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: colors.border.subtle,
              })}
            >
              <Text style={{ color: colors.text.primary, fontWeight: typography.weight.semibold }}>
                Join group
              </Text>
            </Pressable>

            <Pressable
              onPress={() => nav.navigate("Profile")}
              style={({ pressed }) => ({
                padding: spacing.sm,
                borderRadius: radius.md,
                backgroundColor: pressed ? colors.surface.cardAlt : colors.surface.card,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: colors.border.subtle,
              })}
            >
              <Ionicons name="person-outline" size={typography.size.xl} color={colors.text.secondary} />
            </Pressable>

            <Pressable
              onPress={() => nav.navigate("Settings")}
              style={({ pressed }) => ({
                marginLeft: spacing.sm,
                padding: spacing.sm,
                borderRadius: radius.md,
                backgroundColor: pressed ? colors.surface.cardAlt : colors.surface.card,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: colors.border.subtle,
              })}
            >
              <Ionicons name="settings-outline" size={typography.size.xl} color={colors.text.secondary} />
            </Pressable>
          </View>
        </View>
      </View>

      {user ? (
        <LogWorkoutModal
          visible={showLog}
          onClose={() => setShowLog(false)}
          userId={user.uid}
          onLogged={refreshWorkoutCount}
        />
      ) : null}
    </View>
  );
}
