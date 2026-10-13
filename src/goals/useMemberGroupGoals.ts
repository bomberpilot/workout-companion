import { useEffect, useMemo, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";

import { db } from "../config/firebase";
import { groupDoc, userGroupsCol, userWorkoutsCol } from "../firestore/paths";
import { countGoalWorkouts, readMemberGoals, type GoalWorkout, type MemberGoal } from "./memberGoals";

export type MemberGroupGoal = MemberGoal & { completed: number };
export type MemberGroup = {
  groupId: string;
  groupName: string;
  inviteCode?: string;
  goals: MemberGroupGoal[];
};

type GroupData = Omit<MemberGroup, "goals"> & { goals: MemberGoal[] };

export function useMemberGroupGoals(userId?: string) {
  const [groupsById, setGroupsById] = useState<Record<string, GroupData>>({});
  const [workouts, setWorkouts] = useState<GoalWorkout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;

    let childUnsubs: (() => void)[] = [];
    const clearChildren = () => {
      childUnsubs.forEach((unsubscribe) => unsubscribe());
      childUnsubs = [];
    };
    const unsubscribeGroups = onSnapshot(userGroupsCol(userId), (snapshot) => {
      clearChildren();
      const ids = snapshot.docs.map((item) => item.id);
      setGroupsById((previous) => Object.fromEntries(ids.map((id) => [id, previous[id] ?? {
        groupId: id, groupName: "Group", goals: [],
      }])));
      setLoading(false);
      setError(null);
      ids.forEach((groupId) => {
        childUnsubs.push(onSnapshot(groupDoc(groupId), (groupSnapshot) => {
          const data = groupSnapshot.data();
          setGroupsById((previous) => ({ ...previous, [groupId]: {
            ...(previous[groupId] ?? { groupId, goals: [] }),
            groupName: typeof data?.name === "string" ? data.name : "Group",
            inviteCode: typeof data?.inviteCode === "string" ? data.inviteCode : undefined,
          } }));
        }, (failure) => setError(failure.message)));
        childUnsubs.push(onSnapshot(doc(db, "groups", groupId, "goals", userId), (goalSnapshot) => {
          setGroupsById((previous) => ({ ...previous, [groupId]: {
            ...(previous[groupId] ?? { groupId, groupName: "Group" }),
            goals: readMemberGoals(goalSnapshot.data(), goalSnapshot.id),
          } }));
        }, (failure) => setError(failure.message)));
      });
    }, (failure) => { setLoading(false); setError(failure.message); });
    const unsubscribeWorkouts = onSnapshot(userWorkoutsCol(userId), (snapshot) => {
      setWorkouts(snapshot.docs.map((item) => item.data() as GoalWorkout));
    }, (failure) => setError(failure.message));
    return () => { unsubscribeGroups(); unsubscribeWorkouts(); clearChildren(); };
  }, [userId]);

  const groups = useMemo(() => Object.values(groupsById).map((group) => ({
    ...group,
    goals: group.goals.map((goal) => ({
      ...goal,
      completed: countGoalWorkouts(goal, group.groupId, workouts),
    })),
  })).sort((a, b) => a.groupName.localeCompare(b.groupName)), [groupsById, workouts]);

  return { groups, loading, error };
}
