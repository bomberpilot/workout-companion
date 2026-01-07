// src/types/models.ts

import type { Timestamp } from "firebase/firestore";

export type GroupType = "friends" | "family" | "coworkers" | "other";
export type GroupGoalType = "frequency" | "duration";
export type GroupRole = "owner" | "admin" | "member";

export type UserProfile = {
  uid: string;
  email?: string;
  displayName: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

export type Group = {
  id: string;
  name: string;
  type: GroupType;
  inviteCode: string;

  createdBy: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;

  // NEW: group goal settings
  goalType: GroupGoalType;     // "frequency" | "duration"
  targetValue: number;         // workouts count OR minutes
  startDate: Timestamp;
  endDate: Timestamp;
};

export type GroupMember = {
  userId: string;
  nickname: string;            // per-group nickname
  role: GroupRole;
  joinDate: Timestamp;
};

export type Workout = {
  id: string;
  userId: string;
  groupId: string;
  activityTypes: string[];
  durationMinutes: number;
  date: Timestamp;
  performedAt: Timestamp;
  notes?: string;              // NEW: global notes
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

export type MessageType = "text" | "workout";

export type ChatMessage = {
  id: string;
  type: MessageType;
  userId: string;
  createdAt?: Timestamp;

  // text message
  text?: string;

  // workout message
  workoutId?: string;
  workoutDate?: Timestamp;
  activityTypes?: string[];
  durationMinutes?: number;

  // saved ONLY on the chat message
  groupNote?: string;
};

export type NotificationType = "group_workout";

export type AppNotification = {
  id: string;
  type: NotificationType;
  userId: string;
  actorUserId: string;
  actorName: string;
  groupId: string;
  workoutId: string;
  message: string;
  createdAt?: Timestamp;
  read?: boolean;
};

export type UserSettings = {
  notificationsEnabled: boolean;
  expoPushTokens?: string[];
  updatedAt?: Timestamp;
};
