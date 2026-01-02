import React, { useEffect, useMemo, useState } from "react";
import { View, Text, FlatList, Alert } from "react-native";
import { RouteProp, useRoute } from "@react-navigation/native";
import { collection, doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";

import { RootStackParamList } from "../navigation/RootNavigator";
import { useAuth } from "../auth/useAuth";
import { db } from "../config/firebase";
import Tile from "../components/ui/Tile";
import TextField from "../components/ui/TextField";
import Button from "../components/ui/Button";
import { groupMembersCol } from "../firestore/paths";

type R = RouteProp<RootStackParamList, "GroupProgress">;

type Row = {
  userId: string;
  displayName: string;
  target: number;
  completed: number;
};

type GoalRow = {
  userId: string;
  target: number;
  completed: number;
  displayName?: string;
};

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

export default function GroupProgressScreen() {
  const { params } = useRoute<R>();
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [goalRows, setGoalRows] = useState<GoalRow[]>([]);
  const [memberNames, setMemberNames] = useState<Record<string, string>>({});
  const [nickname, setNickname] = useState("");
  const [dirtyNickname, setDirtyNickname] = useState(false);
  const [savingNickname, setSavingNickname] = useState(false);

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
      const goalsRef = collection(db, "groups", params.groupId, "goals");
      unsub = onSnapshot(
        goalsRef,
        (snap) => {
          const next: GoalRow[] = snap.docs.map((d) => {
            const gd = d.data() as any;
            const target = Number(gd?.targetWorkouts ?? 0) || 0;
            const completed = Number(gd?.completedWorkouts ?? 0) || 0;
            const displayName = String(gd?.displayName ?? "").trim() || d.id.slice(0, 6);
            return { userId: d.id, displayName, target, completed };
          });

          setGoalRows(next);
        },
        (err) => Alert.alert("Progress error", err.message)
      );
    })();

    return () => {
      active = false;
      unsub();
    };
  }, [params.groupId, user]);

  useEffect(() => {
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
        setMemberNames(next);
      },
      (err) => Alert.alert("Members error", err.message)
    );
    return unsub;
  }, [params.groupId]);

  useEffect(() => {
    if (!user) return;
    if (dirtyNickname) return;
    const currentNickname = memberNames[user.uid] ?? "";
    setNickname(currentNickname);
  }, [dirtyNickname, memberNames, user]);

  useEffect(() => {
    const nextRows: Row[] = goalRows.map((row) => ({
      userId: row.userId,
      target: row.target,
      completed: row.completed,
      displayName: memberNames[row.userId] ?? row.displayName ?? row.userId.slice(0, 6),
    }));

    nextRows.sort((a, b) => {
      const ra = a.target ? a.completed / a.target : 0;
      const rb = b.target ? b.completed / b.target : 0;
      return rb - ra || b.completed - a.completed;
    });

    setRows(nextRows);
  }, [goalRows, memberNames]);

  async function saveNickname() {
    if (!user) return;
    const trimmed = nickname.trim();
    if (!trimmed.length) {
      Alert.alert("Nickname", "Enter a nickname to use for this group.");
      return;
    }

    setSavingNickname(true);
    try {
      await setDoc(
        doc(db, "groups", params.groupId, "members", user.uid),
        { nickname: trimmed, updatedAt: serverTimestamp() },
        { merge: true }
      );
      await setDoc(
        doc(db, "users", user.uid, "groups", params.groupId),
        { nickname: trimmed, updatedAt: serverTimestamp() },
        { merge: true }
      );
      setDirtyNickname(false);
      Alert.alert("Saved", "Your nickname for this group was updated.");
    } catch (err: any) {
      Alert.alert("Nickname error", err?.message ?? "Unable to update nickname.");
    } finally {
      setSavingNickname(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#f6f6f6", paddingTop: 12 }}>
      <Tile>
        <Text style={{ fontSize: 16, fontWeight: "900" }}>Your nickname in this group</Text>
        <Text style={{ marginTop: 6, opacity: 0.7 }}>
          This nickname will show in chat and progress lists for this group.
        </Text>
        <TextField
          label="Nickname"
          value={nickname}
          onChangeText={(value) => {
            setNickname(value);
            setDirtyNickname(true);
          }}
          placeholder="e.g., Chief"
        />
        <Button title={savingNickname ? "Saving…" : "Save nickname"} onPress={saveNickname} disabled={savingNickname} />
      </Tile>

      <FlatList
        data={rows}
        keyExtractor={(r) => r.userId}
        renderItem={({ item }) => <ProgressRow row={item} />}
        ListEmptyComponent={
          <View style={{ padding: 16 }}>
            <Text style={{ opacity: 0.7 }}>No goals found yet for this group.</Text>
          </View>
        }
      />
    </View>
  );
}

function ProgressRow({ row }: { row: Row }) {
  const pct = useMemo(() => (row.target ? clamp01(row.completed / row.target) : 0), [row.completed, row.target]);

  return (
    <Tile>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
        <Text style={{ fontSize: 16, fontWeight: "900" }}>{row.displayName}</Text>
        <Text style={{ opacity: 0.7, fontWeight: "800" }}>
          {row.completed} / {row.target || "—"}
        </Text>
      </View>

      <View
        style={{
          height: 10,
          borderRadius: 999,
          backgroundColor: "#e8e8e8",
          marginTop: 10,
          overflow: "hidden",
        }}
      >
        <View style={{ width: `${pct * 100}%`, height: "100%", backgroundColor: "#111" }} />
      </View>

      <Text style={{ marginTop: 8, opacity: 0.6 }}>
        {row.target ? `${Math.round(pct * 100)}%` : "Set a target to track progress"}
      </Text>
    </Tile>
  );
}
