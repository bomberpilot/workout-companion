import React, { useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useHeaderHeight } from "@react-navigation/elements";
import { Ionicons } from "@expo/vector-icons";
import {
  addDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";

import { RootStackParamList } from "../navigation/RootNavigator";
import { useAuth } from "../auth/useAuth";
import { groupDoc, groupMembersCol, messagesCol } from "../firestore/paths";
import MessageTile from "../components/chat/MessageTile";
import ComposerBar from "../components/chat/ComposerBar";
import LogWorkoutModal from "../components/workout/LogWorkoutModal";
import { useTheme } from "../theme/ThemeProvider";
import Card from "../components/ui/Card";
import PrimaryActionButton from "../components/ui/PrimaryActionButton";

type R = RouteProp<RootStackParamList, "Chat">;
type Nav = NativeStackNavigationProp<RootStackParamList, "Chat">;

type GroupMeta = { name?: string; inviteCode?: string };
function fallbackName(uid: string) {
  return uid.slice(0, 6);
}

export default function GroupChatScreen() {
  const { params } = useRoute<R>();
  const nav = useNavigation<Nav>();
  const { user, initializing } = useAuth();
  const headerHeight = useHeaderHeight();
  const { colors, radius, spacing, typography } = useTheme();

  const [group, setGroup] = useState<GroupMeta>({});
  const [messages, setMessages] = useState<any[]>([]);
  const [groupNameMap, setGroupNameMap] = useState<Record<string, string>>({});
  const [showLog, setShowLog] = useState(false);

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
          style={({ pressed }) => ({
            paddingHorizontal: spacing.sm,
            paddingVertical: spacing.xs,
            borderRadius: radius.md,
            backgroundColor: pressed ? colors.surface.cardAlt : colors.background.primary,
          })}
        >
          <Text
            style={{
              color: colors.text.primary,
              fontWeight: typography.weight.semibold,
              fontSize: typography.size.sm,
            }}
          >
            Group Progress
          </Text>
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
            style={({ pressed }) => ({
              paddingHorizontal: spacing.sm,
              paddingVertical: spacing.xs,
              opacity: user ? (pressed ? 0.7 : 1) : 0.5,
            })}
          >
            <Ionicons
              name={isProfileActive ? "person" : "person-outline"}
              size={typography.size.xl}
              color={isProfileActive ? activeColor : inactiveColor}
            />
          </Pressable>
          <Pressable
            onPress={() => nav.navigate("Home")}
            style={({ pressed }) => ({
              paddingHorizontal: spacing.sm,
              paddingVertical: spacing.xs,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Ionicons
              name={isHomeActive ? "home" : "home-outline"}
              size={typography.size.xl}
              color={isHomeActive ? activeColor : inactiveColor}
            />
          </Pressable>
        </View>
      ),
    });
  }, [
    nav,
    params.groupId,
    group?.name,
    user,
    colors,
    radius.md,
    spacing.sm,
    spacing.xs,
    typography.size.sm,
    typography.size.xl,
    typography.weight.semibold,
  ]);

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
    const q = query(messagesCol(params.groupId), orderBy("createdAt", "desc"));
    return onSnapshot(
      q,
      (snap) => setMessages(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }))),
      (err) => Alert.alert("Chat error", err.message)
    );
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
      style={{ flex: 1, backgroundColor: colors.background.primary }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={headerHeight}
    >
      <View style={{ flex: 1 }}>
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xs }}>
          <Card style={{ padding: spacing.md }}>
            <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "baseline" }}>
              <Text style={{ fontSize: typography.size.xs, color: colors.text.muted }}>Invite code: </Text>
              <Text
                style={{
                  fontSize: typography.size.xs,
                  fontWeight: typography.weight.semibold,
                  color: colors.text.primary,
                }}
                selectable
              >
                {group.inviteCode ?? "—"}
              </Text>
            </View>
          </Card>
        </View>

        <FlatList
          data={messages}
          inverted
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: spacing["3xl"] * 4 }} // Reserve space for composer + primary action.
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          renderItem={({ item }) => {
            const uid = item.userId as string | undefined;
            const isMine = !!user && !!uid && uid === user.uid;
            const displayName = uid
              ? groupNameMap[uid] ?? fallbackName(uid)
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
            paddingHorizontal: spacing.lg,
            paddingBottom: spacing.lg,
            backgroundColor: colors.background.primary,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: colors.border.subtle,
          }}
        >
          <ComposerBar
            onSendText={sendText}
            containerStyle={{ padding: 0, backgroundColor: colors.background.primary }}
          />
          <View style={{ marginTop: spacing.md }}>
            <PrimaryActionButton title="Log workout" onPress={() => setShowLog(true)} />
          </View>
        </View>
      </View>

      {user ? (
        <LogWorkoutModal visible={showLog} onClose={() => setShowLog(false)} userId={user.uid} />
      ) : null}
    </KeyboardAvoidingView>
  );
}
