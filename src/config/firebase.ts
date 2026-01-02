import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { initializeAuth, getAuth, type Auth } from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Load RN persistence via require to keep Metro happy across environments
type GetReactNativePersistenceFn = (storage: any) => any;

let getReactNativePersistenceFn: GetReactNativePersistenceFn | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  getReactNativePersistenceFn = require("firebase/auth/react-native")?.getReactNativePersistence ?? null;
} catch {
  getReactNativePersistenceFn = null;
}

// Fast Refresh safe: reuse existing auth if already initialized
let auth: Auth;
try {
  auth = getAuth(app);
} catch {
  auth =
    getReactNativePersistenceFn
      ? initializeAuth(app, { persistence: getReactNativePersistenceFn(AsyncStorage) })
      : getAuth(app);
}

export { auth };

export const db = getFirestore(app);
