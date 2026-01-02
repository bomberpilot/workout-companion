import React, { useState } from "react";
import { View, Text, Alert, Pressable } from "react-native";
import { addDoc, collection, doc, getDocs, query, serverTimestamp, setDoc, where } from "firebase/firestore";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { RootStackParamList } from "../navigation/RootNavigator";
import { useAuth } from "../auth/useAuth";
import { db } from "../config/firebase";
import Tile from "../components/ui/Tile";
import TextField from "../components/ui/TextField";
import Button from "../components/ui/Button";

type Nav = NativeStackNavigationProp<RootStackParamList, "GroupManage">;

type GroupType = "friends" | "family" | "coworkers" | "other";
const GROUP_TYPES: GroupType[] = ["friends", "family", "coworkers", "other"];

function label(t: GroupType) {
  if (t === "coworkers") return "Co-workers";
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function makeInviteCode(len = 6) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

export default function GroupManageScreen() {
  const nav = useNavigation<Nav>();
  const { user } = useAuth();

  const [inviteCode, setInviteCode] = useState("");
  const [groupName, setGroupName] = useState("");
  const [groupType, setGroupType] = useState<GroupType>("friends");
  const [busy, setBusy] = useState(false);

  async function joinGroup() {
    if (!user) return;
    const code = inviteCode.trim().toUpperCase();
    if (!code) return Alert.alert("Join group", "Enter an invite code.");

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
          joinDate: serverTimestamp(),
        },
        { merge: true }
      );

      await setDoc(doc(db, "users", user.uid, "groups", groupId), { joinedAt: serverTimestamp() }, { merge: true });

      nav.navigate("Chat", { groupId });
    } catch (e: any) {
      Alert.alert("Join error", e?.message ?? "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function createGroup() {
    if (!user) return;
    const name = groupName.trim();
    if (!name) return Alert.alert("Create group", "Enter a group name.");

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
          joinDate: serverTimestamp(),
        },
        { merge: true }
      );

      await setDoc(
        doc(db, "users", user.uid, "groups", g.id),
        { joinedAt: serverTimestamp(), role: "owner" },
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
    <View style={{ flex: 1, backgroundColor: "#f6f6f6", padding: 16 }}>
      <Tile>
        <Text style={{ fontSize: 20, fontWeight: "900" }}>Join or create</Text>
        <Text style={{ marginTop: 6, opacity: 0.7 }}>Join with a code, or create a new group.</Text>

        <TextField label="Invite code (join)" value={inviteCode} onChangeText={setInviteCode} placeholder="e.g., BQKW12" />
        <Button title={busy ? "Working…" : "Join group"} onPress={joinGroup} disabled={busy} />

        <View style={{ height: 16 }} />

        <TextField label="Group name (create)" value={groupName} onChangeText={setGroupName} placeholder="e.g., Family Accountability" />

        <Text style={{ marginTop: 14, fontWeight: "800" }}>Group type</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 8 }}>
          {GROUP_TYPES.map((t) => {
            const selected = t === groupType;
            return (
              <Pressable
                key={t}
                onPress={() => setGroupType(t)}
                style={{
                  paddingVertical: 8,
                  paddingHorizontal: 12,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: selected ? "#111" : "#ddd",
                  marginRight: 8,
                  marginBottom: 8,
                  backgroundColor: selected ? "#111" : "white",
                }}
              >
                <Text style={{ fontWeight: "800", color: selected ? "white" : "#111" }}>{label(t)}</Text>
              </Pressable>
            );
          })}
        </View>

        <Button title={busy ? "Working…" : "Create group"} onPress={createGroup} disabled={busy} />
      </Tile>
    </View>
  );
}
