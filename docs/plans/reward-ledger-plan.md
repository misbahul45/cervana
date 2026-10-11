# Reward Ledger — Implementation Plan

> **Status**: `stable` · **Owner**: `architect` · **Last reviewed**: `2026-10-09`
>
> Ordered tasks that make every point a ledger entry caused by learning evidence, and remove the evidence-free grant.

Design: [reward-ledger.md](../architecture/reward-ledger.md). Decision: [ADR-015](../decisions/ADR-015-reward-ledger.md). Closes the step grant and the missing ledger of audit finding H-008 and row 9 (rules, ledger, engine); the streak trigger, the level source, badges and missions stay open.

---

## Objective

After this plan a graded quiz attempt can pay points only for concept progress above the learner's previous best, every grant is a ledger entry with a rule, a version and a unique cause, an admin can reverse an entry, and completing a step pays nothing by itself.

## Scope

| Service | Created | Edited |
|---|---|---|
| `services/api` | `src/v1/gamify/rewards/{reward-rules,reward-engine.service,reward-ledger.service,rewards.controller,rewards.module}.ts`, one migration, specs, `__tests__/*.int.spec.ts` | `prisma/schema.prisma`, `quiz-attempts.service.ts` and module, `user-steps.repo.ts` and its specs, `streaks.repo.ts` and module and specs, `gamify.module.ts`, `test/schema-snapshot` if needed, `AUTHORIZATION_MATRIX.md` |
| repo | none | `AGENTS.md`, `scripts/check-ownership-rules.sh` and its gate test, `docs/progress-tracker.md`, `docs/strategy/decision-register.md`, memory |

Rules for every task: no comments in code or configuration; never `git add`, `commit` or `push`; never `prisma format`; database tests only on the scratch database; recreate compose services with `--no-deps`; each task starts with the failing test.

Baselines before this plan (2026-10-09): `services/api` `pnpm jest --ci --silent` 1350 passed (1535 with the scratch database); `services/ai-api` `uv run pytest -q` 647 passed; `scripts/check-ownership-rules.sh` PASS.

## Step-by-step

| ID | Task | Verify |
|---|---|---|
| IMPL-RL-01 | Schema and migration: `GamificationLedger`, checks, no-update trigger, reversal trigger. Integration spec first: non-zero points, sign rules, reversal needs reason and actor, UPDATE rejected, DELETE of the learner allowed, a reversal must equal minus the original, same learner, original not a reversal, one reversal per entry, duplicate key rejected | `migrate diff` empty on the scratch database; `pnpm jest src/v1/__tests__/reward-ledger-schema.int` with two mutants (trigger dropped) killed |
| IMPL-RL-02 | `reward-rules.ts`: the three rules as pure functions with their keys. Spec first with the reference run (progress 12, 8, 5, 4, 2 and a pass grant of 50 at the third attempt), the peak property, the cap of 50, the key formats | `pnpm jest src/v1/gamify/rewards/__tests__/reward-rules` |
| IMPL-RL-03 | `RewardLedgerService`: idempotent grant with projection, reversal with projection and audit, history and balance. Integration spec first: first grant projects to three rows, duplicate key changes nothing, concurrent equal keys pay once, reversal restores the sums, second reversal returns the first, reversal of a reversal refused, unknown entry, history order and balance | `TEST_DATABASE_URL=... pnpm jest src/v1/__tests__/reward-ledger.int`; mutants killed (projection skipped, duplicate not detected) |
| IMPL-RL-04 | `RewardEngineService.onAssessment`: evaluates the rules for one event and calls the ledger. Unit spec first with fake collaborators: duplicate append pays nothing, a fail pays nothing, a peak is not paid twice, a pass is paid once, attribution passed through | `pnpm jest src/v1/gamify/rewards` |
| IMPL-RL-05 | Quiz hook: after the append, call the engine inside the grading transaction, with topic and sub-topic of the quiz. Unit and integration spec first: a lesson quiz submission produces events, ledger entries and leaderboard rows; five perfect attempts give 81; a retake pays less; a hinted attempt pays nothing; a failing engine rolls the submission back | `pnpm jest src/v1/quiz`; `src/v1/__tests__/quiz-evidence.int` |
| IMPL-RL-06 | Remove the step grant from `UserStepsRepo.complete` (spec first: completion writes no leaderboard row) and route the streak bonus through the ledger (spec first: grant key per day, `incrementScore` not called) | `pnpm jest src/v1/learning/user-steps src/v1/gamify` |
| IMPL-RL-07 | Routes and module: `GET /gamify/rewards/me`, `POST /gamify/rewards/ledger/{id}/reverse`; HTTP spec first (own rows only, admin only, strict body, idempotent reversal, audit); matrix updated | `pnpm jest src/v1/gamify/rewards src/common/authz` |
| IMPL-RL-08 | Gate and docs: `scripts/check-ownership-rules.sh` rule for ledger writers with its test, `AGENTS.md` section, tracker, decision register D-22, memory | `bash scripts/check-ownership-rules.sh`; `uv run pytest -q __tests__/test_ownership_gate_reward_writes.py` |
| IMPL-RL-09 | Deploy and live checks: tag images `pre-rl-20261009`, dump the dev database, `migrate deploy`, rebuild and recreate `api` with `--no-deps`; as a test learner: submit quizzes, read the history, check the leaderboard rows, reverse an entry as admin, attempt an UPDATE and a duplicate, complete a step and see no points; delete the fixtures | the checks of the list; both suites green; logs clean |

## Acceptance criteria

1. Every ledger entry has a rule id, a rule version, a unique key and a nonzero amount; an UPDATE of an entry fails in the database.
2. Submitting the same attempt twice, replaying the same event key, or granting the same cause concurrently pays once.
3. Five perfect five-question attempts on one concept pay 81 points in total; eight retakes of one quiz pay fewer than 20 and no pass grant.
4. The GLOBAL, TOPIC and SUBTOPIC rows rise by exactly the ledger amounts, and a reversal lowers them by the same amounts.
5. Completing a user step adds no leaderboard points.
6. A learner reads only their own entries; only an admin can reverse; a second reversal returns the first.
7. `api` and `ai-api` suites pass, the ownership gate passes, the stack is healthy and the logs are clean.

## Risks

| Risk | Severity | Mitigation |
|---|---|---|
| learners earn nothing for steps until quizzes are linked to concepts | Medium | flagged for the owner; the dev data has no quiz, so the live check creates one; linking quizzes is an authoring task |
| projection and ledger drift | High | same transaction; integration spec asserts the sums after grants and reversals; legacy points are outside the invariant and documented |
| a rule change rewrites history | Medium | the version is stored on every entry and a changed rule is a new version |
| reward engine failure blocks a graded submission | Medium | by design the submission rolls back, so that no evidence exists without its reward and no reward without its evidence; the failure is visible to the caller |
| legacy random-id GLOBAL rows | Low | not merged here; new points go to the synthetic id; listed as a follow-up |

## Rollback

- Images before this change: `reducera-api:pre-rl-20261009`; retag and `docker compose up -d --no-deps api`.
- Database: the migration only adds a table, checks and two triggers; leave them in place. Entries written meanwhile stay as history.

## Progress

| Task | Status | Evidence |
|---|---|---|
| IMPL-RL-01 | [x] | model, migration `20261009130000_gamification_ledger` with checks and two triggers; `reward-ledger-schema.int.spec.ts` 8 tests; both triggers proved by dropping them (one test was strengthened because a unique index masked the missing reversal trigger) |
| IMPL-RL-02 | [x] | `reward-rules.ts`; 23 tests including a property over 40 random sequences (total progress equals floor(100 x (peak - 0.5))); reference run 12, 8, 5, 4, 2 and 50, total 81 (the first draft said 3 and 82 because it used the rounded score 0.82; the test uses the real 0.8198); three mutants killed |
| IMPL-RL-03 | [x] | `RewardLedgerService`; `reward-ledger.int.spec.ts` 16 tests including 6 concurrent equal keys, 15 concurrent grants, 5 concurrent reversals and a 30 step invariant (global row equals ledger sum); three mutants killed |
| IMPL-RL-04 | [x] | `RewardEngineService`; 8 unit tests; paid is counted without reversals so a reversed grant is not paid again |
| IMPL-RL-05 | [x] | hook in `submitAttempt`; 6 new unit tests and 4 integration tests (first attempt, retakes, nothing for fail, hint or unapproved link, rollback of attempt, event and reward together); mutant (reward outside the transaction) killed |
| IMPL-RL-06 | [x] | `awardStepPoints` and the unused leaderboard dependency removed from `UserStepsRepo`; `StreaksRepo` grants `STREAK_BONUS_7` through the ledger (7 new tests); user-steps specs updated |
| IMPL-RL-07 | [x] | `RewardsController` (`GET /gamify/rewards/me`, `POST /gamify/rewards/ledger/{id}/reverse`), module and router entry; 15 controller tests with two mutants killed; matrix updated; route-access spec green |
| IMPL-RL-08 | [x] | gate in `check-ownership-rules.sh` with `test_ownership_gate_reward_writes.py` (7 tests); `AGENTS.md` "Rewards" section; decision register D-22; tracker RC-16 |
| IMPL-RL-09 | [x] | image tagged `pre-rl-20261009`, dev database dumped, migration deployed, `api` rebuilt and recreated with `--no-deps` twice (the second for the interceptor fix); live checks in the design doc ("Verification"); one crash defect found and fixed |
