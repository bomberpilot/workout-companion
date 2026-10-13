import React, { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { signOut } from "firebase/auth";

import { useAuth } from "../auth/useAuth";
import { auth, db } from "../config/firebase";
import TextField from "../components/ui/TextField";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import SectionHeader from "../components/ui/SectionHeader";
import { useTheme } from "../theme/ThemeProvider";
import { useMemberGroupGoals } from "../goals/useMemberGroupGoals";
import type { RootStackParamList } from "../navigation/RootNavigator";

export default function ProfileScreen() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList, "Profile">>();
  const { user } = useAuth();
  const { colors, spacing, typography } = useTheme();
  const { groups, loading: groupsLoading, error: groupsError } = useMemberGroupGoals(user?.uid);
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
    <ScrollView style={{ flex: 1, backgroundColor: colors.background.primary }} contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xl }}>
      <SectionHeader title="Your profile" subtitle="Your commitments across all your groups." />

      <SectionHeader title="Your group goals" subtitle="Each group sees only the goals you set there." style={{ marginTop: spacing.lg }} />
      {groupsLoading ? <Text style={{ color: colors.text.muted, marginTop: spacing.md }}>Loading your goals…</Text> : null}
      {groupsError ? <Text style={{ color: colors.text.muted, marginTop: spacing.md }}>Unable to load goals: {groupsError}</Text> : null}
      {!groupsLoading && !groupsError && groups.length === 0 ? (
        <Text style={{ color: colors.text.muted, marginTop: spacing.md }}>Join or create a group to start a commitment.</Text>
      ) : null}
      {groups.map((group) => (
        <Card key={group.groupId} style={{ marginTop: spacing.md }}>
          <Pressable onPress={() => user && nav.navigate("MemberProfile", { groupId: group.groupId, userId: user.uid })} accessibilityRole="button" accessibilityLabel={`View your profile in ${group.groupName}`}>
            <Text style={{ color: colors.text.primary, fontSize: typography.size.md, fontWeight: typography.weight.bold }}>{group.groupName} ›</Text>
          </Pressable>
          {group.goals.length === 0 ? (
            <Text style={{ color: colors.text.muted, marginTop: spacing.sm }}>No personal goals yet.</Text>
          ) : group.goals.map((goal) => (
            <View key={goal.id} style={{ marginTop: spacing.md }}>
              <Text style={{ color: colors.text.primary, fontWeight: typography.weight.semibold }}>
                {goal.goalDateReason || `${goal.targetWorkouts} workouts`}
              </Text>
              <Text style={{ color: colors.text.muted, marginTop: spacing.xs }}>
                {goal.completed} of {goal.targetWorkouts} workouts{goal.goalDateISO ? ` · by ${goal.goalDateISO}` : ""}
              </Text>
              <View style={{ backgroundColor: colors.surface.cardAlt, height: spacing.xs, borderRadius: spacing.xs, overflow: "hidden", marginTop: spacing.sm }}>
                <View style={{ backgroundColor: colors.accent.primary, height: "100%", width: `${Math.min(100, goal.completed / goal.targetWorkouts * 100)}%` }} />
              </View>
            </View>
          ))}
          <Pressable onPress={() => nav.navigate("GoalSetup", { groupId: group.groupId })} accessibilityRole="button" style={{ marginTop: spacing.md }}>
            <Text style={{ color: colors.accent.primary, fontWeight: typography.weight.semibold }}>Add a goal</Text>
          </Pressable>
        </Card>
      ))}

      <SectionHeader title="Account" subtitle="Your name is what friends see in group conversations." style={{ marginTop: spacing.xl }} />

      <Card style={{ marginTop: spacing.md }}>
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
    </ScrollView>
  );
}
