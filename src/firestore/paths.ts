// src/firestore/paths.ts

import { collection, doc } from "firebase/firestore";
import { db } from "../config/firebase";

/**
 * Root collections
 */
export const usersCol = () => collection(db, "users");
export const userDoc = (userId: string) => doc(db, "users", userId);

export const groupsCol = () => collection(db, "groups");
export const groupDoc = (groupId: string) => doc(db, "groups", groupId);

/**
 * User subcollections
 */
export const userGroupsCol = (userId: string) =>
  collection(db, "users", userId, "groups");

export const userGroupDoc = (userId: string, groupId: string) =>
  doc(db, "users", userId, "groups", groupId);

export const userWorkoutsCol = (userId: string) =>
  collection(db, "users", userId, "workouts");

export const userWorkoutDoc = (userId: string, workoutId: string) =>
  doc(db, "users", userId, "workouts", workoutId);

export const userNotificationsCol = (userId: string) =>
  collection(db, "users", userId, "notifications");

export const userNotificationDoc = (userId: string, notificationId: string) =>
  doc(db, "users", userId, "notifications", notificationId);

/**
 * User private data
 * (single-document pattern for active goal)
 */
export const userPrivateCol = (userId: string) =>
  collection(db, "users", userId, "private");

export const goalDoc = (userId: string) =>
  doc(db, "users", userId, "private", "goal");

export const userSettingsDoc = (userId: string) =>
  doc(db, "users", userId, "private", "settings");

/**
 * Group subcollections
 */
export const messagesCol = (groupId: string) =>
  collection(db, "groups", groupId, "messages");

export const messageDoc = (groupId: string, messageId: string) =>
  doc(db, "groups", groupId, "messages", messageId);

export const groupMembersCol = (groupId: string) =>
  collection(db, "groups", groupId, "members");

export const groupMemberDoc = (groupId: string, userId: string) =>
  doc(db, "groups", groupId, "members", userId);
