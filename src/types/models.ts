export type WorkoutType = "cardio" | "strength" | "flexibility" | "sport" | "other";

export type Message =
  | {
      type: "text";
      userId: string;
      text: string;
      createdAt: any;
    }
  | {
      type: "workout_log";
      userId: string;
      workoutId: string;
      workoutType: WorkoutType;
      notesPreview?: string | null;
      createdAt: any;
    };

export type Goal = {
  goalDate?: any;
  targetWorkouts?: number;
  createdAt?: any;
  updatedAt?: any;
};

export type UserWorkout = {
  userId: string;
  type: WorkoutType;
  notes?: string | null;
  performedAt?: any;
  createdAt?: any;
};
