import React, { useEffect, useMemo, useState } from "react";
import { Dimensions, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import {
  limit,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  writeBatch,
} from "firebase/firestore";

import { RootStackParamList } from "../navigation/RootNavigator";
import { useAuth } from "../auth/useAuth";
import {
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
import { useMemberGroupGoals } from "../goals/useMemberGroupGoals";

type Nav = NativeStackNavigationProp<RootStackParamList, "Home">;

export default function HomeScreen() {
  const nav = useNavigation<Nav>();
  const { user } = useAuth();
  const { colors, radius, spacing, typography } = useTheme();

  const { groups, loading: groupsLoading, error: groupsError } = useMemberGroupGoals(user?.uid);
  const [showLog, setShowLog] = useState(false);
  const [notificationFeed, setNotificationFeed] = useState<{ userId: string; items: AppNotification[] }>({
    userId: "",
    items: [],
  });
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const notifications = user?.uid === notificationFeed.userId ? notificationFeed.items : [];

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
        setNotificationFeed({
          userId: user.uid,
          items: next.filter((notification) => !notification.read),
        });
      },
      () => setNotificationFeed({ userId: user.uid, items: [] })
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

  const width = Dimensions.get("window").width;
  const sidePadding = spacing.xl;
  const tileGap = spacing.sm;
  const tileWidth = useMemo(() => {
    const usable = width - sidePadding * 2 - tileGap;
    return Math.floor(usable / 2);
  }, [sidePadding, tileGap, width]);

  const featuredGroup = groups.find((group) => group.goals.length > 0);
  const primaryGoal = featuredGroup?.goals[0];
  const targetWorkouts = primaryGoal?.targetWorkouts ?? 0;
  const completed = primaryGoal?.completed ?? 0;
  const progressRatio = targetWorkouts ? completed / targetWorkouts : 0;
  const progressLabel = targetWorkouts
    ? `${completed} of ${targetWorkouts} workouts in ${featuredGroup?.groupName}`
    : "Set a personal goal in a group";

  const visibleNotifications = notifications.slice(0, 2); // Keep height stable for the no-scroll layout.
  const remainingNotifications = notifications.length - visibleNotifications.length;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background.primary }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: sidePadding, paddingTop: spacing.xl, paddingBottom: spacing.lg }}>
        <View style={{ marginBottom: spacing.xl }}>
          <SectionHeader title="Your commitments" subtitle="Show up for the goals you set." />
          <Card
            style={{ marginTop: spacing.md }}
            onPress={groups.length ? () => featuredGroup && user
              ? nav.navigate("MemberProfile", { groupId: featuredGroup.groupId, userId: user.uid })
              : nav.navigate("GoalSetup", { groupId: groups[0].groupId }) : undefined}
          >
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
              {targetWorkouts ? "Tap to see all your goals in this group." : "Tap to set a goal that fits you."}
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
            data={groups}
            horizontal
            keyExtractor={(i) => i.groupId}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingTop: spacing.md, paddingBottom: spacing.xs }}
            ItemSeparatorComponent={() => <View style={{ width: tileGap }} />}
            renderItem={({ item }) => {
              const goal = item.goals[0];
              const target = goal?.targetWorkouts ?? 0;
              const ratio = target ? goal.completed / target : 0;
              const progressText = target ? `${goal.completed}/${target} · ${item.goals.length} goal${item.goals.length === 1 ? "" : "s"}` : "Set your goal";
              const subtitle = goal?.goalDateISO ? `By ${goal.goalDateISO}` : "Your group";

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
                {groupsLoading ? "Loading your groups…" : groupsError ? `Unable to load groups: ${groupsError}` : "No groups yet. Create or join one to begin."}
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
      </ScrollView>

      {user ? (
        <LogWorkoutModal
          visible={showLog}
          onClose={() => setShowLog(false)}
          userId={user.uid}
          onLogged={() => {}}
        />
      ) : null}
    </View>
  );
}
