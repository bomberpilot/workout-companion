import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import * as FirebaseAuth from "firebase/auth";
import type { Auth, Persistence } from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Firebase exposes this helper through its React Native conditional entrypoint,
// but the shared browser/Node TypeScript declarations omit it.
type NativeAuthModule = typeof FirebaseAuth & {
  getReactNativePersistence?: (storage: typeof AsyncStorage) => Persistence;
};

function initializeAppAuth(): Auth {
  if (Platform.OS === "web") {
    return FirebaseAuth.getAuth(app);
  }

  const getReactNativePersistence = (FirebaseAuth as NativeAuthModule).getReactNativePersistence;
  if (typeof getReactNativePersistence !== "function") {
    throw new Error("The Firebase React Native persistence entrypoint is unavailable.");
  }

  try {
    // getAuth initializes auth with default persistence if called first.
    // Configure persistent native storage before any default initialization.
    return FirebaseAuth.initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch (error: unknown) {
    // Fast Refresh may re-evaluate this module after auth was initialized.
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "auth/already-initialized"
    ) {
      return FirebaseAuth.getAuth(app);
    }
    throw error;
  }
}

export const auth = initializeAppAuth();
export const db = getFirestore(app);
