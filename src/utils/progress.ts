// src/utils/progress.ts

import type { Workout, GroupGoalType } from "../types/models";
import type { Timestamp } from "firebase/firestore";

export function timestampToMillis(ts?: Timestamp): number {
  if (!ts) return 0;
  return ts.toMillis();
}

export function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

export function isWorkoutInWindow(workout: Workout, start: Timestamp, end: Timestamp) {
  const t = workout.date.toMillis();
  return t >= start.toMillis() && t <= end.toMillis();
}

/**
 * Calculates "completed" and "pct" for a user's workouts inside a group's date window.
 * - goalType="frequency": completed = count of workouts
 * - goalType="duration":  completed = sum(durationMinutes)
 */
export function calculateGroupProgress(params: {
  goalType: GroupGoalType;
  targetValue: number;
  startDate: Timestamp;
  endDate: Timestamp;
  workouts: Workout[];
}) {
  const { goalType, targetValue, startDate, endDate, workouts } = params;

  const filtered = workouts.filter((w) => isWorkoutInWindow(w, startDate, endDate));

  let completed = 0;
  if (goalType === "frequency") {
    completed = filtered.length;
  } else {
    completed = filtered.reduce((sum, w) => sum + (Number(w.durationMinutes) || 0), 0);
  }

  const target = Math.max(0, Number(targetValue) || 0);
  const pct = target > 0 ? clamp01(completed / target) : 0;

  return { completed, target, pct, filteredCount: filtered.length };
}

export function formatDurationMinutes(totalMinutes: number) {
  const m = Math.max(0, Math.floor(totalMinutes || 0));
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (h <= 0) return `${rem}m`;
  if (rem <= 0) return `${h}h`;
  return `${h}h ${rem}m`;
}
