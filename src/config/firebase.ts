import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { env } from "./env";

const app = getApps().length ? getApps()[0] : initializeApp(env.firebase);

export const auth = getAuth(app);
export const db = getFirestore(app);