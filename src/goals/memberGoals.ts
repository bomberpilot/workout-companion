export type MemberGoal = {
  id: string;
  targetWorkouts: number;
  completedWorkouts: number;
  goalStartDateISO?: string;
  goalDateISO?: string;
  goalDateReason?: string;
};

export type GoalWorkout = {
  groupId?: string;
  performedAt?: unknown;
  date?: unknown;
  createdAt?: unknown;
};

function nonnegativeNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

function optionalText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

/** A goal document belongs to one member in one group. Older documents have root fields. */
export function readMemberGoals(value: unknown, fallbackId = "goal"): MemberGoal[] {
  if (!value) return [];
  const document = asRecord(value);
  const entries = Array.isArray(document.goalEntries) ? document.goalEntries : [document];
  return entries.map((raw, index) => {
    const entry = asRecord(raw);
    return {
      id: optionalText(entry.id) ?? `${fallbackId}-${index}`,
      targetWorkouts: nonnegativeNumber(entry.targetWorkouts ?? entry.targetValue),
      completedWorkouts: nonnegativeNumber(entry.completedWorkouts),
      goalStartDateISO: optionalText(entry.goalStartDateISO ?? document.goalStartDateISO),
      goalDateISO: optionalText(entry.goalDateISO ?? document.goalDateISO),
      goalDateReason: optionalText(entry.goalDateReason),
    };
  }).filter((goal) => goal.targetWorkouts > 0);
}

function utcDayStart(value?: string): number | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
    ? parsed.getTime()
    : null;
}

function millis(value: unknown): number | null {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (value && typeof value === "object") {
    const timestamp = value as { toMillis?: () => number; toDate?: () => Date };
    if (typeof timestamp.toMillis === "function") return timestamp.toMillis();
    if (typeof timestamp.toDate === "function") return timestamp.toDate().getTime();
  }
  return null;
}

/** Count canonical workouts visible in this group and inside this goal's inclusive UTC dates. */
export function countGoalWorkouts(goal: MemberGoal, groupId: string, workouts: GoalWorkout[]): number {
  const start = utcDayStart(goal.goalStartDateISO);
  const end = utcDayStart(goal.goalDateISO);
  if (start === null || end === null || end < start) return goal.completedWorkouts;
  return workouts.reduce((count, workout) => {
    if (workout.groupId !== groupId && workout.groupId !== "all") return count;
    const when = millis(workout.performedAt ?? workout.date ?? workout.createdAt);
    return when !== null && when >= start && when < end + 86400000 ? count + 1 : count;
  }, 0);
}
