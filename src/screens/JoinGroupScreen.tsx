import React, { useEffect, useState } from "react";
import { Alert, Text, View } from "react-native";
import { collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, where } from "firebase/firestore";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import type { RootStackParamList } from "../navigation/RootNavigator";
import { useAuth } from "../auth/useAuth";
import { db } from "../config/firebase";
import TextField from "../components/ui/TextField";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import SectionHeader from "../components/ui/SectionHeader";
import { useTheme } from "../theme/ThemeProvider";

type Nav = NativeStackNavigationProp<RootStackParamList, "JoinGroup">;

export default function JoinGroupScreen() {
  const nav = useNavigation<Nav>();
  const { user } = useAuth();
  const { colors, spacing } = useTheme();

  const [inviteCode, setInviteCode] = useState("");
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

  async function joinGroup() {
    if (!user) return;
    const code = inviteCode.trim().toUpperCase();
    if (!code) return Alert.alert("Join group", "Enter an invite code.");

    const nick = nickname.trim() || defaultNickname || user.uid.slice(0, 6);

    setBusy(true);
    try {
      const qy = query(collection(db, "groups"), where("inviteCode", "==", code));
      const snap = await getDocs(qy);
      if (snap.empty) return Alert.alert("Not found", "No group matches that invite code.");

      const groupId = snap.docs[0].id;

      await setDoc(
        doc(db, "groups", groupId, "members", user.uid),
        {
          userId: user.uid,
          role: "member",
          nickname: nick,
          joinDate: serverTimestamp(),
        },
        { merge: true }
      );

      await setDoc(
        doc(db, "users", user.uid, "groups", groupId),
        { joinedAt: serverTimestamp(), nickname: nick },
        { merge: true }
      );

      nav.navigate("GoalSetup", { groupId });
    } catch (e: any) {
      Alert.alert("Join error", e?.message ?? "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background.primary, padding: spacing.lg }}>
      <SectionHeader title="Join group" subtitle="Enter an invite code to join a group." />

      <Card style={{ marginTop: spacing.lg }}>
        <TextField label="Invite code" value={inviteCode} onChangeText={setInviteCode} placeholder="e.g., BQKW12" />
        <TextField
          label="Your nickname in this group"
          value={nickname}
          onChangeText={setNickname}
          placeholder={defaultNickname || "e.g., Chief"}
        />
        <Button title={busy ? "Working…" : "Join group"} onPress={joinGroup} disabled={busy} />
      </Card>
    </View>
  );
}
