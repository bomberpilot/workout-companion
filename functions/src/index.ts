import * as admin from "firebase-admin";
import * as functions from "firebase-functions";

admin.initializeApp();

const db = admin.firestore();

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

  const userId = typeof data?.userId === "string" ? data.userId : context.auth.uid;
  const groupId = typeof data?.groupId === "string" ? data.groupId : "";
  if (!groupId) {
    throw new functions.https.HttpsError("invalid-argument", "groupId is required.");
  }

  functions.logger.info("Manual recompute requested", { requestedBy: context.auth.uid, userId, groupId });
  await recomputeGoalProgressForGroup(userId, groupId);
  return { ok: true };
});
