import React, { useEffect, useState } from "react";
import { Alert, Text, View } from "react-native";
import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { signOut } from "firebase/auth";

import { useAuth } from "../auth/useAuth";
import { auth, db } from "../config/firebase";
import TextField from "../components/ui/TextField";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import SectionHeader from "../components/ui/SectionHeader";
import { useTheme } from "../theme/ThemeProvider";

export default function ProfileScreen() {
  const { user } = useAuth();
  const { colors, spacing, typography } = useTheme();
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
    <View style={{ flex: 1, backgroundColor: colors.background.primary, padding: spacing.lg }}>
      <SectionHeader title="Profile" subtitle="This name is what your friends will see in chat." />

      <Card style={{ marginTop: spacing.lg }}>
        <TextField
          label="Display name"
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="Chief"
        />

        <View style={{ marginTop: spacing.md }}>
          <Text style={{ fontWeight: typography.weight.semibold, color: colors.text.muted }}>
            Signed in as
          </Text>
          <Text
            style={{
              marginTop: spacing.xs,
              fontWeight: typography.weight.bold,
              color: colors.text.primary,
            }}
          >
            {email || "—"}
          </Text>
        </View>

        <View style={{ marginTop: spacing.lg }}>
          <Button title="Save" onPress={save} />
        </View>
        <View style={{ marginTop: spacing.sm }}>
          <Button title="Sign out" onPress={doSignOut} variant="secondary" />
        </View>
      </Card>
    </View>
  );
}
