# ADR-015: Reward ledger fed by learning evidence

- Status: accepted by the owner on 2026-10-09 (the owner asked for the reward ledger as the implementation after the learner state)
- Date: 2026-10-09

## Context

Points come from two places that need no evidence of learning: a repeatable-once grant of 10 points when a step is completed, and a 50 point bonus every seventh active day. Neither leaves a record of its cause, rule or version, neither can be undone, and the streak path can create a second GLOBAL row. `GamificationLedger` is listed in `AGENTS.md` as a protected table and does not exist (finding H-008, audit row 9). The learner events of ADR-014 now provide verified evidence.

## Decision

1. `api` keeps an append-only `GamificationLedger`: one entry per grant, with rule id, rule version, points, a unique idempotency key derived from the cause, the source, the concept and its topic and sub-topic, and for a reversal the entry it undoes, a reason and the actor. A database trigger rejects every UPDATE; DELETE stays possible only so that deleting a learner erases their entries. A second trigger checks that a reversal equals minus its original, for the same learner, once.
2. A rule catalog in code defines versioned rules as data plus a pure function. Version 1: `MASTERY_PROGRESS` (points for the progress of the concept score above half, paid once per unit of progress, at most 50 per concept), `CONCEPT_PASSED` (50, once per concept) and `STREAK_BONUS_7` (50, the legacy activity based bonus, flagged). The values are a proposal (D-22); a change is a new rule version.
3. A reward engine evaluates the rules in the same transaction as the learning event append, under the learner's stream lock, and the ledger service projects each grant onto the `LeaderboardScore` rows GLOBAL, TOPIC and SUBTOPIC with the existing synthetic ids.
4. The direct grant of `UserStepsRepo.complete` is removed. The streak bonus is granted through the ledger, idempotent per day.
5. Learners read their own entries and balance (`GET /gamify/rewards/me`); an admin reverses an entry through an intent route (`POST /gamify/rewards/ledger/{id}/reverse`) that is idempotent, audited and writes a compensating entry.
6. Only `RewardLedgerService` writes the ledger; `scripts/check-ownership-rules.sh` fails on another writer.

## Consequences

- Every point from now on has a rule, a version and a cause, and repeating the cause pays nothing; the total per concept is bounded.
- Completing a step no longer adds points; learners earn points through graded progress on concepts that approved links connect to quizzes. This is a behavior change for the owner to confirm.
- Points granted before the ledger stay on the leaderboard without entries, so the ledger balance and the leaderboard can differ for existing learners.
- The streak path still rewards activity, and the level still measures active days; both stay open under H-008.
- Design: `docs/architecture/reward-ledger.md`; tasks: `docs/plans/reward-ledger-plan.md`.
