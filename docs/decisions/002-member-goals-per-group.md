# Decision 002: personal goals belong to a group membership

Status: accepted for the MVP.

Each person can set one or more workout commitments in each group they join. The goal document lives at `groups/{groupId}/goals/{userId}` and contains ordered `goalEntries`. Other members of that group may see those commitments and the member's group activity. A person's goals in another group are not copied or shown there. The owner's profile may aggregate their own goals across groups.

The group document represents membership, conversation and invitation metadata. New groups no longer receive an implicit 12-workout target. A future explicit group-wide goal can be added if it helps the accountability loop, but it must not replace personal goals.

Workouts remain canonical records at `users/{userId}/workouts/{workoutId}`. A workout with `groupId: "all"` counts toward applicable goals in every group of which its owner is a member; a workout with a specific group ID counts only there. A goal counts workouts whose completion timestamp falls within its inclusive start and end dates. The server recomputes stored progress for other members to read, while the owner's views also calculate progress from canonical workouts so they update as soon as logging succeeds.

Group progress presents members by name and shows each person's goals without ranking people by completion percentage. Group membership is the authorization boundary for reading another member's goals and activity. Security rules and deployed Cloud Functions must continue to enforce that boundary; this UI change does not substitute for backend verification.
