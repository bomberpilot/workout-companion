import React, { useState } from "react";
import { View, Text, Pressable, Alert, KeyboardAvoidingView, Platform } from "react-native";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";

import { auth, db } from "../config/firebase";
import Tile from "../components/ui/Tile";
import TextField from "../components/ui/TextField";
import Button from "../components/ui/Button";

export default function SignInScreen() {
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
      style={{ flex: 1, backgroundColor: "#f6f6f6" }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={{ flex: 1, padding: 16, justifyContent: "center" }}>
        <Text style={{ fontSize: 26, fontWeight: "900", textAlign: "center" }}>
          Workout Accountability Companion
        </Text>
        <Text style={{ textAlign: "center", opacity: 0.7, marginTop: 6 }}>
          Sign in, then start complaining productively.
        </Text>

        <View style={{ marginTop: 18 }}>
          <Tile>
            <Text style={{ fontSize: 18, fontWeight: "900" }}>
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
              style={{ marginTop: 12, alignItems: "center" }}
              disabled={busy}
            >
              <Text style={{ fontWeight: "800", opacity: 0.75 }}>
                {mode === "signin" ? "New here? Create an account" : "Already have an account? Sign in"}
              </Text>
            </Pressable>
          </Tile>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
