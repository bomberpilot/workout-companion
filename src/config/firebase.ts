import { initializeApp } from "firebase/app";
import { initializeAuth, getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

// ---- RN auth persistence, Metro-safe loading ----
let getReactNativePersistence: ((storage: any) => any) | null = null;

try {
  // Preferred (newer firebase)
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  getReactNativePersistence = require("firebase/auth/react-native").getReactNativePersistence;
} catch {
  try {
    // Metro-friendly fallback that exists in many firebase builds
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    getReactNativePersistence = require("firebase/auth/dist/rn/index.js").getReactNativePersistence;
  } catch {
    getReactNativePersistence = null;
  }
}

export const auth =
  getReactNativePersistence
    ? initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) })
    : getAuth(app); // fallback: works, but session won't persist

export const db = getFirestore(app);
