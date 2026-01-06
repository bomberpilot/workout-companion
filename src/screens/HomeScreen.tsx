import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, FlatList, Dimensions, Pressable, Alert, NativeSyntheticEvent, NativeScrollEvent } from "react-native";
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
import GoalTile from "../components/home/GoalTile";
import { db } from "../config/firebase";
import type { AppNotification, UserSettings } from "../types/models";
import { useTheme } from "../theme/ThemeProvider";

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
  const { colors } = useTheme();

  const [cards, setCards] = useState<GoalCard[]>([]);
  const [showLog, setShowLog] = useState(false);
  const [globalCompleted, setGlobalCompleted] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
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
                  next[gid] = {
                    ...(next[gid] ?? { groupId: gid, groupName: "Group" }),
                    groupId: gid,
                    targetWorkouts: gd?.targetWorkouts ?? undefined,
                    goalDateISO: gd?.goalDateISO ?? undefined,
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

    const qy = query(
      userNotificationsCol(user.uid),
      orderBy("createdAt", "desc"),
      limit(10)
    );
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

  const width = Dimensions.get("window").width;

  // Two tiles visible at once, with margins and spacing
  const sidePadding = 16;
  const tileGap = 12;
  const tileWidth = useMemo(() => {
    const usable = width - sidePadding * 2 - tileGap; // 2 tiles + 1 gap
    return Math.floor(usable / 2);
  }, [width]);

  const snapInterval = useMemo(() => tileWidth + tileGap, [tileWidth]);
  const listRef = useRef<FlatList<GoalCard>>(null);

  function onScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const x = e.nativeEvent.contentOffset.x;
    const idx = Math.round(x / snapInterval);
    if (idx !== activeIndex) setActiveIndex(idx);
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

  return (
    <View style={{ flex: 1, backgroundColor: "#f6f6f6" }}>
      <View style={{ padding: sidePadding, paddingBottom: 8 }}>
        <Text style={{ fontSize: 22, fontWeight: "900" }}>Your Groups</Text>
        <Text style={{ opacity: 0.7, marginTop: 4 }}>Scroll sideways. Tap a tile to enter the group.</Text>
      </View>

      <FlatList
        ref={listRef}
        data={cards}
        horizontal
        keyExtractor={(i) => i.groupId}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: sidePadding }}
        snapToInterval={snapInterval}
        decelerationRate="fast"
        bounces={cards.length > 1}
        onScroll={onScroll}
        scrollEventThrottle={16}
        renderItem={({ item, index }) => {
          const subtitle = item.inviteCode ? `Invite: ${item.inviteCode}` : "Invite: —";
          const target = item.targetWorkouts ?? 0;
          const progressRatio = target ? globalCompleted / target : 0;
          const progressText = target ? `Progress: ${globalCompleted}/${target}` : "Set your goal";

          // Add gap spacing between tiles
          const isLeftTile = index % 2 === 0;
          const marginRight = isLeftTile ? tileGap : 0;

          return (
            <View style={{ width: tileWidth, marginRight }}>
              <GoalTile
                width={tileWidth}
                title={item.groupName}
                subtitle={subtitle}
                progressText={progressText}
                progressRatio={progressRatio}
                goalDateISO={item.goalDateISO}
                onPress={() => nav.navigate("Chat", { groupId: item.groupId })}
              />
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={{ paddingHorizontal: sidePadding, paddingTop: 12 }}>
            <Text style={{ opacity: 0.7 }}>No goals yet. Create or join a group to start.</Text>
          </View>
        }
      />

      {/* Dots like Instagram */}
      {cards.length > 1 ? (
        <View style={{ flexDirection: "row", justifyContent: "center", gap: 8, paddingTop: 4 }}>
          {Array.from({ length: Math.max(1, Math.ceil(cards.length / 2)) }).map((_, i) => {
            const active = i === activeIndex;
            return (
              <View
                key={i}
                style={{
                  width: active ? 18 : 7,
                  height: 7,
                  borderRadius: 999,
                  backgroundColor: active ? "#111" : "#cfcfcf",
                }}
              />
            );
          })}
        </View>
      ) : null}

      <View style={{ paddingHorizontal: sidePadding, paddingTop: 16 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ fontSize: 18, fontWeight: "900" }}>Recent Activity</Text>
          <Pressable
            onPress={dismissAllNotifications}
            disabled={!notifications.length || !notificationsEnabled}
            style={({ pressed }) => ({
              opacity: !notifications.length || !notificationsEnabled ? 0.35 : pressed ? 0.6 : 1,
            })}
          >
            <Text style={{ fontWeight: "700" }}>Dismiss all</Text>
          </Pressable>
        </View>
        {!notificationsEnabled ? (
          <Text style={{ marginTop: 8, opacity: 0.6 }}>Notifications are turned off in settings.</Text>
        ) : notifications.length ? (
          <View style={{ marginTop: 8, gap: 10 }}>
            {notifications.map((notification) => {
              const createdAt = notification.createdAt?.toDate?.();
              const timeLabel = createdAt ? createdAt.toLocaleString() : "Just now";
              return (
                <View
                  key={notification.id}
                  style={{
                    backgroundColor: "white",
                    borderRadius: 14,
                    padding: 12,
                    borderWidth: 1,
                    borderColor: "#ececec",
                  }}
                >
                  <Text style={{ fontWeight: "700" }}>{notification.message}</Text>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
                    <Text style={{ opacity: 0.6, fontSize: 12 }}>{timeLabel}</Text>
                    <Pressable onPress={() => dismissNotification(notification.id)}>
                      <Text style={{ fontSize: 12, fontWeight: "700" }}>Dismiss</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          <Text style={{ marginTop: 8, opacity: 0.6 }}>You’re all caught up!</Text>
        )}
      </View>

      <View style={{ flex: 1 }} />

      <View style={{ padding: sidePadding }}>
        <Pressable
          onPress={() => setShowLog(true)}
          style={{
            backgroundColor: "#111",
            borderRadius: 18,
            paddingVertical: 16,
            alignItems: "center",
          }}
        >
          <Text style={{ color: "white", fontWeight: "900", fontSize: 16 }}>Log workout</Text>
          <Text style={{ color: "white", opacity: 0.75, marginTop: 4 }}>Posts to every group</Text>
        </Pressable>

        <View style={{ flexDirection: "row", gap: 10, marginTop: 10, alignItems: "center" }}>
          <Pressable
            onPress={() => nav.navigate("CreateGroup")}
            style={{
              flex: 1,
              backgroundColor: "white",
              borderRadius: 16,
              paddingVertical: 14,
              alignItems: "center",
              borderWidth: 1,
              borderColor: "#e6e6e6",
            }}
          >
            <Text style={{ fontWeight: "800" }}>Create group</Text>
          </Pressable>

          <Pressable
            onPress={() => nav.navigate("JoinGroup")}
            style={{
              flex: 1,
              backgroundColor: "white",
              borderRadius: 16,
              paddingVertical: 14,
              alignItems: "center",
              borderWidth: 1,
              borderColor: "#e6e6e6",
            }}
          >
            <Text style={{ fontWeight: "800" }}>Join group</Text>
          </Pressable>

          <Pressable
            onPress={() => nav.navigate("Profile")}
            style={{ paddingHorizontal: 8, paddingVertical: 8 }}
          >
            <Ionicons name="person-outline" size={24} color={colors.text.secondary} />
          </Pressable>

          <Pressable
            onPress={() => nav.navigate("Settings")}
            style={{ paddingHorizontal: 8, paddingVertical: 8 }}
          >
            <Ionicons name="settings-outline" size={24} color={colors.text.secondary} />
          </Pressable>
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
