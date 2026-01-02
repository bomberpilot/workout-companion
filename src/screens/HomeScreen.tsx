import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, FlatList, Dimensions, Pressable, Alert, NativeSyntheticEvent, NativeScrollEvent } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { addDoc, collection, doc, getDocs, increment, onSnapshot, query, serverTimestamp, setDoc } from "firebase/firestore";

import { RootStackParamList } from "../navigation/RootNavigator";
import { useAuth } from "../auth/useAuth";
import { userGroupsCol, groupDoc, messagesCol } from "../firestore/paths";
import GlobalWorkoutLogModal from "../components/workout/GlobalWorkoutLogModal";
import GoalTile from "../components/home/GoalTile";
import { db } from "../config/firebase";

type Nav = NativeStackNavigationProp<RootStackParamList, "Home">;

type GoalCard = {
  groupId: string;
  groupName: string;
  inviteCode?: string;
  targetWorkouts?: number;
  goalDateISO?: string;
};

type WorkoutType = "cardio" | "strength" | "flexibility" | "sport" | "other";

export default function HomeScreen() {
  const nav = useNavigation<Nav>();
  const { user } = useAuth();

  const [cards, setCards] = useState<GoalCard[]>([]);
  const [showLog, setShowLog] = useState(false);
  const [globalCompleted, setGlobalCompleted] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);

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

          const u2 = onSnapshot(doc(db, "groups", gid, "goals", user.uid), (goalSnap) => {
            const gd = goalSnap.data() as any;
            next[gid] = {
              ...(next[gid] ?? { groupId: gid, groupName: "Group" }),
              groupId: gid,
              targetWorkouts: gd?.targetWorkouts ?? undefined,
              goalDateISO: gd?.goalDateISO ?? undefined,
            };
            setCards(Object.values(next));
          });

          unsubs.push(u1, u2);
        }

        return () => unsubs.forEach((f) => f());
      },
      (err) => Alert.alert("Home error", err.message)
    );

    return unsub;
  }, [user]);

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

  async function logWorkoutGlobally({
    userId,
    workoutType,
    notes,
  }: {
    userId: string;
    workoutType: WorkoutType;
    notes?: string;
  }) {
    await addDoc(collection(db, "users", userId, "workouts"), {
      type: workoutType,
      notes: notes ?? "",
      createdAt: serverTimestamp(),
    });

    const groupsSnap = await getDocs(userGroupsCol(userId));
    const groupIds = groupsSnap.docs.map((d) => d.id);

    for (const groupId of groupIds) {
      await addDoc(messagesCol(groupId), {
        type: "workout",
        userId,
        workoutType,
        text: notes ?? "",
        createdAt: serverTimestamp(),
      });

      await setDoc(
        doc(db, "groups", groupId, "goals", userId),
        {
          completedWorkouts: increment(1),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    }
  }

  async function submitGlobalWorkout(payload: { type: string; notes?: string }) {
    if (!user) return;
    await logWorkoutGlobally({
      userId: user.uid,
      workoutType: payload.type as WorkoutType,
      notes: payload.notes,
    });
    const snap = await getDocs(collection(db, "users", user.uid, "workouts"));
    setGlobalCompleted(snap.size);
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#f6f6f6" }}>
      <View style={{ padding: sidePadding, paddingBottom: 8 }}>
        <Text style={{ fontSize: 22, fontWeight: "900" }}>Your goals</Text>
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

        <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
          <Pressable
            onPress={() => nav.navigate("GroupManage")}
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
            <Text style={{ fontWeight: "800" }}>Create or join</Text>
          </Pressable>

          <Pressable
            onPress={() => nav.navigate("Profile")}
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
            <Text style={{ fontWeight: "800" }}>Profile</Text>
          </Pressable>
        </View>
      </View>

      <GlobalWorkoutLogModal visible={showLog} onClose={() => setShowLog(false)} onSubmit={submitGlobalWorkout} />
    </View>
  );
}
