const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

// Exercise the compiled, exported callable with the SDK boundary replaced.
// These are authorization unit tests, not Firestore rules/emulator tests.
function loadCallable({ isMember = true, membershipError } = {}) {
  const reads = [];
  const writes = [];
  class HttpsError extends Error {
    constructor(code, message) {
      super(message);
      this.code = code;
    }
  }

  function collection(segments) {
    return {
      doc(id) {
        const documentPath = [...segments, id];
        return {
          collection(name) {
            return collection([...documentPath, name]);
          },
          async get() {
            const key = documentPath.join("/");
            reads.push(key);
            if (key.includes("/members/")) {
              if (membershipError) throw membershipError;
              return { exists: isMember };
            }
            // An authorized caller with no goal is a safe, successful no-op.
            return { exists: false };
          },
          async set() {
            writes.push(documentPath.join("/"));
          },
        };
      },
    };
  }

  const sdk = {
    "firebase-admin": {
      initializeApp() {},
      firestore: () => ({ collection: (name) => collection([name]) }),
    },
    "firebase-functions": {
      firestore: { document: () => ({ onWrite: (handler) => handler }) },
      https: { HttpsError, onCall: (handler) => handler },
      logger: { info() {} },
    },
  };
  const module = { exports: {} };
  const code = readFileSync(path.join(__dirname, "../lib/index.js"), "utf8");
  vm.runInNewContext(code, {
    exports: module.exports,
    module,
    require(name) {
      assert.ok(Object.hasOwn(sdk, name), "Unexpected SDK dependency: " + name);
      return sdk[name];
    },
  }, { filename: "functions/lib/index.js", timeout: 1000 });

  return { call: module.exports.recomputeGoalProgress, reads, writes };
}

const signedIn = { auth: { uid: "alice" } };
const rejectsWithCode = (code) => (error) => {
  assert.equal(error.code, code);
  return true;
};

test("anonymous callers cannot access any group data", async () => {
  const { call, reads, writes } = loadCallable();
  await assert.rejects(call({ groupId: "group-a" }, {}), rejectsWithCode("unauthenticated"));
  assert.deepEqual(reads, []);
  assert.deepEqual(writes, []);
});

test("a signed-in caller cannot recompute another user's progress", async () => {
  const { call, reads, writes } = loadCallable();
  await assert.rejects(
    call({ groupId: "group-a", userId: "bob" }, signedIn),
    rejectsWithCode("permission-denied")
  );
  assert.deepEqual(reads, []);
  assert.deepEqual(writes, []);
});

test("an explicit caller userId remains compatible", async () => {
  const { call, reads, writes } = loadCallable();
  const result = await call({ groupId: "group-a", userId: "alice" }, signedIn);
  assert.equal(result.ok, true);
  assert.deepEqual(reads, ["groups/group-a/members/alice", "groups/group-a/goals/alice"]);
  assert.deepEqual(writes, []);
});

test("omitting userId derives identity from authentication", async () => {
  const { call, reads } = loadCallable();
  assert.equal((await call({ groupId: "group-a" }, signedIn)).ok, true);
  assert.deepEqual(reads, ["groups/group-a/members/alice", "groups/group-a/goals/alice"]);
});

test("non-members cannot read goals or write progress", async () => {
  const { call, reads, writes } = loadCallable({ isMember: false });
  await assert.rejects(call({ groupId: "group-b" }, signedIn), rejectsWithCode("permission-denied"));
  assert.deepEqual(reads, ["groups/group-b/members/alice"]);
  assert.deepEqual(writes, []);
});

test("membership lookup failures fail closed", async () => {
  const failure = new Error("Database unavailable");
  const { call, reads, writes } = loadCallable({ membershipError: failure });
  await assert.rejects(call({ groupId: "group-a" }, signedIn), (error) => error === failure);
  assert.deepEqual(reads, ["groups/group-a/members/alice"]);
  assert.deepEqual(writes, []);
});

test("malformed requests are rejected before database access", async () => {
  for (const input of [undefined, null, [], "group-a", 42, {}, { groupId: 42 },
    { groupId: "" }, { groupId: "   " }, { groupId: "group-a/members/bob" },
    { groupId: "x".repeat(1501) }]) {
    const { call, reads, writes } = loadCallable();
    await assert.rejects(call(input, signedIn), rejectsWithCode("invalid-argument"));
    assert.deepEqual(reads, []);
    assert.deepEqual(writes, []);
  }
});

test("supplied malformed identities cannot replace the authenticated caller", async () => {
  for (const userId of [null, "", 42, ["alice"], { uid: "alice" }]) {
    const { call, reads } = loadCallable();
    await assert.rejects(call({ groupId: "group-a", userId }, signedIn), rejectsWithCode("permission-denied"));
    assert.deepEqual(reads, []);
  }
});

test("surrounding group-code whitespace is normalized", async () => {
  const { call, reads } = loadCallable();
  assert.equal((await call({ groupId: " group-a " }, signedIn)).ok, true);
  assert.equal(reads[0], "groups/group-a/members/alice");
});
