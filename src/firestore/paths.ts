import { collection, doc } from "firebase/firestore";
import { db } from "../config/firebase";

/**
 * User-scoped subcollections
 */
export const userGroupsCol = (uid: string) => collection(db, "users", uid, "groups");
export const userWorkoutsCol = (uid: string) => collection(db, "users", uid, "workouts");

/**
 * Group-scoped docs/collections
 */
export const groupDoc = (groupId: string) => doc(db, "groups", groupId);
export const messagesCol = (groupId: string) => collection(db, "groups", groupId, "messages");

/**
 * Goals: one goal doc per (groupId, userId)
 * Stored at: groups/{groupId}/goals/{uid}
 */
export const goalDoc = (groupId: string, uid: string) => doc(db, "groups", groupId, "goals", uid);
