import React, { useEffect, useState } from "react";
import { Switch, Text, View } from "react-native";
import { onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";

import { useAuth } from "../auth/useAuth";
import Card from "../components/ui/Card";
import SectionHeader from "../components/ui/SectionHeader";
import { userSettingsDoc } from "../firestore/paths";
import type { UserSettings } from "../types/models";
import { useTheme } from "../theme/ThemeProvider";

export default function SettingsScreen() {
  const { user } = useAuth();
  const { colors, spacing, typography } = useTheme();
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
    <View style={{ flex: 1, backgroundColor: colors.background.primary, padding: spacing.lg }}>
      <SectionHeader title="Settings" subtitle="Manage your notification preferences." />

      <Card style={{ marginTop: spacing.lg }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ flex: 1, paddingRight: spacing.md }}>
            <Text style={{ fontWeight: typography.weight.semibold, fontSize: typography.size.md, color: colors.text.primary }}>
              Workout notifications
            </Text>
            <Text style={{ marginTop: spacing.xs, color: colors.text.muted }}>
              Get notified when group members log workouts.
            </Text>
          </View>
          <Switch
            value={notificationsEnabled}
            onValueChange={onToggleNotifications}
            trackColor={{ false: colors.border.subtle, true: colors.accent.primaryMuted }}
            thumbColor={notificationsEnabled ? colors.accent.primary : colors.surface.card}
          />
        </View>
      </Card>
    </View>
  );
}
