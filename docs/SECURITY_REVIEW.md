# Live Firestore rules review

On 2026-10-12, authenticated read-only inspection verified the default Firestore database for `workout-companion-d078f`: Standard edition, Native mode, multi-region `nam5`. Rules API release `cloud.firestore` points to ruleset `fc68c82d-e750-4261-84f7-2ededa79c134`, created 2026-01-07. The deployed rules exactly match the previously owner-supplied policy. The live database has no composite indexes or field overrides; automatic single-field indexes are separate.

[Rules transcript](security/OWNER_REPORTED_RULES.md) remains as provenance for the earlier owner-supplied text. The complete live export closed the previously missing outer braces and confirmed that the reviewed policy is deployed.

This branch adds a prototype `firestore.rules` replacement and emulator configuration. It also moves create/join/leave membership operations to authenticated callable Functions, removes route-triggered membership creation, and stops cross-user private profile/canonical-workout reads. The prototype is not deployed by this change.

## Release-critical findings

| Finding | Policy evidence and consequence | Required correction |
| --- | --- | --- |
| Cross-user profile disclosure | `/users/{userId}` permits any signed-in read. Private profile fields, including email where stored, can be read by unrelated users. Rules cannot hide individual fields of an otherwise readable document. | Self-only private profiles; separately scoped display-name/member projections. |
| Cross-user workout disclosure | Canonical workouts permit any signed-in read, independent of workout group applicability or membership. Current MemberProfile queries another user's last 40 workouts without a group filter. | Keep canonical ownership and use group-scoped associations/projections; change client queries with the rules. |
| Group metadata/invite enumeration | Any signed-in user can read/list all group documents, including stored invitation codes. | Member-only group reads; invite resolution/validation in an authenticated server operation. |
| Unauthorized self-enrollment | Membership create requires only `isSelf(memberId)`, so an attacker can create their own membership in any known group without an invitation. Member-existence checks then trust that record. | Server-owned create/join/invite operations and client membership-write restrictions. |
| Role and ownership forgery | Group create does not bind `createdBy` to the caller; membership create/update does not validate `role`, identity fields or immutable join fields. | Authoritative creation, strict allowed fields and immutable ownership; prevent clients from claiming privileged roles. |
| Message author takeover | Update authorization checks the proposed `request.resource.data.userId`, not the existing author, so a group member can overwrite another member's message while setting themselves as author. | Check existing author, preserve identity fields, validate update fields. |
| Message deletion denial | Delete uses `request.resource.data`, which does not exist for deletion. | Use existing `resource.data` for author checks and explicit delete policy. |
| Writes by nonmembers / former members | Goal writes require only matching user ID, not current group membership. Member update also permits self writes without validating group state/roles. | Require active authorized membership for group content and define leave/delete behavior. |
| Arbitrary notification recipients | Notification creation verifies the actor is in the group, but not that the recipient is in that group, nor that the triggering activity exists. | Server-owned fan-out, recipient membership and preference checks. |
| Unvalidated canonical data and stale mirrors | Workout create checks field presence but not types/timestamp semantics/applicability; updates can alter identity fields. User-owned group mirrors can be invented and are not authoritative membership. | Validate canonical records and immutable fields; make associations/progress/membership mirrors authoritative and idempotent. |

These are policy gaps identified from source, not evidence that anyone exploited the test project. The callable self/membership check from PR #1 is not sufficient protection while membership itself can be self-created.

## Coordinated implementation order

1. Establish deterministic emulator configuration and adversarial fixtures for outsider, member, owner and former-member access. Test proposed replacements; do not call mocked callable tests a rules audit. **Implemented in this branch; execution evidence is recorded in the PR.**
2. Replace client create/join/leave membership writes with authenticated, validated server operations. Preserve duplicate-join behavior/owner role and make membership plus user mirrors atomic. Invitation lookup must not require reading the private group collection. **Implemented in this branch.**
3. Restrict group/membership reads and writes, and remove route-triggered self-membership creation from Home/Chat/Progress/Goal screens together. Self-creation currently bypasses invitation security. **Implemented in this branch.**
4. Separate private profile/canonical workout reads from safe group presentation. Retain one canonical workout ID and explicit applicability across groups. Update MemberProfile/chat/progress queries alongside rules and introduce required indexes based on those queries. **Partially implemented: cross-user private reads are removed, group views use message projections, and new workout cards must match a canonical workout. Edit/delete projection repair remains.**
5. Enforce message ownership/field validation, goal membership, authoritative notification fan-out and account/group deletion behavior; cover retry, leave and stale membership edge cases. **Partially implemented: message/goal validators and membership-constrained notification writes are tested. Server-owned notification fan-out and deletion lifecycles remain.**

Deployment must coordinate the callable Functions and rules: deploy the new callables first, validate them against test data, then deploy rules and a client build that uses the callables. Do not deploy the rules alone against the old client.
