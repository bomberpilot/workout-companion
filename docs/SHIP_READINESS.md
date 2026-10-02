# Ship readiness: Workout Companion

## Audit scope and evidence

Audited baseline: `a382cf03a4f18ce7d9f879b8123de7069048bb47` on `main`. Reviewed the complete, non-truncated tree, all 61 non-lock text files and both npm lockfiles. No `AGENTS.md` exists. PNG asset files are present; their appearance, dimensions and suitability for store use have not been verified.

This is a source audit, not a claim of runtime acceptance. GitHub read/write access was demonstrated. This chat has no attached local terminal/checkout; first-slice verification uses GitHub Actions where available. No deployed Firebase configuration, rules, data, signing credentials, console settings, physical devices or store consoles were inspected. Current-source scans found no obvious private-key/token credentials, but history and dependency vulnerability scans still need execution.

The user-provided production roadmap is the product contract. Repository evidence is authoritative for what exists. The app is not production ready.

Status vocabulary: **DONE** = artifact/implementation verified within its stated scope; **PARTIAL** = some implementation exists with known gaps; **MISSING** = absent from tracked source; **BROKEN** = a specific defect demonstrated by source or executed checks; **NEEDS VERIFICATION** = runtime/external evidence is required. No user journey is certified complete solely because a screen exists.

## Architecture

| Area | Current implementation |
| --- | --- |
| Client | Expo 54.0.30, React Native 0.81.5, React 19.1.0, TypeScript 5.9.3 in the lockfile; new architecture enabled |
| Package manager | npm; lockfile v3 at root and separately in `functions/`; no workspace configuration |
| Entrypoint/navigation | `index.ts` registers root `App.tsx`, which re-exports `src/app/App.tsx`; React Navigation 7 native stack, auth-gated routes |
| State | React hooks/context for auth/theme; screen-local state and Firestore listeners; no separate global state framework |
| Theme | `src/theme/colors.ts` and `theme.ts` centralize light/dark colors, spacing, typography, radii and shadows; migration is incomplete |
| Authentication | Firebase 12.7.0 email/password; `onAuthStateChanged`; intended AsyncStorage persistence |
| Database | Firestore client SDK directly in screens and `src/firestore/actions.ts`; Admin SDK in Cloud Functions |
| Backend | firebase-admin 12.7.0, firebase-functions 4.9.0, TypeScript; v1 Firestore triggers and callable progress recompute |
| Notifications | Expo Notifications 0.32.15; permission/token registration and client-written notification documents; no verified push delivery |
| Analytics/crashes | PostHog dependency installed, but both analytics source files are empty; no initialized crash/error reporter found |
| Environment | Six `EXPO_PUBLIC_FIREBASE_*` values read directly; baseline example empty, no runtime validation; duplicated unused `env.ts` |
| Checks at baseline | No tests/CI/lint/format suite; backend `build` uses tsc; backend `lint` is only echo |
| Deployment | No tracked `eas.json`, EAS project ID/owner, native app identifiers, `firebase.json`, Firestore rules/indexes or Firebase project mapping |
| Native | Managed Expo configuration, icons/splash, portrait orientation, edge-to-edge Android; native folders ignored; no signing/build evidence |
| Tooling | Existing `ios/android` scripts only start Expo. Windows-only zip helper. VS Code task applies an empty `patches/codex.patch` |

### Screens and routes

`SignIn`, `Home`, `CreateGroup`, `JoinGroup`, `Chat`, `GroupProgress`, `GoalSetup`, `GoalEdit`, `Profile`, `MemberProfile`, `Settings` are implemented and registered. Auth loading renders nothing. There is no dedicated onboarding, privacy or account-deletion route.

### Data model in use

| Path | Purpose and important fields |
| --- | --- |
| `users/{uid}` | Email, display name, created/updated timestamps |
| `users/{uid}/groups/{groupId}` | Membership mirror, nickname and role (join screen omits role in this mirror) |
| `groups/{groupId}` | Name, group type, invite code, creator, timestamps; screen-created groups omit the goal settings required by the exported Group type |
| `groups/{groupId}/members/{uid}` | User ID, nickname, role, join date; used as the authoritative membership path for callable access |
| `groups/{groupId}/goals/{uid}` | Per-member goal entries array plus legacy root goal/counter fields; no central exported Goal type |
| `users/{uid}/workouts/{workoutId}` | Canonical workout: userId, groupId (one group or sentinel `all`), activityTypes, duration, date, performedAt, notes |
| `groups/{groupId}/messages/{messageId}` | Text or workout card; cards reference workout ID and copy activity/date/duration/note |
| `users/{uid}/notifications/{id}` | Client-written activity notification, actor, group/workout IDs, read flag |
| `users/{uid}/private/settings` | Notification preference and push tokens |
| `users/{uid}/private/goal` | Helper exists; no active caller found |

A global log already creates **one** workout, then separate conversation projections; it does not create independent per-group workouts. Preserve that invariant. Visibility is implicit in `groupId: "all"` plus current membership, not an explicit immutable association. Joining/leaving may change backend progress applicability without matching historic chat cards. Edit/delete propagation is not established.

## Product gap analysis

| Requirement | Status | Evidence / remaining work |
| --- | --- | --- |
| Purpose/onboarding | PARTIAL | Signup routes directly home; no profile gate; sign-in copy says “start complaining productively” |
| Signup/login | PARTIAL | Email/password forms implemented; provider enablement/device behavior unverified; no password-reset flow |
| Session restoration | NEEDS VERIFICATION | Persistence lookup uses legacy `firebase/auth/react-native` path and calls getAuth before initializeAuth; verify package resolution and actual native persistence |
| Profile/logout | PARTIAL | Name edit and sign-out exist, but no busy/error handling for save/logout; email is in the same document read by other-user profile views |
| Create group | PARTIAL | Screen writes group and two memberships sequentially; partial failure can orphan records; duplicates helper implementation |
| Join/invite | PARTIAL | Invite-code query and OS sharing exist; no uniqueness reservation, expiry/revocation/rate limit; duplicate join can overwrite owner role |
| Multiple memberships/member visibility | PARTIAL | User group subcollections and group member listeners exist; member views require privacy-safe scoped reads |
| Leave/manage membership | PARTIAL | Two sequential deletes; no owner-transfer/last-member policy or goal/content cleanup; listener races can re-create membership |
| Small trusted groups | PARTIAL | Concept fits existing UI; no enforced group-size limit or authoritative invitation flow |
| Goal create/edit/delete | PARTIAL | Per-member count/period goals and entries array exist; validation accepts impossible calendar days; concurrent whole-array writes can lose changes |
| Goal completion/expiration | PARTIAL | Counts/date display exist; date/window/root-versus-entry consistency and completion states need correction |
| Workout logging | PARTIAL | Date/category/notes and one canonical write exist; duration is mandatory, contrary to lowest-friction count-based intent; no idempotency |
| Multi-group sharing | PARTIAL | One workout plus sequential cards/counters/notifications; failure after canonical write leaves partial fan-out and retry duplicates |
| Workout edit/delete | BROKEN | Edit updates date but not performedAt; server reads performedAt first; chat snapshots and duration totals stay stale. No workout deletion workflow |
| Home/accountability | BROKEN | All-time global count is divided by each goal target rather than applicable period workouts; child Firestore subscriptions are not cleaned up |
| Group chat | PARTIAL | Realtime chronological/inverted list and text writes; composer clears before await, no send/error state, no pagination/loading/empty state |
| Workout cards | PARTIAL | Canonical reference plus copied details; legacy fallback hydration; copy fields do not follow edits; hardcoded styles |
| Notifications | PARTIAL | Permission flow/tokens/in-app records exist; push helper unused, no delivery worker/receipts/token cleanup/tap navigation; toggle does not govern registration/fan-out |
| Settings/privacy | PARTIAL | One optimistic toggle, errors swallowed; no privacy/support/account-management links |
| Account deletion | MISSING | No reauthentication/deletion UI or backend cascade/auth deletion |
| Loading/error/empty states | PARTIAL | Some alerts, busy buttons and empty text; silent catches/blank loading/unhandled async actions remain |
| Offline/degraded network | MISSING | No deliberate offline/pending/retry UX or configured durable Firestore caching; AsyncStorage is used for intended auth persistence only |
| Design/accessibility | PARTIAL | Calm semantic theme exists, but Button/TextField/chat/goals/editor still use hardcoded light styles; no full a11y/device-size audit |
| Privacy/security enforcement | MISSING | No rules/indexes/emulator tests in source; deployed enforcement unknown; callable vulnerability confirmed at baseline |
| Essential observability | MISSING | Analytics source empty; no crash reporting initialization |
| iOS/Android production delivery | MISSING | App IDs, EAS profiles/environments/signing/version codes not recorded; no native build evidence |
| Store/privacy assets | MISSING | No privacy inventory/disclosures, hosted policy/support/deletion URLs, metadata/review notes/screenshots package |

## Critical defects and technical debt

| Priority | Finding and source | Classification |
| --- | --- | --- |
| P0 | `functions/src/index.ts: recomputeGoalProgress` permits arbitrary target userId and does not check group membership; Admin SDK bypasses rules | Release blocker; first slice restricts callers to self + existing membership |
| P0 | No committed Firestore rules or authorization tests; screens can write their own group-member records just by opening a route | Release blocker; missing source is not proof of deployed public access, but production privacy cannot be verified |
| P0 | `MemberProfileScreen` queries all of another user's latest 40 workouts and profile containing email without group visibility filtering | Release blocker; scoped projections/rules must prevent private cross-group or personal-data exposure |
| P1 | `actions.ts` writes workout/cards/counters separately, has no idempotency and can return failure after permanent canonical creation | Release blocker; retries and partial fan-out risk inconsistent/duplicate records |
| P1 | `EditWorkoutModal` leaves performedAt unchanged; backend prefers it over edited date; duplicated chat cards/time totals not repaired | Release blocker for edit integrity |
| P1 | Client increment counters coexist with server recompute triggers; counts can race; duration totals are incremental and never recomputed | Release blocker for reliable progress |
| P1 | Local midnight workout dates versus UTC goal windows/labels; goal parsers permit rollover; picker conversion mutates month/date in separate steps | Release blocker for boundary dates/timezones; agree and test one calendar-date policy |
| P1 | `HomeScreen` uses all-time count for period goals, returns cleanup from an onSnapshot callback (ignored), and attaches listeners after async membership writes | Release blocker for correct status, stale listeners and account-switch privacy |
| P1 | Home/chat/progress/goal setup write membership while viewing; leave navigates before sequential deletion; nested listeners can add a departing user again | Release blocker for lifecycle/authz design |
| P1 | Create/join/leave and nickname mirrors are non-atomic; duplicate joins overwrite membership/owner role; invites use Math.random without unique reservation | Release blocker for group lifecycle |
| P1 | Account creation fires auth change before profile write is guaranteed; no repair/profile completion gate; native auth persistence initialization unverified | Release blocker pending session/golden-path tests |
| P1 | Chat composer drops text before write and has no failure catch; profile save/logout/goal setup/push registration include unhandled async failures | Release blocker for user-visible reliability |
| P1 | `GoalSetup` lacks submit busy/duplicate protection; root and entry-array goal copies drift on reorder/edit and read-modify-write updates race | Release blocker for goal correctness |
| P2 | Member progress recomputes from only 40 fetched workouts and no group filter; PanResponder captures initial render values | Near-term debt; progress correctness is release-critical, drag sorting can be simplified/deferred |
| P2 | Full chat subscription and serial hydration reads, full workout-count reads, listener accumulation | Near-term performance debt; add bounded queries/pagination after correctness |
| P2 | Exported model types diverge from screen data; pervasive any, duplicate date parsers, duplicated group actions/invite utilities | Near-term debt; consolidate touched domain logic, avoid wholesale rewrite |
| P2 | Dark theme provider versus Expo light setting and hardcoded light components; no safe-area/keyboard/a11y validation across all screens | Release UX blocker; migrate shared primitives first |
| P3 | Unused GlobalWorkoutLogModal, home GoalTile, calculateGroupProgress, shortCode, env helper, action group helpers, push helper; empty analytics/theme/patch files | Acceptable post-launch cleanup unless it affects validation; do not delete working paths speculatively |

No explicit TODO/FIXME markers were found. Several comments marked NEW/legacy and empty modules represent unfinished work. No hardcoded privileged credentials were found in current text; dependency audit, git-history scan and deployed logging review are still required. Logs include user/group IDs and some raw errors; production observability must minimize sensitive content.

No indexes are committed. Inventory actual queries and emulator/production missing-index responses, especially invite lookup, message ordering, member workout visibility and backend groupId applicability. Do not invent index requirements from filenames alone.

## Privacy inventory seed (source evidence, not store-form answers)

The source handles email, authentication credentials through Firebase Auth, UID, display name, group nickname, memberships/roles/invite codes, goal counts/dates/reasons, workout categories/duration/dates/notes, chat text/cards, actor activity notifications, read flags, notification preferences and Expo push tokens. Tokens and notes can be sensitive. Device/permission information is queried for push registration.

Providers present: Firebase Auth/Firestore/Functions, Expo Notifications; PostHog is installed but not initialized in reviewed code. Determine SDK behavior, backend logs/retention and actual production collection before filling either store disclosure. Do not guess analytics/crash collection or tracking declarations.

Required work: reauthentication + server-owned deletion/cascade policy; profile/membership/workout/message cleanup or documented anonymization; auth identity deletion; hosted privacy/support/deletion-request information; verified Apple/Google policies at submission time. Keep account deletion discoverable in the app.

## Release gate reconciliation

| Gate | Status at audited baseline | Evidence needed |
| --- | --- | --- |
| Clean install/app startup/TypeScript | NEEDS VERIFICATION | Clean npm installs, typechecks, Metro exports and device launch |
| Automated checks/lint/format | MISSING | First slice adds tests/checks/CI; lint/format follow-up remains |
| Clean iOS production build | MISSING | Signed EAS/native production build |
| Clean Android production build | MISSING | Signed AAB and required target API verification |
| No known critical crashes | NEEDS VERIFICATION | Device/release exercise and crash visibility |
| No known authorization/data exposure | BROKEN | Callable fix + rules/scoped reads + emulator adversarial tests |
| Account creation | PARTIAL | New-account/device/provider validation |
| Account deletion | MISSING | End-to-end cleanup, reauth and policy acceptance |
| Group creation/joining | PARTIAL | Atomic/invite/duplicate/member tests with two accounts |
| Goals | PARTIAL | Window/date/race/progress consistency tests |
| Workout logging | PARTIAL | Success/failure/retry/restart tests |
| One workout across multiple groups | PARTIAL | Canonical ID, applicability, edit/delete and atomicity tests |
| Group conversation | PARTIAL | Send failure recovery and multi-user/device tests |
| Notification essentials | PARTIAL | Permission/preference/delivery/token/tap tests on both physical platforms |
| Persistent sessions | NEEDS VERIFICATION | Force-close/reopen and expiry/logout tests |
| Deliberate loading/error/empty states | PARTIAL | Screen-by-screen smoke matrix |
| Privacy disclosures match behavior | MISSING | Definitive runtime/provider inventory and platform disclosures |
| Release smoke test on physical iOS | NEEDS VERIFICATION | Recorded device/build/result |
| Release smoke test on physical Android | NEEDS VERIFICATION | Recorded device/build/result |
| TestFlight acceptance | MISSING | Store-delivered beta, clean-device acceptance |
| Play test-track acceptance | MISSING | Store-delivered beta, clean-device acceptance |
| Listing assets and reviewer access | MISSING | Accurate metadata, icons/screenshots, hosted URLs and reviewer instructions |

## Critical path and bounded PR order

1. **This slice:** source audit, documented setup/env, scoped TypeScript checks, callable boundary regression tests and CI; fix the known manual-recompute authorization hole. Verify CI rather than claiming device readiness.
2. **Baseline stabilization:** address observed clean-install/compile/Metro failures; fix Firebase persistence/resolution; establish real lint/format with locked dependencies. Verify a physical-device launch and session restoration.
3. **Security/data correctness:** commit deployed-rule reconciliation, Firebase emulator setup and adversarial rule tests. Replace route-triggered self-membership writes, make invitation/create/join/leave authoritative and atomic, prevent cross-user private profile/workout reads. Define canonical workout visibility, timestamp semantics, idempotent fan-out and server-owned progress. Fix edits/counters without migrating to an unrelated platform.
4. **Account lifecycle and golden path:** profile completion, recoverable auth errors/reset, robust logout, server-owned account deletion/reauth/cleanup; prove new-user to group to goal to workout to chat to restart. Exercise multiple groups and two users.
5. **Feature and UX integrity:** finish membership/goal/workout/chat edge behavior; make duration optional for count goals; display correct scoped progress; retain drafts on send failure; deliberate network/loading/empty/error states; shared theme/accessibility/layout pass. Remove progress ranking in favor of a neutral member order (presence over performance).
6. **Conservative notifications and observability:** backend delivery, preference enforcement, token lifecycle/receipts/deep links, physical-device tests; minimal production crash/error visibility and verified privacy-respecting events.
7. **Release infrastructure in parallel once ownership is known:** stable identifiers, EAS project/environments/profiles, signing, native beta/production builds, current platform API/policy verification; data inventory and accurate disclosures/URLs.
8. **Release acceptance:** smoke matrix, TestFlight/Play tracks, clean-device tests, assets and reviewer access. Submit only after every release gate has evidence.

No backend rewrite, wearable integration, monetization, public discovery, coaching or detailed exercise tracker belongs on this path. Ownership/signing/store accounts, public support/privacy URLs and physical-device acceptance require user-provided external setup later; they do not block this code audit/first PR.

## First implementation slice and verification record

Branch: `codex/ship-readiness-baseline`.

Changes: self + group-membership authorization before any callable progress access; tests invoke the actual compiled exported callable with mocked SDK boundaries; separate app/backend typecheck scripts, backend test runner and iOS/Android Metro export check; GitHub Actions; Node version and env documentation; generated-backend/env ignore rules; this audit and device smoke checklist.

The backend change intentionally removes the ability to recompute someone else's progress through the manual client callable. Existing Admin SDK triggers still recompute affected users. This is not a substitute for Firestore rules or server-owned membership validation. Deployed backend protection changes only after a reviewed deployment; this PR does not deploy.

Validation results and any infrastructure limitation are recorded in the PR against its head commit. Lint/format, native builds, emulator rules tests, physical devices and store acceptance remain unverified even if CI is green.
