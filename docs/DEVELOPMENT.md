# Development and validation

## Install

Use Node 22.14.0 (recorded in `.nvmrc`) and npm. The app's locked React Native 0.81.5 requires Node >=20.19.4. Keep both existing npm lockfiles; this is not an npm workspace.

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

Use the Expo development server with a compatible device/development build. The existing `android` and `ios` scripts start Expo; they do not create signed native production builds. SDK 54 push behavior needs a physical device and an appropriate development build; token registration alone is not evidence that delivery works. Web parity is outside v1 scope.

Backend emulator startup is not yet reproducible: there is no committed `firebase.json`, emulator/rules configuration or Firebase CLI dependency. Do not assume `npm --prefix functions run serve` works until the backend-security follow-up establishes these.

## Mechanical checks

```sh
npm run typecheck
npm run typecheck:functions
npm test
npm run build:check
# All four checks, in sequence:
npm run check
```

- `typecheck` checks mobile entrypoints and `src` with Expo's strict configuration.
- `typecheck:functions` checks the backend using its own dependencies/configuration.
- `test` compiles the backend and runs Node's test runner against the exported callable. SDK boundaries are mocked; this does not test deployed Firestore rules.
- `build:check` exports iOS and Android Metro bundles. It does not compile/sign native binaries, launch the app, or exercise authentication.
- CI runs independent check steps even after another check fails, so defects remain visible.

No real linting or formatting suite existed at audit time. The existing backend `lint` script only prints a message and is not a validation gate. Establish lint/format tooling in the next stabilization PR with locked dependencies and a small reviewed diff; do not report the placeholder as passing lint.

No privileged Firebase values are needed for compilation or mocked authorization tests. Runtime/device checks do require a configured development Firebase app. Document observed check results and their exact commit in the PR; never replace a failing check with a no-op.

## Contribution workflow

Keep the product boundary tight: small trusted groups, simple goals, one canonical workout, group chat, conservative notifications. Work on focused branches and PRs; preserve working behavior and add tests for changes to domain/security logic. Inspect source before changing it.

Use [SHIP_READINESS.md](SHIP_READINESS.md) to decide the next blocker. Do not deploy the callable or security rules, submit store builds, or change production data as part of local validation. Account deletion, cross-group authorization, physical-device smoke tests and store disclosures are separate release gates.
