const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { after, before, beforeEach, test } = require("node:test");
const {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} = require("@firebase/rules-unit-testing");
const {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} = require("firebase/firestore");

const projectId = "demo-workout-companion";
let testEnv;

function authedDb(uid) {
  return testEnv.authenticatedContext(uid, { email: uid + "@example.test" }).firestore();
}

function validWorkout(userId, groupId = "group-a") {
  return {
    userId,
    groupId,
    activityTypes: ["Cardio"],
    durationMinutes: 30,
    date: Timestamp.fromDate(new Date("2026-10-10T12:00:00Z")),
    performedAt: Timestamp.fromDate(new Date("2026-10-10T12:00:00Z")),
    notes: "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

function validNotification(recipientId) {
  return {
    type: "group_workout",
    userId: recipientId,
    actorUserId: "alice",
    actorName: "Alice",
    groupId: "group-a",
    workoutId: "workout-a",
    message: "Alice logged a workout.",
    read: false,
    createdAt: serverTimestamp(),
  };
}

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId,
    firestore: {
      rules: readFileSync(path.join(__dirname, "../firestore.rules"), "utf8"),
    },
  });
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    const now = Timestamp.fromDate(new Date("2026-10-10T12:00:00Z"));
    await Promise.all([
      setDoc(doc(db, "users/alice"), {
        email: "alice@example.test",
        displayName: "Alice",
        createdAt: now,
        updatedAt: now,
      }),
      setDoc(doc(db, "users/bob"), {
        email: "bob@example.test",
        displayName: "Bob",
        createdAt: now,
        updatedAt: now,
      }),
      setDoc(doc(db, "users/outsider"), {
        email: "outsider@example.test",
        displayName: "Outsider",
        createdAt: now,
        updatedAt: now,
      }),
      setDoc(doc(db, "groups/group-a"), {
        name: "Accountability",
        type: "friends",
        inviteCode: "ABC234",
        createdBy: "alice",
        createdAt: now,
        updatedAt: now,
      }),
      setDoc(doc(db, "groups/group-a/members/alice"), {
        userId: "alice",
        role: "owner",
        nickname: "Ace",
        joinDate: now,
        updatedAt: now,
      }),
      setDoc(doc(db, "groups/group-a/members/bob"), {
        userId: "bob",
        role: "member",
        nickname: "B",
        joinDate: now,
        updatedAt: now,
      }),
      setDoc(doc(db, "users/alice/groups/group-a"), {
        role: "owner",
        nickname: "Ace",
        joinedAt: now,
        updatedAt: now,
      }),
      setDoc(doc(db, "users/bob/groups/group-a"), {
        role: "member",
        nickname: "B",
        joinedAt: now,
        updatedAt: now,
      }),
      setDoc(doc(db, "groups/group-a/goals/alice"), {
        displayName: "Alice",
        targetWorkouts: 3,
        completedWorkouts: 1,
        updatedAt: now,
      }),
      setDoc(doc(db, "groups/group-a/messages/message-a"), {
        type: "text",
        userId: "alice",
        text: "Hello",
        createdAt: now,
      }),
      setDoc(doc(db, "users/alice/workouts/workout-a"), {
        ...validWorkout("alice"),
        createdAt: now,
        updatedAt: now,
      }),
    ]);
  });
});

after(async () => {
  await testEnv.cleanup();
});

test("private profiles and canonical workouts are owner-only", async () => {
  const alice = authedDb("alice");
  const bob = authedDb("bob");
  await assertSucceeds(getDoc(doc(alice, "users/alice")));
  await assertFails(getDoc(doc(bob, "users/alice")));
  await assertSucceeds(getDoc(doc(alice, "users/alice/workouts/workout-a")));
  await assertFails(getDoc(doc(bob, "users/alice/workouts/workout-a")));
});

test("group reads require membership and member queries remain usable", async () => {
  const bob = authedDb("bob");
  const outsider = authedDb("outsider");
  await assertSucceeds(getDoc(doc(bob, "groups/group-a")));
  await assertSucceeds(getDocs(collection(bob, "groups/group-a/members")));
  await assertSucceeds(
    getDocs(query(collection(bob, "groups/group-a/messages"), orderBy("createdAt", "desc")))
  );
  await assertSucceeds(getDocs(collection(bob, "groups/group-a/goals")));
  await assertFails(getDoc(doc(outsider, "groups/group-a")));
  await assertFails(getDocs(collection(outsider, "groups/group-a/messages")));
});

test("clients cannot create groups, invite reservations, memberships, or mirrors", async () => {
  const outsider = authedDb("outsider");
  const now = serverTimestamp();
  await assertFails(setDoc(doc(outsider, "groups/forged"), {
    name: "Forged",
    type: "friends",
    inviteCode: "ZZZ999",
    createdBy: "outsider",
    createdAt: now,
    updatedAt: now,
  }));
  await assertFails(setDoc(doc(outsider, "groupInvites/ZZZ999"), { groupId: "forged" }));
  await assertFails(setDoc(doc(outsider, "groups/group-a/members/outsider"), {
    userId: "outsider",
    role: "owner",
    nickname: "Forged owner",
    joinDate: now,
  }));
  await assertFails(setDoc(doc(outsider, "users/outsider/groups/group-a"), {
    role: "owner",
    nickname: "Forged owner",
    joinedAt: now,
  }));
});

test("members may update only their own nickname without changing roles", async () => {
  const bob = authedDb("bob");
  await assertSucceeds(updateDoc(doc(bob, "groups/group-a/members/bob"), {
    nickname: "Builder",
    updatedAt: serverTimestamp(),
  }));
  await assertFails(updateDoc(doc(bob, "groups/group-a/members/bob"), {
    role: "owner",
    updatedAt: serverTimestamp(),
  }));
  await assertFails(updateDoc(doc(bob, "groups/group-a/members/alice"), {
    nickname: "Taken over",
    updatedAt: serverTimestamp(),
  }));
});

test("messages enforce membership, author identity, schema, and immutability", async () => {
  const bob = authedDb("bob");
  const outsider = authedDb("outsider");
  await assertSucceeds(setDoc(doc(bob, "groups/group-a/messages/message-b"), {
    type: "text",
    userId: "bob",
    text: "I showed up.",
    createdAt: serverTimestamp(),
  }));
  await assertSucceeds(setDoc(doc(authedDb("alice"), "groups/group-a/messages/workout-a"), {
    type: "workout",
    userId: "alice",
    workoutId: "workout-a",
    workoutDate: Timestamp.fromDate(new Date("2026-10-10T12:00:00Z")),
    activityTypes: ["Cardio"],
    durationMinutes: 30,
    groupNote: "Done",
    createdAt: serverTimestamp(),
  }));
  await assertFails(setDoc(doc(bob, "groups/group-a/messages/fake-workout"), {
    type: "workout",
    userId: "bob",
    workoutId: "missing",
    workoutDate: Timestamp.fromDate(new Date("2026-10-10T12:00:00Z")),
    activityTypes: ["Cardio"],
    durationMinutes: 30,
    groupNote: "Not real",
    createdAt: serverTimestamp(),
  }));
  await assertFails(setDoc(doc(authedDb("alice"), "groups/group-a/messages/mismatched-workout"), {
    type: "workout",
    userId: "alice",
    workoutId: "workout-a",
    workoutDate: Timestamp.fromDate(new Date("2026-10-10T12:00:00Z")),
    activityTypes: ["Strength"],
    durationMinutes: 30,
    groupNote: "Changed details",
    createdAt: serverTimestamp(),
  }));
  await assertFails(setDoc(doc(bob, "groups/group-a/messages/spoofed"), {
    type: "text",
    userId: "alice",
    text: "Not Alice",
    createdAt: serverTimestamp(),
  }));
  await assertFails(setDoc(doc(bob, "groups/group-a/messages/oversized"), {
    type: "text",
    userId: "bob",
    text: "x".repeat(2001),
    createdAt: serverTimestamp(),
  }));
  await assertFails(updateDoc(doc(bob, "groups/group-a/messages/message-a"), {
    userId: "bob",
    text: "Taken over",
  }));
  await assertFails(deleteDoc(doc(bob, "groups/group-a/messages/message-a")));
  await assertFails(setDoc(doc(outsider, "groups/group-a/messages/outsider"), {
    type: "text",
    userId: "outsider",
    text: "Let me in",
    createdAt: serverTimestamp(),
  }));
});

test("workout validation prevents ownership changes, schema pollution, and invalid ranges", async () => {
  const alice = authedDb("alice");
  const bob = authedDb("bob");
  await assertSucceeds(setDoc(doc(alice, "users/alice/workouts/workout-b"), validWorkout("alice")));
  await assertFails(setDoc(doc(alice, "users/alice/workouts/polluted"), {
    ...validWorkout("alice"),
    extraData: "unexpected",
  }));
  await assertFails(setDoc(doc(alice, "users/alice/workouts/negative"), {
    ...validWorkout("alice"),
    durationMinutes: -1,
  }));
  await assertFails(setDoc(doc(alice, "users/alice/workouts/unknown-activity"), {
    ...validWorkout("alice"),
    activityTypes: ["Definitely not a workout category"],
  }));
  await assertFails(setDoc(doc(bob, "users/alice/workouts/workout-b"), validWorkout("bob")));
  await assertFails(updateDoc(doc(alice, "users/alice/workouts/workout-a"), {
    userId: "bob",
    updatedAt: serverTimestamp(),
  }));
  await assertSucceeds(
    getDocs(query(collection(alice, "users/alice/workouts"), orderBy("createdAt", "desc"), limit(40)))
  );
});

test("notification fan-out is limited to real members in the actor's group", async () => {
  const alice = authedDb("alice");
  await assertSucceeds(
    setDoc(doc(alice, "users/bob/notifications/notification-a"), validNotification("bob"))
  );
  await assertFails(
    setDoc(doc(alice, "users/outsider/notifications/notification-b"), validNotification("outsider"))
  );
  await assertFails(setDoc(doc(alice, "users/bob/notifications/notification-c"), {
    ...validNotification("bob"),
    userId: "outsider",
  }));
  await assertFails(setDoc(doc(alice, "users/bob/notifications/notification-d"), {
    ...validNotification("bob"),
    workoutId: "missing",
  }));
});

test("unknown collections and unauthenticated reads are denied by default", async () => {
  const alice = authedDb("alice");
  const anonymous = testEnv.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(alice, "admin/config")));
  await assertFails(getDoc(doc(anonymous, "groups/group-a")));
});

test("goal writes require both document ownership and active membership", async () => {
  const bob = authedDb("bob");
  const outsider = authedDb("outsider");
  await assertSucceeds(setDoc(doc(bob, "groups/group-a/goals/bob"), {
    displayName: "Bob",
    targetWorkouts: 4,
    completedWorkouts: 0,
    goalEntries: [],
    updatedAt: serverTimestamp(),
  }));
  await assertFails(updateDoc(doc(bob, "groups/group-a/goals/alice"), {
    targetWorkouts: 999,
    updatedAt: serverTimestamp(),
  }));
  await assertFails(setDoc(doc(outsider, "groups/group-a/goals/outsider"), {
    displayName: "Outsider",
    targetWorkouts: 4,
    updatedAt: serverTimestamp(),
  }));
});

test("profile validators run on create and update", async () => {
  const charlie = authedDb("charlie");
  await assertSucceeds(setDoc(doc(charlie, "users/charlie"), {
    email: "charlie@example.test",
    displayName: "Charlie",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }));
  await assertFails(updateDoc(doc(charlie, "users/charlie"), {
    email: "attacker@example.test",
    updatedAt: serverTimestamp(),
  }));
  await assertFails(updateDoc(doc(charlie, "users/charlie"), {
    displayName: "x".repeat(81),
    updatedAt: serverTimestamp(),
  }));
  const snap = await assertSucceeds(getDoc(doc(charlie, "users/charlie")));
  assert.equal(snap.data().email, "charlie@example.test");
});
