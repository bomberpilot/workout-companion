import { addDoc, collection, doc, getDocs, serverTimestamp, updateDoc, increment, setDoc } from "firebase/firestore";
import { db } from "../config/firebase";
import { WorkoutType } from "../types/models";
import { userGroupsCol, messagesCol, goalDoc } from "./paths";

export async function logWorkoutGlobally({
  userId,
  workoutType,
  notes,
}: {
  userId: string;
  workoutType: WorkoutType;
  notes?: string;
}) {
  // 1) Create a user workout record (your own history)
  await addDoc(collection(db, "users", userId, "workouts"), {
    type: workoutType,
    notes: notes ?? "",
    createdAt: serverTimestamp(),
  });

  // 2) Fan out a workout message to each group + increment progress for that group
  const groupsSnap = await getDocs(userGroupsCol(userId));
  const groupIds = groupsSnap.docs.map((d) => d.id);

  for (const groupId of groupIds) {
    // message into chat
    await addDoc(messagesCol(groupId), {
      type: "workout",
      userId,
      workoutType,
      text: notes ?? "",
      createdAt: serverTimestamp(),
    });

    // increment progress in the user's goal doc for this group
    const gRef = goalDoc(groupId, userId);

    // If the goal doc does not exist yet, create a minimal one so increment works later
    await setDoc(
      gRef,
      {
        completedWorkouts: increment(1),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    // (setDoc+increment is sufficient; updateDoc not necessary)
  }

  return { groupIdsCount: groupIds.length };
}