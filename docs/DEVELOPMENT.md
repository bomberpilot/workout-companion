# Development and validation

## Install

Use Node 22.14.0 (recorded in `.nvmrc`) and npm. Expo SDK 57 requires Node >=22.13.0. Keep both existing npm lockfiles; this is not an npm workspace.

```sh
nvm use
npm ci
npm --prefix functions ci
cp .env.example .env
```

On Windows, install the recorded Node version and copy `.env.example` with your preferred file manager. Fill all six Firebase client values from a development Firebase project. Do not use a production project for manual development tests.

Expo embeds `EXPO_PUBLIC_*` values into the app. They are public client configuration, not privileged secrets. Authorization must be enforced by backend rules and callable code. Never commit service account JSON, private keys, signing material, or store credentials. The example file intentionally has empty values. No production backend configuration is shipped in this PR.

## Run the app

```sh
npm start
```

Use the Expo development server with Expo Go for SDK 57 or a compatible development build. The existing `android` and `ios` scripts start Expo; they do not create signed native production builds. Remote push notifications are unavailable in Expo Go and require a physical device with an appropriate development build; token registration alone is not evidence that delivery works. Web parity is outside v1 scope.

Firestore emulator validation is reproducible through the locked root tooling. Java 21 is required:

```sh
npm run test:firestore
```

The command compiles Functions, starts only the Firestore emulator with synthetic data under `demo-workout-companion`, runs the rules and group-lifecycle suites serially, and shuts the emulator down. It does not read or write the live Firebase project.

## Mechanical checks

```sh
npm run typecheck
npm run typecheck:functions
npm test
npm run dependencies:report
npm run build:check
# All four checks, in sequence:
npm run check
```

- `typecheck` checks mobile entrypoints and `src` with Expo's strict configuration.
- `typecheck:functions` checks the backend using its own dependencies/configuration.
- `test` runs app auth initialization regressions, callable authorization tests, and Firestore emulator suites for adversarial rules and atomic group lifecycle behavior. The emulator uses synthetic data; this does not test deployed Firestore rules.
- `build:check` exports iOS and Android Metro bundles. It does not compile/sign native binaries, launch the app, or exercise authentication.
- CI runs independent check steps even after another check fails, so defects remain visible.

The root `npm run lint` command uses Expo's ESLint configuration. The aggregate `npm run check` command also runs Expo Doctor so incompatible native dependency versions and missing peer dependencies fail CI. The Functions package's own `lint` script remains a placeholder; Functions TypeScript and regression tests are enforced separately.

Test scripts pass explicit files to Node's built-in runner so they behave consistently across Node versions, Windows PowerShell, and POSIX CI shells.

`dependencies:report` inventories both lockfiles using npm audit. It is informational: valid advisories are reported for triage rather than treated as a clean security gate; audit API/network/JSON failures fail the command. CI includes this report. Dependency updates must be compatible and validated, not forced blindly.

Native Auth now initializes with AsyncStorage through Firebase's React Native conditional export before calling getAuth. The obsolete firebase/auth/react-native declaration/import is removed. Only auth/already-initialized triggers reuse during Fast Refresh; unrelated errors propagate. Web retains its default SDK path. Run the physical-device session cases in [backend setup](BACKEND_SETUP.md) before considering persistence accepted.

No privileged Firebase values are needed for compilation or mocked authorization tests. Runtime/device checks do require a configured development Firebase app. Document observed check results and their exact commit in the PR; never replace a failing check with a no-op.

## Contribution workflow

Keep the product boundary tight: small trusted groups, simple goals, one canonical workout, group chat, conservative notifications. Work on focused branches and PRs; preserve working behavior and add tests for changes to domain/security logic. Inspect source before changing it.

Use [SHIP_READINESS.md](SHIP_READINESS.md) to decide the next blocker. Do not deploy the callable or security rules, submit store builds, or change production data as part of local validation. Account deletion, cross-group authorization, physical-device smoke tests and store disclosures are separate release gates.
