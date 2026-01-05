import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from "react-native";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useHeaderHeight } from "@react-navigation/elements";
import { Ionicons } from "@expo/vector-icons";
import {
  addDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

import { RootStackParamList } from "../navigation/RootNavigator";
import { useAuth } from "../auth/useAuth";
import { db } from "../config/firebase";
import { groupDoc, groupMembersCol, messagesCol, userWorkoutDoc } from "../firestore/paths";
import MessageTile from "../components/chat/MessageTile";
import ComposerBar from "../components/chat/ComposerBar";
import LogWorkoutModal from "../components/workout/LogWorkoutModal";
import { useTheme } from "../theme/ThemeProvider";

type R = RouteProp<RootStackParamList, "Chat">;
type Nav = NativeStackNavigationProp<RootStackParamList, "Chat">;

type GroupMeta = { name?: string; inviteCode?: string };
type WorkoutDetails = {
  activityTypes?: string[];
  durationMinutes?: number;
  notes?: string;
};

function fallbackName(uid: string) {
  return uid.slice(0, 6);
}

export default function GroupChatScreen() {
  const { params } = useRoute<R>();
  const nav = useNavigation<Nav>();
  const { user, initializing } = useAuth();
  const headerHeight = useHeaderHeight();
  const { colors } = useTheme();

  const [group, setGroup] = useState<GroupMeta>({});
  const [messages, setMessages] = useState<any[]>([]);
  const [nameMap, setNameMap] = useState<Record<string, string>>({});
  const [groupNameMap, setGroupNameMap] = useState<Record<string, string>>({});
  const [showLog, setShowLog] = useState(false);
  const inflight = useRef<Set<string>>(new Set());
  const [workoutDetails, setWorkoutDetails] = useState<Record<string, WorkoutDetails>>({});

  const workoutKey = (userId?: string, workoutId?: string) =>
    userId && workoutId ? `${userId}:${workoutId}` : "";

  // Header buttons
  useEffect(() => {
    const isHomeActive = false;
    const isProfileActive = false;
    const inactiveColor = colors.text.secondary;
    const activeColor = colors.accent.primary;
    nav.setOptions({
      headerTitle: group?.name?.trim()?.length ? group.name : "Group chat",
      headerLeft: () => (
        <Pressable
          onPress={() => nav.navigate("GroupProgress", { groupId: params.groupId })}
          style={{ paddingHorizontal: 10, paddingVertical: 6 }}
        >
          <Text style={{ fontWeight: "900" }}>Group Progress</Text>
        </Pressable>
      ),
      headerRight: () => (
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Pressable
            onPress={() => {
              if (!user) return;
              nav.navigate("MemberProfile", { groupId: params.groupId, userId: user.uid });
            }}
            disabled={!user}
            style={{ paddingHorizontal: 8, paddingVertical: 6, opacity: user ? 1 : 0.5 }}
          >
            <Ionicons
              name={isProfileActive ? "person" : "person-outline"}
              size={24}
              color={isProfileActive ? activeColor : inactiveColor}
            />
          </Pressable>
          <Pressable onPress={() => nav.navigate("Home")} style={{ paddingHorizontal: 8, paddingVertical: 6 }}>
            <Ionicons
              name={isHomeActive ? "home" : "home-outline"}
              size={24}
              color={isHomeActive ? activeColor : inactiveColor}
            />
          </Pressable>
        </View>
      ),
    });
  }, [nav, params.groupId, group?.name, user, colors]);

  // Group meta
  useEffect(() => {
    if (initializing || !user) return;
    const unsub = onSnapshot(
      groupDoc(params.groupId),
      (snap) => {
        const d = snap.data() as any;
        setGroup({ name: d?.name, inviteCode: d?.inviteCode });
      },
      (err) => Alert.alert("Group error", err.message)
    );
    return unsub;
  }, [initializing, params.groupId, user]);

  // Messages
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
      const q = query(messagesCol(params.groupId), orderBy("createdAt", "desc"));
      unsub = onSnapshot(
        q,
        (snap) => setMessages(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }))),
        (err) => Alert.alert("Chat error", err.message)
      );
    })();

    return () => {
      active = false;
      unsub();
    };
  }, [params.groupId, user]);

  // Group member nicknames
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
        setGroupNameMap(next);
      },
      (err) => Alert.alert("Members error", err.message)
    );
    return unsub;
  }, [initializing, params.groupId, user]);

  // Resolve user display names lazily
  useEffect(() => {
    const ids = Array.from(new Set(messages.map((m) => m.userId).filter(Boolean)));
    const missing = ids.filter(
      (uid) => !nameMap[uid] && !groupNameMap[uid] && !inflight.current.has(uid)
    );
    if (!missing.length) return;

    (async () => {
      const updates: Record<string, string> = {};
      for (const uid of missing) {
        inflight.current.add(uid);
        try {
          const snap = await getDoc(doc(db, "users", uid));
          const dn = (snap.data() as any)?.displayName;
          updates[uid] = typeof dn === "string" && dn.trim().length ? dn.trim() : fallbackName(uid);
        } catch {
          updates[uid] = fallbackName(uid);
        } finally {
          inflight.current.delete(uid);
        }
      }
      if (Object.keys(updates).length) setNameMap((p) => ({ ...p, ...updates }));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  useEffect(() => {
    const missing = messages.filter((message) => {
      const m = message as any;
      if (m?.type !== "workout") return false;
      if (!m?.userId || !m?.workoutId) return false;
      const key = workoutKey(m.userId, m.workoutId);
      if (!key || workoutDetails[key]) return false;
      if (Array.isArray(m.activityTypes) && m.activityTypes.length) return false;
      return true;
    });

    if (!missing.length) return;

    let active = true;

    (async () => {
      const updates: Record<string, WorkoutDetails> = {};
      for (const message of missing) {
        const m = message as any;
        const key = workoutKey(m.userId, m.workoutId);
        if (!key || updates[key]) continue;
        try {
          const snap = await getDoc(userWorkoutDoc(m.userId, m.workoutId));
          if (!snap.exists()) continue;
          const data = snap.data() as WorkoutDetails;
          updates[key] = {
            activityTypes: Array.isArray(data.activityTypes) ? data.activityTypes : undefined,
            durationMinutes:
              typeof data.durationMinutes === "number" ? data.durationMinutes : undefined,
            notes: typeof data.notes === "string" ? data.notes : undefined,
          };
        } catch {
          // ignore single-message failures
        }
      }
      if (!active || !Object.keys(updates).length) return;
      setWorkoutDetails((prev) => ({ ...prev, ...updates }));
    })();

    return () => {
      active = false;
    };
  }, [messages, workoutDetails]);

  const messagesWithDetails = useMemo(() => {
    return messages.map((message) => {
      const m = message as any;
      if (m?.type !== "workout") return message;
      const key = workoutKey(m.userId, m.workoutId);
      const details = key ? workoutDetails[key] : undefined;
      if (!details) return message;
      return {
        ...m,
        activityTypes: Array.isArray(m.activityTypes) && m.activityTypes.length
          ? m.activityTypes
          : details.activityTypes,
        durationMinutes:
          typeof m.durationMinutes === "number" && m.durationMinutes > 0
            ? m.durationMinutes
            : details.durationMinutes,
        workoutNotes: details.notes,
      };
    });
  }, [messages, workoutDetails]);

  async function sendText(text: string) {
    if (!user) return;
    const t = text.trim();
    if (!t.length) return;

    await addDoc(messagesCol(params.groupId), {
      type: "text",
      userId: user.uid,
      text: t,
      createdAt: serverTimestamp(),
    });
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#f6f6f6" }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={headerHeight}
    >
      <View style={{ flex: 1 }}>
        <View style={{ paddingHorizontal: 12, paddingTop: 8, paddingBottom: 6 }}>
          <Text style={{ fontSize: 12, opacity: 0.7 }}>
            Invite code: <Text style={{ fontWeight: "900" }}>{group.inviteCode ?? "—"}</Text>
          </Text>
        </View>

        <FlatList
          data={messagesWithDetails}
          inverted
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 220 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          renderItem={({ item }) => {
            const uid = item.userId as string | undefined;
            const isMine = !!user && !!uid && uid === user.uid;
            const displayName = uid
              ? groupNameMap[uid] ?? nameMap[uid] ?? fallbackName(uid)
              : "System";

            return (
              <MessageTile
                message={item as any}
                isMine={isMine}
                displayName={displayName}
                onPressUser={(userId) => nav.navigate("MemberProfile", { groupId: params.groupId, userId })}
              />
            );
          }}
        />

        <View
          style={{
            paddingHorizontal: 12,
            paddingBottom: 12,
            backgroundColor: "#f6f6f6",
          }}
        >
          <ComposerBar onSendText={sendText} containerStyle={{ padding: 0, backgroundColor: "transparent" }} />
          <Pressable
            onPress={() => setShowLog(true)}
            style={{
              backgroundColor: "#111",
              borderRadius: 18,
              paddingVertical: 16,
              alignItems: "center",
              marginTop: 10,
            }}
          >
            <Text style={{ color: "white", fontWeight: "900", fontSize: 16 }}>Log workout</Text>
          </Pressable>
        </View>
      </View>

      {user ? (
        <LogWorkoutModal visible={showLog} onClose={() => setShowLog(false)} userId={user.uid} />
      ) : null}
    </KeyboardAvoidingView>
  );
}
