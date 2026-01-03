import React, { useEffect, useState } from "react";
import { View, Text, Alert, Pressable } from "react-native";
import { addDoc, collection, doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import type { RootStackParamList } from "../navigation/RootNavigator";
import { useAuth } from "../auth/useAuth";
import { db } from "../config/firebase";
import Tile from "../components/ui/Tile";
import TextField from "../components/ui/TextField";
import Button from "../components/ui/Button";
import { GROUP_TYPES, label, makeInviteCode } from "./groupUtils";

type Nav = NativeStackNavigationProp<RootStackParamList, "CreateGroup">;

export default function CreateGroupScreen() {
  const nav = useNavigation<Nav>();
  const { user } = useAuth();

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
    <View style={{ flex: 1, backgroundColor: "#f6f6f6", padding: 16 }}>
      <Tile>
        <Text style={{ fontSize: 20, fontWeight: "900" }}>Create group</Text>
        <Text style={{ marginTop: 6, opacity: 0.7 }}>Set up a new group and invite others.</Text>

        <TextField label="Group name" value={groupName} onChangeText={setGroupName} placeholder="e.g., Family Accountability" />
        <TextField
          label="Your nickname in this group"
          value={nickname}
          onChangeText={setNickname}
          placeholder={defaultNickname || "e.g., Chief"}
        />

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
