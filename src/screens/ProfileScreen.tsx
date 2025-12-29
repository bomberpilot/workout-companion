import React, { useEffect, useState } from "react";
import { View, Text, Alert } from "react-native";
import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { signOut } from "firebase/auth";

import { useAuth } from "../auth/useAuth";
import { auth, db } from "../config/firebase";
import Tile from "../components/ui/Tile";
import TextField from "../components/ui/TextField";
import Button from "../components/ui/Button";

export default function ProfileScreen() {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    if (!user) return;

    const unsub = onSnapshot(
      doc(db, "users", user.uid),
      (snap) => {
        const d = snap.data() as any;
        setDisplayName((d?.displayName ?? "").toString());
        setEmail((d?.email ?? user.email ?? "").toString());
      },
      (err) => Alert.alert("Profile error", err.message)
    );

    return unsub;
  }, [user]);

  async function save() {
    if (!user) return;

    const dn = displayName.trim();
    if (!dn.length) return Alert.alert("Display name", "Please enter a display name.");

    await setDoc(
      doc(db, "users", user.uid),
      { displayName: dn, updatedAt: serverTimestamp() },
      { merge: true }
    );

    Alert.alert("Saved", "Your display name was updated.");
  }

  async function doSignOut() {
    await signOut(auth);
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#f6f6f6", padding: 16 }}>
      <Tile>
        <Text style={{ fontSize: 20, fontWeight: "900" }}>Profile</Text>
        <Text style={{ opacity: 0.7, marginTop: 6 }}>
          This name is what your friends will see in chat.
        </Text>

        <TextField label="Display name" value={displayName} onChangeText={setDisplayName} placeholder="Chief" />

        <View style={{ marginTop: 10 }}>
          <Text style={{ fontWeight: "800", opacity: 0.7 }}>Signed in as</Text>
          <Text style={{ marginTop: 4, fontWeight: "900" }}>{email || "—"}</Text>
        </View>

        <Button title="Save" onPress={save} />
        <Button title="Sign out" onPress={doSignOut} />
      </Tile>
    </View>
  );
}
