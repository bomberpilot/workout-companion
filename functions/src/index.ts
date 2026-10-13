import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import { randomInt } from "node:crypto";

admin.initializeApp();

const db = admin.firestore();

const INVITE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const GROUP_TYPES = new Set(["friends", "family", "coworkers", "other"]);

function requireAuthenticatedUser(context: functions.https.CallableContext) {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Authentication required.");
  }
  return context.auth.uid;
}

function requireObject(data: unknown) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new functions.https.HttpsError("invalid-argument", "A request object is required.");
  }
  return data as Record<string, unknown>;
}

function requireTrimmedString(
  data: Record<string, unknown>,
  key: string,
  options: { min: number; max: number; label: string }
) {
  const value = typeof data[key] === "string" ? data[key].trim() : "";
  if (value.length < options.min || value.length > options.max) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      `${options.label} must be between ${options.min} and ${options.max} characters.`
    );
  }
  return value;
}

function makeInviteCode(length = 6) {
  let code = "";
  for (let index = 0; index < length; index += 1) {
    code += INVITE_ALPHABET[randomInt(INVITE_ALPHABET.length)];
  }
  return code;
}

function requireGroupId(data: Record<string, unknown>) {
  const groupId = typeof data.groupId === "string" ? data.groupId.trim() : "";
  if (!groupId || groupId.includes("/") || groupId.length > 1500) {
    throw new functions.https.HttpsError("invalid-argument", "A valid groupId is required.");
  }
  return groupId;
}

class InviteCollisionError extends Error {}

type WorkoutDoc = {
  userId?: string;
  groupId?: string;
  performedAt?: admin.firestore.Timestamp;
  date?: admin.firestore.Timestamp;
};

type GoalEntry = {
  id?: string;
  targetWorkouts?: number;
  completedWorkouts?: number;
  goalStartDateISO?: string | null;
  goalDateISO?: string | null;
  goalDateReason?: string | null;
};

type GoalDoc = {
  goalEntries?: GoalEntry[];
  goalStartDateISO?: string | null;
  goalDateISO?: string | null;
  completedWorkouts?: number;
};

function parseIsoDate(iso?: string | null) {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return { y, mo, d };
}

function isoRangeToTimestamps(startIso?: string | null, endIso?: string | null) {
  const start = parseIsoDate(startIso);
  const end = parseIsoDate(endIso);
  if (!start || !end) return null;
  const startDate = new Date(Date.UTC(start.y, start.mo - 1, start.d, 0, 0, 0, 0));
  const endDate = new Date(Date.UTC(end.y, end.mo - 1, end.d, 23, 59, 59, 999));
  return {
    start: admin.firestore.Timestamp.fromDate(startDate),
    end: admin.firestore.Timestamp.fromDate(endDate),
  };
}

function getWorkoutTimestamp(workout: WorkoutDoc) {
  return workout.performedAt ?? workout.date ?? null;
}

function countWorkoutsInRange(workouts: WorkoutDoc[], range: { start: admin.firestore.Timestamp; end: admin.firestore.Timestamp }) {
  return workouts.reduce((count, workout) => {
    const ts = getWorkoutTimestamp(workout);
    if (!ts) return count;
    if (ts.toMillis() < range.start.toMillis()) return count;
    if (ts.toMillis() > range.end.toMillis()) return count;
    return count + 1;
  }, 0);
}

async function listUserGroupIds(userId: string) {
  const snap = await db.collection("users").doc(userId).collection("groups").get();
  return snap.docs.map((doc) => doc.id);
}

async function fetchWorkoutsForGroup(userId: string, groupId: string) {
  const collectionRef = db.collection("users").doc(userId).collection("workouts");
  const q = collectionRef.where("groupId", "in", [groupId, "all"]);
  const snap = await q.get();
  return snap.docs.map((doc) => doc.data() as WorkoutDoc);
}

async function recomputeGoalProgressForGroup(userId: string, groupId: string) {
  functions.logger.info("Recompute goal progress start", { userId, groupId });
  const goalRef = db.collection("groups").doc(groupId).collection("goals").doc(userId);
  const goalSnap = await goalRef.get();
  if (!goalSnap.exists) {
    functions.logger.info("Goal document missing; skipping recompute", { userId, groupId });
    return;
  }

  const goalData = goalSnap.data() as GoalDoc;
  const workouts = await fetchWorkoutsForGroup(userId, groupId);

  if (Array.isArray(goalData.goalEntries) && goalData.goalEntries.length > 0) {
    const nextEntries = goalData.goalEntries.map((entry) => {
      const range = isoRangeToTimestamps(entry.goalStartDateISO ?? goalData.goalStartDateISO, entry.goalDateISO ?? goalData.goalDateISO);
      if (!range) {
        return { ...entry, completedWorkouts: 0 };
      }
      const completed = countWorkoutsInRange(workouts, range);
      return { ...entry, completedWorkouts: completed };
    });

    const nextRootCompleted = nextEntries[0]?.completedWorkouts ?? 0;

    const entriesChanged = goalData.goalEntries.some((entry, idx) =>
      (entry.completedWorkouts ?? 0) !== (nextEntries[idx]?.completedWorkouts ?? 0)
    );
    const rootChanged = (goalData.completedWorkouts ?? 0) !== nextRootCompleted;

    if (!entriesChanged && !rootChanged) {
      functions.logger.info("Goal progress unchanged; skipping write", { userId, groupId });
      return;
    }

    await goalRef.set(
      {
        goalEntries: nextEntries,
        completedWorkouts: nextRootCompleted,
      },
      { merge: true }
    );
    functions.logger.info("Goal progress updated", { userId, groupId, completedWorkouts: nextRootCompleted });
    return;
  }

  const range = isoRangeToTimestamps(goalData.goalStartDateISO, goalData.goalDateISO);
  const completed = range ? countWorkoutsInRange(workouts, range) : 0;
  if ((goalData.completedWorkouts ?? 0) === completed) {
    functions.logger.info("Goal progress unchanged; skipping write", { userId, groupId });
    return;
  }

  await goalRef.set({ completedWorkouts: completed }, { merge: true });
  functions.logger.info("Goal progress updated", { userId, groupId, completedWorkouts: completed });
}

async function recomputeForGroupIds(userId: string, groupIds: string[]) {
  await Promise.all(groupIds.map((groupId) => recomputeGoalProgressForGroup(userId, groupId)));
}

function extractGroupId(data: WorkoutDoc | undefined) {
  if (!data?.groupId) return null;
  return data.groupId;
}

async function resolveAffectedGroups(userId: string, groupId: string) {
  if (groupId === "all") {
    return listUserGroupIds(userId);
  }
  return [groupId];
}

export const createGroup = functions.https.onCall(async (rawData, context) => {
  const userId = requireAuthenticatedUser(context);
  const data = requireObject(rawData);
  const name = requireTrimmedString(data, "name", { min: 1, max: 80, label: "Group name" });
  const nickname = requireTrimmedString(data, "nickname", { min: 1, max: 40, label: "Nickname" });
  const type = typeof data.type === "string" ? data.type : "";
  if (!GROUP_TYPES.has(type)) {
    throw new functions.https.HttpsError("invalid-argument", "A valid group type is required.");
  }

  const groupRef = db.collection("groups").doc();
  const memberRef = groupRef.collection("members").doc(userId);
  const mirrorRef = db.collection("users").doc(userId).collection("groups").doc(groupRef.id);
  const startDate = admin.firestore.Timestamp.now();
  const endDate = admin.firestore.Timestamp.fromMillis(startDate.toMillis() + 30 * 24 * 60 * 60 * 1000);

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const inviteCode = makeInviteCode();
    const inviteRef = db.collection("groupInvites").doc(inviteCode);

    try {
      await db.runTransaction(async (transaction) => {
        const inviteSnap = await transaction.get(inviteRef);
        if (inviteSnap.exists) throw new InviteCollisionError();

        const now = admin.firestore.FieldValue.serverTimestamp();
        transaction.create(groupRef, {
          name,
          type,
          inviteCode,
          createdBy: userId,
          createdAt: now,
          updatedAt: now,
          goalType: "frequency",
          targetValue: 12,
          startDate,
          endDate,
        });
        transaction.create(inviteRef, {
          groupId: groupRef.id,
          createdBy: userId,
          createdAt: now,
        });
        transaction.create(memberRef, {
          userId,
          role: "owner",
          nickname,
          joinDate: now,
          updatedAt: now,
        });
        transaction.create(mirrorRef, {
          role: "owner",
          nickname,
          joinedAt: now,
          updatedAt: now,
        });
      });

      return { groupId: groupRef.id, inviteCode };
    } catch (error) {
      if (error instanceof InviteCollisionError) continue;
      throw error;
    }
  }

  throw new functions.https.HttpsError("resource-exhausted", "Unable to allocate an invite code. Try again.");
});

export const joinGroup = functions.https.onCall(async (rawData, context) => {
  const userId = requireAuthenticatedUser(context);
  const data = requireObject(rawData);
  const inviteCode = requireTrimmedString(data, "inviteCode", {
    min: 6,
    max: 6,
    label: "Invite code",
  }).toUpperCase();
  const nickname = requireTrimmedString(data, "nickname", { min: 1, max: 40, label: "Nickname" });

  if (!/^[A-HJ-NP-Z2-9]{6}$/.test(inviteCode)) {
    throw new functions.https.HttpsError("invalid-argument", "Invite code is invalid.");
  }

  const inviteRef = db.collection("groupInvites").doc(inviteCode);
  const inviteSnap = await inviteRef.get();
  let groupId = inviteSnap.exists ? String(inviteSnap.get("groupId") ?? "") : "";

  if (!groupId) {
    const legacyGroups = await db.collection("groups").where("inviteCode", "==", inviteCode).limit(2).get();
    if (legacyGroups.empty) {
      throw new functions.https.HttpsError("not-found", "No group matches that invite code.");
    }
    if (legacyGroups.size > 1) {
      throw new functions.https.HttpsError("failed-precondition", "This invite code is ambiguous.");
    }
    groupId = legacyGroups.docs[0].id;
  }

  const groupRef = db.collection("groups").doc(groupId);
  const memberRef = groupRef.collection("members").doc(userId);
  const mirrorRef = db.collection("users").doc(userId).collection("groups").doc(groupId);

  const alreadyMember = await db.runTransaction(async (transaction) => {
    const [groupSnap, memberSnap, mirrorSnap, currentInviteSnap] = await Promise.all([
      transaction.get(groupRef),
      transaction.get(memberRef),
      transaction.get(mirrorRef),
      transaction.get(inviteRef),
    ]);

    if (!groupSnap.exists || groupSnap.get("inviteCode") !== inviteCode) {
      throw new functions.https.HttpsError("not-found", "No group matches that invite code.");
    }
    if (currentInviteSnap.exists && currentInviteSnap.get("groupId") !== groupId) {
      throw new functions.https.HttpsError("failed-precondition", "This invite code is ambiguous.");
    }

    const now = admin.firestore.FieldValue.serverTimestamp();
    const storedRole = memberSnap.exists ? String(memberSnap.get("role") ?? "member") : "member";
    const existingRole = ["owner", "admin", "member"].includes(storedRole) ? storedRole : "member";
    const joinedAt = memberSnap.exists ? memberSnap.get("joinDate") ?? now : now;

    if (!currentInviteSnap.exists) {
      transaction.create(inviteRef, {
        groupId,
        createdBy: groupSnap.get("createdBy"),
        createdAt: groupSnap.get("createdAt") ?? now,
      });
    }

    transaction.set(
      memberRef,
      { userId, role: existingRole, nickname, joinDate: joinedAt, updatedAt: now },
      { merge: true }
    );
    transaction.set(
      mirrorRef,
      {
        role: existingRole,
        nickname,
        joinedAt: mirrorSnap.exists ? mirrorSnap.get("joinedAt") ?? joinedAt : joinedAt,
        updatedAt: now,
      },
      { merge: true }
    );

    return memberSnap.exists;
  });

  return { groupId, alreadyMember };
});

export const leaveGroup = functions.https.onCall(async (rawData, context) => {
  const userId = requireAuthenticatedUser(context);
  const data = requireObject(rawData);
  const groupId = requireGroupId(data);
  const groupRef = db.collection("groups").doc(groupId);
  const memberRef = groupRef.collection("members").doc(userId);
  const mirrorRef = db.collection("users").doc(userId).collection("groups").doc(groupId);
  const goalRef = groupRef.collection("goals").doc(userId);

  const left = await db.runTransaction(async (transaction) => {
    const [groupSnap, memberSnap] = await Promise.all([
      transaction.get(groupRef),
      transaction.get(memberRef),
    ]);
    if (!groupSnap.exists) {
      throw new functions.https.HttpsError("not-found", "Group not found.");
    }
    const memberRole = memberSnap.exists ? memberSnap.get("role") : undefined;
    if (groupSnap.get("createdBy") === userId || memberRole === "owner") {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "The group owner must transfer ownership or delete the group before leaving."
      );
    }

    transaction.delete(memberRef);
    transaction.delete(mirrorRef);
    transaction.delete(goalRef);
    return memberSnap.exists;
  });

  return { groupId, left };
});

export const onWorkoutWrite = functions.firestore
  .document("users/{userId}/workouts/{workoutId}")
  .onWrite(async (change, context) => {
    const userId = context.params.userId as string;
    const beforeData = change.before.exists ? (change.before.data() as WorkoutDoc) : undefined;
    const afterData = change.after.exists ? (change.after.data() as WorkoutDoc) : undefined;

    const beforeGroupId = extractGroupId(beforeData);
    const afterGroupId = extractGroupId(afterData);

    const affectedGroupIds = new Set<string>();

    if (beforeGroupId) {
      const groups = await resolveAffectedGroups(userId, beforeGroupId);
      groups.forEach((gid) => affectedGroupIds.add(gid));
    }

    if (afterGroupId) {
      const groups = await resolveAffectedGroups(userId, afterGroupId);
      groups.forEach((gid) => affectedGroupIds.add(gid));
    }

    if (affectedGroupIds.size === 0) {
      functions.logger.info("Workout write has no groupId; skipping recompute", { userId });
      return;
    }

    await recomputeForGroupIds(userId, Array.from(affectedGroupIds));
  });

export const onGoalWrite = functions.firestore
  .document("groups/{groupId}/goals/{userId}")
  .onWrite(async (_change, context) => {
    const userId = context.params.userId as string;
    const groupId = context.params.groupId as string;

    await recomputeGoalProgressForGroup(userId, groupId);
  });

export const recomputeGoalProgress = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Authentication required.");
  }

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new functions.https.HttpsError("invalid-argument", "A groupId is required.");
  }

  // Keep the existing optional userId argument, but never trust it as authority.
  const userId = context.auth.uid;
  if (data.userId !== undefined && data.userId !== userId) {
    throw new functions.https.HttpsError("permission-denied", "You can only recompute your own progress.");
  }

  const groupId = typeof data.groupId === "string" ? data.groupId.trim() : "";
  if (!groupId || groupId.includes("/") || groupId.length > 1500) {
    throw new functions.https.HttpsError("invalid-argument", "A valid groupId is required.");
  }

  // Admin SDK reads bypass Firestore rules, so this boundary must authorize access.
  const membership = await db.collection("groups").doc(groupId).collection("members").doc(userId).get();
  if (!membership.exists) {
    throw new functions.https.HttpsError("permission-denied", "Group membership is required.");
  }

  functions.logger.info("Manual recompute requested", { userId, groupId });
  await recomputeGoalProgressForGroup(userId, groupId);
  return { ok: true };
});
