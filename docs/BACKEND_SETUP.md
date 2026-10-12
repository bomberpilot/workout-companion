# Backend setup and access needed

Workout Companion will retain Firebase for v1; see [decision 001](decisions/001-keep-firebase-for-v1.md).

## Known and unknown

Owner-reported existing Firebase project ID: `workout-companion-d078f`.

The owner reports that existing Firestore records and login accounts are test data created from a phone using a desktop Expo development server. The owner can clear that data. Retain the fixtures until reconciliation/session checks are complete; this PR does not delete records or Auth identities.

Authenticated read-only inspection on 2026-10-12 verified the default Standard/Native Firestore database in `nam5`, the complete deployed ruleset, and no composite indexes or field overrides. [Security review](SECURITY_REVIEW.md) records the live ruleset identity, authorization gaps, and coordinated replacement.

Unknown: enabled Auth providers/settings; live function versions/region/runtime; registered native Firebase apps; production/staging separation.

Firebase and Google Cloud CLI access is available for read-only reconciliation. No live Firebase write or deployment is included in this security branch. Expo/EAS, signing and store-console access remain unverified.

## Needed for backend reconciliation

1. Test-only data status is owner-confirmed. Establish a dedicated development/staging environment and separate production targeting before release.
2. Live rules and index status are reconciled. Review and validate the prototype rules and coordinated client/server operations; see the security review.
3. Confirm enabled Authentication providers and email/password settings. Capture the six registered Firebase client values from project settings in the appropriate development environment; public client values are embedded by Expo.
4. Identify deployed functions and their runtime/region. Confirm deployment ownership and intended environment.

Do not paste account passwords, service account private keys, OAuth tokens, signing credentials or store credentials into chat or source control.

## Validation and deployment path

Backend correctness and authorization tests use the Firestore emulator, demo project ID `demo-workout-companion`, and synthetic fixtures. They cover adversarial access and group lifecycle behavior without reading production records. Run `npm run test:firestore` with Java 21 available.

Live reconciliation requires an authenticated Firebase/Google Cloud session with the relevant read permissions. Later deployment should use a scoped identity in a coding workspace or a repository CI identity, preferably Google Workload Identity Federation. Grant only the access needed for the intended environment/operation; do not default to a project-wide administrator key.

Before any deployment: compare deployed rules/indexes/functions against reviewed repository changes, establish data backup/migration expectations where applicable, run the mechanical/emulator tests, verify environment targeting and execute the device smoke matrix. No default production project mapping is being added; the reported existing project is currently used for development.

## Native session verification

This stabilization slice configures AsyncStorage before native Auth initialization. CI unit tests validate the initialization order and error handling with mocked SDK boundaries; iOS/Android Metro exports check package resolution.

Physical-device acceptance still needs valid development client configuration and a configured email/password provider:

- New account and existing login.
- Force close/reopen on both iOS and Android: session retained.
- Logout and restart: signed-out state retained.
- Fast Refresh/development reload: existing Auth instance reused.
- Expired/deleted account and interrupted network: intentional handling.

Passing bundle export does not establish any of these runtime results.

## Find the Authentication provider setting

Open [the project's sign-in providers](https://console.firebase.google.com/project/workout-companion-d078f/authentication/providers), or select Build → Authentication → Sign-in method in Firebase Console. If Authentication shows Get started, complete that first. Select Email/Password, enable the first Email/Password toggle if disabled, and save. The current app uses email/password signup/login; email-link sign-in is not implemented and does not need enabling. Confirm the provider row shows Enabled for the correct project.

Existing test accounts do not replace checking the current provider setting. Record the observed status once the owner confirms it.
