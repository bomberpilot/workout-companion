import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  Pressable,
} from "react-native";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useHeaderHeight } from "@react-navigation/elements";
import {
  addDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";

import { RootStackParamList } from "../navigation/RootNavigator";
import { useAuth } from "../auth/useAuth";
import { db } from "../config/firebase";
import { groupDoc, messagesCol } from "../firestore/paths";
import MessageTile from "../components/chat/MessageTile";
import ComposerBar from "../components/chat/ComposerBar";

type R = RouteProp<RootStackParamList, "Chat">;
type Nav = NativeStackNavigationProp<RootStackParamList, "Chat">;

type GroupMeta = { name?: string; inviteCode?: string };

function fallbackName(uid: string) {
  return uid.slice(0, 6);
}

export default function GroupChatScreen() {
  const { params } = useRoute<R>();
  const nav = useNavigation<Nav>();
  const { user } = useAuth();
  const headerHeight = useHeaderHeight();

  const [group, setGroup] = useState<GroupMeta>({});
  const [messages, setMessages] = useState<any[]>([]);
  const [nameMap, setNameMap] = useState<Record<string, string>>({});
  const inflight = useRef<Set<string>>(new Set());

  // Header buttons
  useEffect(() => {
    nav.setOptions({
      headerTitle: group?.name?.trim()?.length ? group.name : "Group chat",
      headerLeft: () => (
        <Pressable
          onPress={() => nav.navigate("GroupProgress", { groupId: params.groupId })}
          style={{ paddingHorizontal: 10, paddingVertical: 6 }}
        >
          <Text style={{ fontWeight: "900" }}>Progress</Text>
        </Pressable>
      ),
      headerRight: () => (
        <Pressable onPress={() => nav.navigate("Home")} style={{ paddingHorizontal: 10, paddingVertical: 6 }}>
          <Text style={{ fontWeight: "900" }}>Home</Text>
        </Pressable>
      ),
    });
  }, [nav, params.groupId, group?.name]);

  // Group meta
  useEffect(() => {
    const unsub = onSnapshot(
      groupDoc(params.groupId),
      (snap) => {
        const d = snap.data() as any;
        setGroup({ name: d?.name, inviteCode: d?.inviteCode });
      },
      (err) => Alert.alert("Group error", err.message)
    );
    return unsub;
  }, [params.groupId]);

  // Messages
  useEffect(() => {
    const q = query(messagesCol(params.groupId), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => setMessages(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }))),
      (err) => Alert.alert("Chat error", err.message)
    );
    return unsub;
  }, [params.groupId]);

  // Resolve user display names lazily
  useEffect(() => {
    const ids = Array.from(new Set(messages.map((m) => m.userId).filter(Boolean)));
    const missing = ids.filter((uid) => !nameMap[uid] && !inflight.current.has(uid));
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
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={{ flex: 1 }}>
          <View style={{ paddingHorizontal: 12, paddingTop: 8, paddingBottom: 6 }}>
            <Text style={{ fontSize: 12, opacity: 0.7 }}>
              Invite code: <Text style={{ fontWeight: "900" }}>{group.inviteCode ?? "—"}</Text>
            </Text>
          </View>

          <FlatList
            data={messages}
            inverted
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingBottom: 190 }}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const uid = item.userId as string | undefined;
              const isMine = !!user && !!uid && uid === user.uid;
              const displayName = uid ? (nameMap[uid] ?? fallbackName(uid)) : "System";

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

          <ComposerBar onSendText={sendText} />
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}
