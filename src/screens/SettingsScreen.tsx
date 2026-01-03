import React, { useEffect, useState } from "react";
import { View, Text, Switch } from "react-native";
import { onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";

import { useAuth } from "../auth/useAuth";
import { userSettingsDoc } from "../firestore/paths";
import type { UserSettings } from "../types/models";

export default function SettingsScreen() {
  const { user } = useAuth();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  useEffect(() => {
    if (!user) return;

    const unsub = onSnapshot(
      userSettingsDoc(user.uid),
      (snap) => {
        const data = snap.data() as UserSettings | undefined;
        setNotificationsEnabled(data?.notificationsEnabled ?? true);
      },
      () => setNotificationsEnabled(true)
    );

    return unsub;
  }, [user]);

  async function onToggleNotifications(nextValue: boolean) {
    if (!user) return;
    setNotificationsEnabled(nextValue);
    try {
      await setDoc(
        userSettingsDoc(user.uid),
        {
          notificationsEnabled: nextValue,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch {
      // non-fatal
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#f6f6f6", padding: 16 }}>
      <Text style={{ fontSize: 22, fontWeight: "900" }}>Settings</Text>
      <Text style={{ marginTop: 4, opacity: 0.6 }}>Manage your notification preferences.</Text>

      <View
        style={{
          marginTop: 16,
          backgroundColor: "white",
          borderRadius: 16,
          padding: 16,
          borderWidth: 1,
          borderColor: "#e6e6e6",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text style={{ fontWeight: "800", fontSize: 16 }}>Workout notifications</Text>
          <Text style={{ marginTop: 6, opacity: 0.6 }}>
            Get notified when group members log workouts.
          </Text>
        </View>
        <Switch value={notificationsEnabled} onValueChange={onToggleNotifications} />
      </View>
    </View>
  );
}
