import React, { useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { addDoc, collection, doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import type { RootStackParamList } from "../navigation/RootNavigator";
import { useAuth } from "../auth/useAuth";
import { db } from "../config/firebase";
import TextField from "../components/ui/TextField";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import SectionHeader from "../components/ui/SectionHeader";
import { GROUP_TYPES, label, makeInviteCode } from "./groupUtils";
import { useTheme } from "../theme/ThemeProvider";

type Nav = NativeStackNavigationProp<RootStackParamList, "CreateGroup">;

export default function CreateGroupScreen() {
  const nav = useNavigation<Nav>();
  const { user } = useAuth();
  const { colors, radius, spacing, typography } = useTheme();

  const [groupName, setGroupName] = useState("");
  const [groupType, setGroupType] = useState<(typeof GROUP_TYPES)[number]>("friends");
  const [nickname, setNickname] = useState("");
  const [defaultNickname, setDefaultNickname] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        const dn = String((snap.data() as any)?.displayName ?? "").trim();
        if (dn) setDefaultNickname(dn);
      } catch {
        // non-fatal
      }
    })();
  }, [user]);

  async function createGroup() {
    if (!user) return;
    const name = groupName.trim();
    if (!name) return Alert.alert("Create group", "Enter a group name.");
    const nick = nickname.trim() || defaultNickname || user.uid.slice(0, 6);

    setBusy(true);
    try {
      const code = makeInviteCode();
      const g = await addDoc(collection(db, "groups"), {
        name,
        type: groupType,
        inviteCode: code,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await setDoc(
        doc(db, "groups", g.id, "members", user.uid),
        {
          userId: user.uid,
          role: "owner",
          nickname: nick,
          joinDate: serverTimestamp(),
        },
        { merge: true }
      );

      await setDoc(
        doc(db, "users", user.uid, "groups", g.id),
        { joinedAt: serverTimestamp(), role: "owner", nickname: nick },
        { merge: true }
      );

      nav.navigate("GoalSetup", { groupId: g.id });
    } catch (e: any) {
      Alert.alert("Create error", e?.message ?? "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background.primary, padding: spacing.lg }}>
      <SectionHeader title="Create group" subtitle="Set up a new group and invite others." />

      <Card style={{ marginTop: spacing.lg }}>
        <TextField
          label="Group name"
          value={groupName}
          onChangeText={setGroupName}
          placeholder="e.g., Family Accountability"
        />
        <TextField
          label="Your nickname in this group"
          value={nickname}
          onChangeText={setNickname}
          placeholder={defaultNickname || "e.g., Chief"}
        />

        <Text style={{ marginTop: spacing.md, fontWeight: typography.weight.semibold, color: colors.text.primary }}>
          Group type
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: spacing.sm }}>
          {GROUP_TYPES.map((t) => {
            const selected = t === groupType;
            return (
              <Pressable
                key={t}
                onPress={() => setGroupType(t)}
                style={({ pressed }) => ({
                  paddingVertical: spacing.sm,
                  paddingHorizontal: spacing.md,
                  borderRadius: radius.pill,
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: selected ? colors.accent.primary : colors.border.subtle,
                  marginRight: spacing.sm,
                  marginBottom: spacing.sm,
                  backgroundColor: selected
                    ? colors.accent.primary
                    : pressed
                      ? colors.surface.cardAlt
                      : colors.surface.card,
                })}
              >
                <Text
                  style={{
                    fontWeight: typography.weight.semibold,
                    color: selected ? colors.accent.onAccent : colors.text.primary,
                  }}
                >
                  {label(t)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Button title={busy ? "Working…" : "Create group"} onPress={createGroup} disabled={busy} />
      </Card>
    </View>
  );
}
