import React, { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, Text, View } from "react-native";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";

import { auth, db } from "../config/firebase";
import TextField from "../components/ui/TextField";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import { useTheme } from "../theme/ThemeProvider";

export default function SignInScreen() {
  const { colors, spacing, typography } = useTheme();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    const e = email.trim().toLowerCase();
    const p = password;

    if (!e || !p) return Alert.alert("Missing info", "Enter email and password.");
    if (p.length < 6) return Alert.alert("Password", "Use at least 6 characters.");

    setBusy(true);
    try {
      if (mode === "signin") {
        await signInWithEmailAndPassword(auth, e, p);
      } else {
        const cred = await createUserWithEmailAndPassword(auth, e, p);

        // Create user profile doc (displayName can be set later in Profile)
        await setDoc(
          doc(db, "users", cred.user.uid),
          {
            email: e,
            displayName: "",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      }
    } catch (err: any) {
      Alert.alert("Auth error", err?.message ?? "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background.primary }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={{ flex: 1, padding: spacing.lg, justifyContent: "center" }}>
        <Text
          style={{
            fontSize: typography.size["2xl"],
            fontWeight: typography.weight.bold,
            color: colors.text.primary,
            textAlign: "center",
          }}
        >
          Workout Companion
        </Text>
        <Text
          style={{
            marginTop: spacing.xs,
            color: colors.text.muted,
            textAlign: "center",
          }}
        >
          Sign in, then start complaining productively.
        </Text>

        <Card style={{ marginTop: spacing.xl }}>
          <Text style={{ fontSize: typography.size.lg, fontWeight: typography.weight.bold, color: colors.text.primary }}>
            {mode === "signin" ? "Sign in" : "Create account"}
          </Text>

          <TextField
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
          />

          <TextField
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry
          />

          <Button
            title={busy ? "Working…" : mode === "signin" ? "Sign in" : "Create account"}
            onPress={submit}
            disabled={busy}
          />

          <Pressable
            onPress={() => setMode((m) => (m === "signin" ? "signup" : "signin"))}
            style={({ pressed }) => ({
              marginTop: spacing.md,
              alignItems: "center",
              opacity: pressed ? 0.7 : 1,
            })}
            disabled={busy}
          >
            <Text style={{ fontWeight: typography.weight.semibold, color: colors.text.secondary }}>
              {mode === "signin" ? "New here? Create an account" : "Already have an account? Sign in"}
            </Text>
          </Pressable>
        </Card>
      </View>
    </KeyboardAvoidingView>
  );
}
