# Release smoke matrix

Record build version/commit, environment, platform/device/OS, date, tester and result for each execution. Use a dedicated test backend and two accounts with at least two groups. Never infer a pass from source inspection. Current status of all device cases: **not executed**.

## Golden path

1. Clean install; verify purpose copy, safe areas and readable UI.
2. Create account A; set profile; create group A; create a count/period goal.
3. Create account B on another device; join with shared invitation; verify names/member visibility.
4. Join/create a second group with a different goal period.
5. Log one workout globally with a category and optional note.
6. Verify one canonical user workout ID, one intended card per group, and only applicable period progress.
7. Receive group activity on B; send/read a message in both directions.
8. Close/force-close/reopen; verify account, memberships, goals and workout state persist.
9. Edit the workout date across a goal boundary; verify date/performedAt/cards/progress agree. Verify deletion policy when implemented.
10. Logout; ensure previous-user content/listeners disappear. Sign in as another account.
11. Delete an account through the app; verify reauthentication, identity removal and documented cleanup/anonymization.

## Edge and failure checks

| Area | Cases |
| --- | --- |
| Auth | Existing/new user, incorrect credentials, duplicate email, profile-write failure, expired auth, reset, logout, restart, deleted identity |
| Groups | Invalid/expired invite, duplicate join (owner role preserved), concurrent create/join, partial network failure, multiple memberships, leave/last-owner policy |
| Goals | Create/edit/delete, concurrent edits, same-day goal, leap day, impossible date, reversed period, timezone boundaries, completion/expiry, primary goal order |
| Workouts | Optional note/duration policy, date/category, multiple groups, repeated submit/retry, failure after canonical write, edit/date boundary, deletion, restart |
| Chat | Two users, chronological cards/text, long messages, keyboard, slow/failed send (draft preserved), pagination, empty/loading/unauthorized states |
| Notifications | Granted/denied, preference disabled, token refresh/logout, foreground/background delivery, stale token receipts, tap into authorized group |
| Network | Airplane mode, poor network, interrupted writes, pending-state/retry UX, background/resume, auth expiry |
| Privacy/security | A cannot read private unrelated B group/profile/workouts, forge membership/roles, overwrite other user's goals or invoke admin callable for another user |
| Layout/accessibility | Small/large phones, safe areas, keyboard, text scaling/overflow, readable supported themes, accessible labels and touch targets |
| Release | Clean install and upgrade, signed release behavior, test and production env separation, crash diagnostics without private data |

## Device/store evidence

- Current and older supported iPhone.
- Current and smaller Android device.
- Physical iOS and Android notification tests.
- Clean-device TestFlight acceptance using the selected beta build.
- Clean-device Google Play internal/closed-track acceptance.
- Store listing screenshots match actual released behavior.
- Current Apple/Google account deletion, data disclosure and target API requirements checked at submission.

Run automated checks before this matrix. The matrix supplements tests; it does not replace authorization/emulator or domain regression tests.
