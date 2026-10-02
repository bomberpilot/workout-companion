# Backend setup and access needed

Workout Companion will retain Firebase for v1; see [decision 001](decisions/001-keep-firebase-for-v1.md).

## Known and unknown

Owner-reported existing Firebase project ID: `workout-companion-d078f`.

The owner reports that existing Firestore records and login accounts are test data created from a phone using a desktop Expo development server. The owner can clear that data. Retain the fixtures until reconciliation/session checks are complete; this PR does not delete records or Auth identities.

The owner supplied the current rules text and reports no custom indexes. [Security review](SECURITY_REVIEW.md) records the authorization gaps and the supplied-policy transcript. A complete export and emulator compilation are still needed; no console/project access has been verified.

Unknown: enabled Auth providers/settings; live function versions/region/runtime; registered Firebase client app values.

This repository's GitHub authorization allows code changes and PR checks. It does not grant access to Firebase/Google Cloud, Expo/EAS, signing or store consoles. No live Firebase write or deployment is included in the auth-stabilization PR.

## Needed for backend reconciliation

1. Test-only data status is owner-confirmed. Establish a dedicated development/staging environment and separate production targeting before release.
2. Owner-reported rules and no-custom-index status are recorded. Reconcile a complete rules export and develop tested replacements alongside the affected client/server operations; see the security review.
3. Confirm enabled Authentication providers and email/password settings. Capture the six registered Firebase client values from project settings in the appropriate development environment; public client values are embedded by Expo.
4. Identify deployed functions and their runtime/region. Confirm deployment ownership and intended environment.

Do not paste account passwords, service account private keys, OAuth tokens, signing credentials or store credentials into chat or source control.

## Validation and deployment path

Backend correctness and authorization tests should use local/CI Firebase emulators, a demo project ID and synthetic fixtures. They can cover adversarial access and canonical workout behavior without reading production records. Repository Firebase/emulator configuration is a planned follow-up.

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
