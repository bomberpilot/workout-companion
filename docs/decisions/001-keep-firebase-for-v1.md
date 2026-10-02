# Decision 001: keep Firebase for the production MVP

Status: accepted for v1 implementation. This decision preserves the existing product model and working backend integration; it does not certify deployed security or device behavior.

## Context

Workout Companion already uses Firebase Authentication, Firestore realtime subscriptions and Cloud Functions. The MVP needs email/password accounts, small private groups, per-member goals, one canonical workout visible in applicable groups, simple chat, account deletion and conservative activity notifications.

The source audit found authorization and data-integrity defects. None is an established Firebase capability limit. Switching databases would still require ownership/membership validation, idempotency, safe deletion, privacy-aware projections and device session testing.

## Decision

Keep Firebase Auth, Firestore and Cloud Functions for v1. Preserve React Native/Expo and React Navigation. Fix the current implementation in focused PRs rather than replacing working authentication, realtime chat and stored data.

Use authoritative server operations for security-sensitive membership/invitation changes, derived progress/activity fan-out, push delivery and account cleanup. Commit and test Firestore rules so clients cannot grant themselves group access or query private unrelated-user data. Define a canonical workout plus explicit group visibility/projections before changing the storage model. Tests and existing-data reconciliation must precede any migration.

The initial callable guard and native auth persistence fixes are bounded improvements, not substitutes for those backend changes.

## Alternatives considered

| Option | Benefit | Cost / implication |
| --- | --- | --- |
| Keep Firebase | Existing accounts, realtime SDK integration and triggers; fits the small-group MVP | Must deliberately enforce membership, scoped reads, atomic/idempotent operations and deletion; duplicated projections need ownership |
| Supabase/PostgreSQL | Foreign keys, relational queries, SQL migrations/transactions and row-level security | Replace auth/session and realtime paths, migrate data, re-test the golden path; security and deletion still require careful policy design |
| Custom API/database | Maximum control of domain endpoints and server logic | Adds infrastructure, deployment and operational work without a verified MVP requirement |

PostgreSQL would be reasonable for a new relational product. It is not a demonstrably better release path for this existing app at this point.

## Revisit conditions

Reconsider after measuring actual constraints: required relational queries that cannot be served with a small safe projection model, unacceptable operational cost/latency, or demonstrated transaction/security-rule limits after simplifying the domain. Do not migrate because the current client writes are unsafe; those writes require correction on any platform.

## Consequences and verification

- No backend-provider migration or new external service is required for the next PRs.
- Current Firebase project reported by the owner: `workout-companion-d078f`. The owner reports phone-created test workouts and bogus login accounts from a local Expo server; deployed rules and project access are not yet verified.
- Backend changes can be developed and tested in emulators with synthetic data before live-project access.
- Rules/indexes, enabled auth providers, client app configuration, deployment identity and environment separation must be reconciled before deployment.
- Signed iOS/Android builds, physical-device persistent sessions and store disclosures remain independent release gates.
