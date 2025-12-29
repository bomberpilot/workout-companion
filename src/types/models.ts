export type WorkoutType = "cardio" | "strength" | "flexibility" | "sport" | "other";

export type ChatMessage =
  | {
      type: "text";
      userId: string;
      text: string;
      createdAt: any;
    }
  | {
      type: "workout";
      userId: string;
      workoutType: WorkoutType;
      text?: string; // notes
      createdAt: any;
    };

export type GroupGoal = {
  displayName?: string;
  targetWorkouts?: number;
  goalDateISO?: string; // "YYYY-MM-DD"
  completedWorkouts?: number; // per-group counter incremented on global logs
  createdAt?: any;
  updatedAt?: any;
};

export type UserWorkout = {
  type: WorkoutType;
  notes?: string | null;
  createdAt?: any;
};
