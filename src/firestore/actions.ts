// src/firestore/actions.ts

import {
  addDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  serverTimestamp,
  setDoc,
  updateDoc,
  Timestamp,
  writeBatch,
} from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { app, db } from "../config/firebase";
import type { GroupGoalType, GroupType } from "../types/models";
import {
  groupMemberDoc,
  groupMembersCol,
  groupDoc,
  messagesCol,
  userGroupsCol,
  userNotificationsCol,
  userWorkoutsCol,
} from "./paths";

type CreateGroupInput = {
  name: string;
  type: GroupType;
  ownerNickname: string;
};

type GroupSettingsPatch = {
  goalType: GroupGoalType;
  targetValue: number;
  startDate: Timestamp;
  endDate: Timestamp;
};

function shouldCountDuration(groupData: any, workoutDate: Date) {
  const workoutTime = workoutDate.getTime();
  if (Number.isNaN(workoutTime)) return false;
  const startDate = groupData?.startDate;
  if (startDate?.toMillis && workoutTime < startDate.toMillis()) return false;
  if (workoutTime > Date.now()) return false;
  return true;
}

const functions = getFunctions(app);

export async function ensureUserProfileDoc(params: { userId: string; email?: string }) {
  const ref = doc(db, "users", params.userId);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    await setDoc(
      ref,
      {
        email: params.email ?? "",
        displayName: "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  }
}

export async function createGroup(input: CreateGroupInput) {
  const call = httpsCallable<
    { name: string; type: GroupType; nickname: string },
    { groupId: string; inviteCode: string }
  >(functions, "createGroup");
  const result = await call({ name: input.name, type: input.type, nickname: input.ownerNickname });
  return result.data;
}

export async function joinGroupByInviteCode(params: { inviteCode: string; nickname: string }) {
  const call = httpsCallable<
    { inviteCode: string; nickname: string },
    { groupId: string; alreadyMember: boolean }
  >(functions, "joinGroup");
  const result = await call({ inviteCode: params.inviteCode, nickname: params.nickname });
  return result.data;
}

export async function leaveGroup(params: { groupId: string }) {
  const call = httpsCallable<{ groupId: string }, { groupId: string; left: boolean }>(functions, "leaveGroup");
  const result = await call({ groupId: params.groupId });
  return result.data;
}

export async function updateGroupSettings(params: { groupId: string; patch: GroupSettingsPatch }) {
  const ref = doc(db, "groups", params.groupId);
  await updateDoc(ref, {
    ...params.patch,
    updatedAt: serverTimestamp(),
  });
}

export async function createWorkout(params: {
  userId: string;
  groupId: string;
  activityTypes: string[];
  durationMinutes: number;
  date: Date;
  notes?: string;
}) {
  const performedAt = Timestamp.fromDate(params.date);
  const payload = {
    userId: params.userId,
    groupId: params.groupId,
    activityTypes: params.activityTypes,
    durationMinutes: Math.max(0, Math.floor(params.durationMinutes || 0)),
    date: performedAt,
    performedAt,
    notes: (params.notes ?? "").trim(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const ref = await addDoc(userWorkoutsCol(params.userId), payload);
  return { workoutId: ref.id, ...payload };
}

export async function postWorkoutMessageToGroup(params: {
  groupId: string;
  userId: string;
  workoutId: string;
  workoutDate: Timestamp;
  activityTypes: string[];
  durationMinutes: number;
  groupNote: string;
}) {
  await addDoc(messagesCol(params.groupId), {
    type: "workout",
    userId: params.userId,
    workoutId: params.workoutId,
    workoutDate: params.workoutDate,
    activityTypes: params.activityTypes,
    durationMinutes: params.durationMinutes,
    groupNote: params.groupNote ?? "",
    createdAt: serverTimestamp(),
  });
}

async function notifyGroupWorkoutMembers(params: {
  groupId: string;
  actorUserId: string;
  workoutId: string;
}) {
  try {
    const actorSnap = await getDoc(groupMemberDoc(params.groupId, params.actorUserId));
    const actorNickname = ((actorSnap.data() as any)?.nickname ?? "").trim();
    const actorName = actorNickname || "Someone";
    const message = `${actorName} logged a workout! Check out your group's progress, and cheer them on!`;

    const membersSnap = await getDocs(groupMembersCol(params.groupId));
    const memberIds = membersSnap.docs
      .map((member) => member.id)
      .filter((memberId) => memberId !== params.actorUserId);

    if (memberIds.length === 0) return;

    const batch = writeBatch(db);

    memberIds.forEach((memberId) => {
      const ref = doc(userNotificationsCol(memberId));
      batch.set(ref, {
        type: "group_workout",
        userId: memberId,
        actorUserId: params.actorUserId,
        actorName,
        groupId: params.groupId,
        workoutId: params.workoutId,
        message,
        read: false,
        createdAt: serverTimestamp(),
      });
    });

    await batch.commit();
  } catch (error) {
    console.warn("Notification fanout skipped:", error);
  }
}

export async function logWorkoutToAllGroups(params: {
  userId: string;
  activityTypes: string[];
  durationMinutes: number;
  date: Date;
  notes?: string;
}) {
  const w = await createWorkout({
    userId: params.userId,
    groupId: "all",
    activityTypes: params.activityTypes,
    durationMinutes: params.durationMinutes,
    date: params.date,
    notes: params.notes,
  });

  const groupsSnap = await getDocs(userGroupsCol(params.userId));
  const groupIds = groupsSnap.docs.map((d) => d.id);

  for (const groupId of groupIds) {
    const groupSnap = await getDoc(groupDoc(groupId));
    const shouldCount = shouldCountDuration(groupSnap.data(), params.date);
    const durationToAdd = shouldCount && w.durationMinutes > 0 ? w.durationMinutes : 0;

    await postWorkoutMessageToGroup({
      groupId,
      userId: params.userId,
      workoutId: w.workoutId,
      workoutDate: w.date,
      activityTypes: w.activityTypes,
      durationMinutes: w.durationMinutes,
      groupNote: params.notes ?? "",
    });

    await notifyGroupWorkoutMembers({
      groupId,
      actorUserId: params.userId,
      workoutId: w.workoutId,
    });

    const goalPatch: Record<string, any> = {
      completedWorkouts: increment(1),
      updatedAt: serverTimestamp(),
    };
    if (durationToAdd > 0) {
      goalPatch.totalDurationMinutes = increment(durationToAdd);
    }

    await setDoc(
      doc(db, "groups", groupId, "goals", params.userId),
      goalPatch,
      { merge: true }
    );
  }

  return { groupsCount: groupIds.length, workoutId: w.workoutId };
}

export async function logWorkoutFromGroupChat(params: {
  groupId: string;
  userId: string;
  activityTypes: string[];
  durationMinutes: number;
  date: Date;
  notes?: string;
  groupNote: string;
}) {
  const w = await createWorkout({
    userId: params.userId,
    groupId: params.groupId,
    activityTypes: params.activityTypes,
    durationMinutes: params.durationMinutes,
    date: params.date,
    notes: params.notes,
  });

  await postWorkoutMessageToGroup({
    groupId: params.groupId,
    userId: params.userId,
    workoutId: w.workoutId,
    workoutDate: w.date,
    activityTypes: params.activityTypes,
    durationMinutes: params.durationMinutes,
    groupNote: params.groupNote ?? params.notes ?? "",
  });

  await notifyGroupWorkoutMembers({
    groupId: params.groupId,
    actorUserId: params.userId,
    workoutId: w.workoutId,
  });

  const groupSnap = await getDoc(groupDoc(params.groupId));
  const shouldCount = shouldCountDuration(groupSnap.data(), params.date);
  const durationToAdd = shouldCount && w.durationMinutes > 0 ? w.durationMinutes : 0;
  const goalPatch: Record<string, any> = {
    completedWorkouts: increment(1),
    updatedAt: serverTimestamp(),
  };
  if (durationToAdd > 0) {
    goalPatch.totalDurationMinutes = increment(durationToAdd);
  }

  await setDoc(
    doc(db, "groups", params.groupId, "goals", params.userId),
    goalPatch,
    { merge: true }
  );

  return { workoutId: w.workoutId };
}
