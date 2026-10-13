const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

const sourcePath = path.join(__dirname, "../src/goals/memberGoals.ts");
const compiled = ts.transpileModule(readFileSync(sourcePath, "utf8"), {
  fileName: sourcePath,
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const moduleInstance = new Module(sourcePath);
moduleInstance._compile(compiled, sourcePath);
const { readMemberGoals, countGoalWorkouts } = moduleInstance.exports;

test("reads multiple member goals and legacy single-goal documents", () => {
  const goals = readMemberGoals({ goalEntries: [
    { id: "first", targetWorkouts: 3, completedWorkouts: 1, goalDateReason: "Show up" },
    { id: "second", targetWorkouts: 5, completedWorkouts: 2 },
  ] });
  assert.equal(goals.length, 2);
  assert.equal(goals[0].id, "first");
  assert.equal(goals[1].targetWorkouts, 5);
  assert.equal(readMemberGoals({ targetValue: 4, completedWorkouts: 2 }, "member")[0].id, "member-0");
  assert.deepEqual(readMemberGoals({ goalEntries: [] }), []);
  assert.deepEqual(readMemberGoals(undefined), []);
});

test("counts one canonical workout in each applicable group only during its goal dates", () => {
  const goal = { targetWorkouts: 3, completedWorkouts: 0, goalStartDateISO: "2026-10-01", goalDateISO: "2026-10-31" };
  const workouts = [
    { groupId: "all", date: new Date("2026-10-01T00:00:00.000Z") },
    { groupId: "group-a", date: new Date("2026-10-31T23:59:59.999Z") },
    { groupId: "group-b", date: new Date("2026-10-10T12:00:00.000Z") },
    { groupId: "group-a", date: new Date("2026-11-01T00:00:00.000Z") },
  ];
  assert.equal(countGoalWorkouts(goal, "group-a", workouts), 2);
  assert.equal(countGoalWorkouts(goal, "group-b", workouts), 2);
});

test("accepts Firestore timestamps and falls back to saved progress for old undated goals", () => {
  const goal = { targetWorkouts: 4, completedWorkouts: 2, goalStartDateISO: "2026-10-01", goalDateISO: "2026-10-31" };
  assert.equal(countGoalWorkouts(goal, "group-a", [
    { groupId: "group-a", performedAt: { toMillis: () => Date.parse("2026-10-13T12:00:00Z") } },
  ]), 1);
  assert.equal(countGoalWorkouts({ ...goal, goalDateISO: "not-a-date" }, "group-a", []), 2);
});
