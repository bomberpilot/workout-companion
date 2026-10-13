const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { after, before, beforeEach, test } = require("node:test");
const { initializeTestEnvironment } = require("@firebase/rules-unit-testing");

process.env.GCLOUD_PROJECT = "demo-workout-companion";

const admin = require("../functions/node_modules/firebase-admin");
const groupFunctions = require("../functions/lib/index.js");

let testEnv;

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: process.env.GCLOUD_PROJECT,
    firestore: {
      rules: readFileSync(path.join(__dirname, "../firestore.rules"), "utf8"),
    },
  });
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

after(async () => {
  await testEnv.cleanup();
  await Promise.all(admin.apps.map((app) => app.delete()));
});

function context(uid) {
  return { auth: uid ? { uid, token: { email: uid + "@example.test" } } : undefined };
}

test("createGroup atomically creates the group, owner membership, mirror, and invite", async () => {
  const result = await groupFunctions.createGroup.run(
    { name: "Morning crew", type: "friends", nickname: "Ace" },
    context("alice")
  );
  assert.match(result.groupId, /^[^/]+$/);
  assert.match(result.inviteCode, /^[A-HJ-NP-Z2-9]{6}$/);

  const db = admin.firestore();
  const [group, member, mirror, invite] = await Promise.all([
    db.doc("groups/" + result.groupId).get(),
    db.doc("groups/" + result.groupId + "/members/alice").get(),
    db.doc("users/alice/groups/" + result.groupId).get(),
    db.doc("groupInvites/" + result.inviteCode).get(),
  ]);
  assert.equal(group.get("createdBy"), "alice");
  assert.equal(group.get("goalType"), "frequency");
  assert.equal(group.get("targetValue"), 12);
  assert.equal(group.get("startDate") instanceof admin.firestore.Timestamp, true);
  assert.equal(group.get("endDate") instanceof admin.firestore.Timestamp, true);
  assert.equal(member.get("role"), "owner");
  assert.equal(mirror.get("role"), "owner");
  assert.equal(invite.get("groupId"), result.groupId);
});

test("joinGroup uses the reservation and preserves an existing owner's role", async () => {
  const created = await groupFunctions.createGroup.run(
    { name: "Morning crew", type: "friends", nickname: "Ace" },
    context("alice")
  );

  const joined = await groupFunctions.joinGroup.run(
    { inviteCode: created.inviteCode.toLowerCase(), nickname: "Builder" },
    context("bob")
  );
  assert.equal(joined.groupId, created.groupId);
  assert.equal(joined.alreadyMember, false);

  const ownerRejoin = await groupFunctions.joinGroup.run(
    { inviteCode: created.inviteCode, nickname: "Captain" },
    context("alice")
  );
  assert.equal(ownerRejoin.alreadyMember, true);

  const db = admin.firestore();
  const [bobMember, bobMirror, ownerMember] = await Promise.all([
    db.doc("groups/" + created.groupId + "/members/bob").get(),
    db.doc("users/bob/groups/" + created.groupId).get(),
    db.doc("groups/" + created.groupId + "/members/alice").get(),
  ]);
  assert.equal(bobMember.get("role"), "member");
  assert.equal(bobMirror.get("role"), "member");
  assert.equal(ownerMember.get("role"), "owner");
  assert.equal(ownerMember.get("nickname"), "Captain");
});

test("joinGroup repairs legacy groups while rejecting missing and ambiguous codes", async () => {
  const db = admin.firestore();
  const now = admin.firestore.Timestamp.now();
  await db.doc("groups/legacy").set({
    name: "Legacy",
    type: "friends",
    inviteCode: "LEG234",
    createdBy: "alice",
    createdAt: now,
    updatedAt: now,
  });
  const joined = await groupFunctions.joinGroup.run(
    { inviteCode: "LEG234", nickname: "Builder" },
    context("bob")
  );
  assert.equal(joined.groupId, "legacy");
  assert.equal((await db.doc("groupInvites/LEG234").get()).get("groupId"), "legacy");

  await assert.rejects(
    groupFunctions.joinGroup.run({ inviteCode: "ZZZ999", nickname: "Builder" }, context("bob")),
    (error) => error.code === "not-found"
  );
});

test("leaveGroup removes a member mirror and goal but prevents owner abandonment", async () => {
  const created = await groupFunctions.createGroup.run(
    { name: "Morning crew", type: "friends", nickname: "Ace" },
    context("alice")
  );
  await groupFunctions.joinGroup.run(
    { inviteCode: created.inviteCode, nickname: "Builder" },
    context("bob")
  );
  const db = admin.firestore();
  await db.doc("groups/" + created.groupId + "/goals/bob").set({ targetWorkouts: 3 });

  const left = await groupFunctions.leaveGroup.run({ groupId: created.groupId }, context("bob"));
  assert.equal(left.left, true);
  const [member, mirror, goal] = await Promise.all([
    db.doc("groups/" + created.groupId + "/members/bob").get(),
    db.doc("users/bob/groups/" + created.groupId).get(),
    db.doc("groups/" + created.groupId + "/goals/bob").get(),
  ]);
  assert.equal(member.exists, false);
  assert.equal(mirror.exists, false);
  assert.equal(goal.exists, false);

  const secondLeave = await groupFunctions.leaveGroup.run({ groupId: created.groupId }, context("bob"));
  assert.equal(secondLeave.left, false);

  await assert.rejects(
    groupFunctions.leaveGroup.run({ groupId: created.groupId }, context("alice")),
    (error) => error.code === "failed-precondition"
  );
});

test("group lifecycle callables reject unauthenticated and malformed requests before writes", async () => {
  await assert.rejects(
    groupFunctions.createGroup.run(
      { name: "Morning crew", type: "friends", nickname: "Ace" },
      context()
    ),
    (error) => error.code === "unauthenticated"
  );
  await assert.rejects(
    groupFunctions.createGroup.run(
      { name: "", type: "friends", nickname: "Ace" },
      context("alice")
    ),
    (error) => error.code === "invalid-argument"
  );
  await assert.rejects(
    groupFunctions.joinGroup.run(
      { inviteCode: "bad", nickname: "Builder" },
      context("bob")
    ),
    (error) => error.code === "invalid-argument"
  );
  await assert.rejects(
    groupFunctions.leaveGroup.run({ groupId: "bad/path" }, context("bob")),
    (error) => error.code === "invalid-argument"
  );
  assert.equal((await admin.firestore().collection("groups").get()).empty, true);
});
