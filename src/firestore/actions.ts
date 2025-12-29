import { addDoc, collection, getDocs, serverTimestamp } from "firebase/firestore";
import { db } from "../config/firebase";
import { WorkoutType } from "../types/models";
import { userGroupsCol, messagesCol } from "./paths";

export async function logWorkoutGlobally({
  userId,
  workoutType,
  notes,
}: {
  userId: string;
  workoutType: WorkoutType;
  notes?: string;
}) {
  // 1) Create a user workout record
  await addDoc(collection(db, "users", userId, "workouts"), {
    type: workoutType,
    notes: notes ?? "",
    createdAt: serverTimestamp(),
  });

  // 2) Fan out a "workout" message to every group the user belongs to
  const groupsSnap = await getDocs(userGroupsCol(userId));
  const groupIds = groupsSnap.docs.map((d) => d.id);

  // Fan-out writes (sequential for clarity; can be Promise.all later)
  for (const groupId of groupIds) {
    await addDoc(messagesCol(groupId), {
      type: "workout",
      userId,
      workoutType,
      text: notes ?? "",
      createdAt: serverTimestamp(),
    });
  }

  return { groupIdsCount: groupIds.length };
}
