const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");

const sourcePath = path.join(__dirname, "../src/config/firebase.ts");
const compiled = ts.transpileModule(readFileSync(sourcePath, "utf8"), {
  fileName: sourcePath,
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
    esModuleInterop: true,
  },
}).outputText;

function createRuntime({ platform = "ios", initializationError, missingPersistence = false } = {}) {
  const app = { name: "[DEFAULT]" };
  const auth = { app };
  const db = {};
  const storage = { getItem() {}, setItem() {}, removeItem() {} };
  const persistence = {};
  const calls = [];
  let appInitialized = false;
  let authInitialized = false;

  const authSdk = {
    initializeAuth(receivedApp, options) {
      calls.push("initializeAuth");
      assert.equal(receivedApp, app);
      assert.equal(options.persistence, persistence);
      if (initializationError) throw initializationError;
      if (authInitialized) throw Object.assign(new Error("Already initialized"), { code: "auth/already-initialized" });
      authInitialized = true;
      return auth;
    },
    getAuth(receivedApp) {
      calls.push("getAuth");
      assert.equal(receivedApp, app);
      // Firebase's default initialization is precisely what native code must avoid.
      authInitialized = true;
      return auth;
    },
  };
  if (!missingPersistence) {
    authSdk.getReactNativePersistence = (receivedStorage) => {
      calls.push("getReactNativePersistence");
      assert.equal(receivedStorage, storage);
      return persistence;
    };
  }

  const sdk = {
    "firebase/app": {
      getApps: () => appInitialized ? [app] : [],
      getApp: () => app,
      initializeApp() {
        calls.push("initializeApp");
        appInitialized = true;
        return app;
      },
    },
    "firebase/auth": authSdk,
    "firebase/firestore": { getFirestore: () => db },
    "@react-native-async-storage/async-storage": storage,
    "react-native": { Platform: { OS: platform } },
  };

  function load() {
    const module = { exports: {} };
    vm.runInNewContext(compiled, {
      exports: module.exports,
      module,
      process: { env: {} },
      require(name) {
        assert.ok(Object.hasOwn(sdk, name), "Unexpected dependency: " + name);
        return sdk[name];
      },
    }, { filename: sourcePath, timeout: 1000 });
    return module.exports;
  }
  return { load, calls, app, auth, db };
}

for (const platform of ["ios", "android"]) {
  test(platform + " configures AsyncStorage before any default auth initialization", () => {
    const runtime = createRuntime({ platform });
    const exports = runtime.load();
    assert.equal(exports.auth, runtime.auth);
    assert.equal(exports.db, runtime.db);
    assert.deepEqual(runtime.calls, ["initializeApp", "getReactNativePersistence", "initializeAuth"]);
  });
}

test("Fast Refresh reuses the existing app and persistent auth instance", () => {
  const runtime = createRuntime();
  const first = runtime.load();
  const refreshed = runtime.load();
  assert.equal(first.app, refreshed.app);
  assert.equal(first.auth, refreshed.auth);
  assert.deepEqual(runtime.calls, [
    "initializeApp", "getReactNativePersistence", "initializeAuth",
    "getReactNativePersistence", "initializeAuth", "getAuth",
  ]);
});

test("unexpected initialization failures propagate without silent memory-only fallback", () => {
  const failure = Object.assign(new Error("Storage unavailable"), { code: "auth/internal-error" });
  const runtime = createRuntime({ initializationError: failure });
  assert.throws(runtime.load, (error) => error === failure);
  assert.equal(runtime.calls.includes("getAuth"), false);
});

test("unstructured initialization errors are not mistaken for Fast Refresh", () => {
  const runtime = createRuntime({ initializationError: "Unexpected failure" });
  assert.throws(runtime.load, (error) => error === "Unexpected failure");
  assert.equal(runtime.calls.includes("getAuth"), false);
});

test("missing native persistence exports fail visibly instead of silently losing sessions", () => {
  const runtime = createRuntime({ missingPersistence: true });
  assert.throws(runtime.load, /React Native persistence entrypoint is unavailable/);
  assert.deepEqual(runtime.calls, ["initializeApp"]);
});

test("web retains Firebase's browser initialization without requiring native storage", () => {
  const runtime = createRuntime({ platform: "web", missingPersistence: true });
  assert.equal(runtime.load().auth, runtime.auth);
  assert.deepEqual(runtime.calls, ["initializeApp", "getAuth"]);
});
