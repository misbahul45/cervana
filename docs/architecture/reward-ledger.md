# Reward Ledger from Learning Evidence

> **Status**: `stable` · **Owner**: `architect` · **Last reviewed**: `2026-10-09`
>
> How `api` grants points only for verified learning progress, records every grant in an append-only ledger with a rule id and version, and projects the ledger onto the leaderboard rows the web already reads.

Decision source: finding H-008 and audit row 9 of [gamification-audit.md](../01-audit/gamification-audit.md) and [implementation-readiness.md](../01-audit/implementation-readiness.md); the target flow named there is LearningEvent → RewardEngine → GamificationLedger → projection. Decision record: [ADR-015](../decisions/ADR-015-reward-ledger.md). Tasks: [reward-ledger-plan.md](../plans/reward-ledger-plan.md). It consumes the learning events of [learner-state-and-concept-registry.md](./learner-state-and-concept-registry.md) (ADR-014).

---

## Purpose

Defines the ledger table and its database guards, the rule catalog and its first three versioned rules, the idempotency keys, the grant and reversal procedures, the projection onto `LeaderboardScore`, the two routes (own history, admin reversal), and which existing grants are removed or rerouted.

Out of scope, each with its owner decision:

| Not covered | Why | Tracked as |
|---|---|---|
| What credits the daily streak (a chat message does today) | it decides what counts as activity; the streak bonus is moved to the ledger here, its trigger is not changed | H-008 vector 2, plan "Risks" |
| Level computed from active days | XP source of `LevelCalculationService`, not a point grant | H-008 vector 3 |
| Badges, achievements, missions, recovery and boss challenges | the achievement catalog is empty and nothing calls the evaluator; they need rule data this design only makes room for | audit row 9 remainder |
| AI narration of rewards | the Python package is a reference; the AI never writes rewards | ADR-010, Q-05 |
| Leaderboard history and rank changes over time | the projection keeps one row per scope | gamification audit |
| Points as money, creator earnings, wallets | separate ledgers already exist | payment architecture |
| The value of the rules | the numbers below are a proposal, kept as data of the catalog so the owner can change them with a new rule version | D-22 (new, `PROPOSED`) |

## Research

Sources read on 2026-10-09. The fetch and search tools return summaries; where a source was read only in part the right-hand column says so.

| Source | What it says | Consequence for this design |
|---|---|---|
| Baker, Corbett, Koedinger and Wagner, [Off-task behavior in the cognitive tutor classroom: when students "game the system"](https://hci.rwth-aachen.de/materials/conferences/CHI2004/1p383.pdf), CHI 2004 (found by search, abstract level only); the [2005 detector paper](https://learninganalytics.upenn.edu/ryanbaker/BCKR2005Final.pdf) (not read) | Gaming is behavior that tries to get correct answers or advance by exploiting the software's feedback and help; it was linked to reduced learning more strongly than other off-task behavior; detectors use signals such as the rate of help requests | A reward that pays for completing or advancing pays for gaming. Points here depend on graded evidence (`ASSESSMENT_COMPLETED`), shrink with retakes (the retake decay of `mastery-v1` reaches the reward), and a hinted attempt already counts as not demonstrated. No detector is built; hint use and repeated attempts are already inputs of the evidence |
| Deci, Koestner and Ryan, [A meta-analytic review of experiments examining the effects of extrinsic rewards on intrinsic motivation](https://pure.ewha.ac.kr/en/publications/a-meta-analytic-review-of-experiments-examining-the-effects-of-ex/), Psychological Bulletin 1999 (abstract only); Cameron, Banko and Pierce (2001) contest the reading | Over 128 experiments, engagement-contingent, completion-contingent and performance-contingent rewards undermined free-choice intrinsic motivation (d = -0.40, -0.36, -0.28); positive feedback raised it (d = 0.33). The field disputes how studies are weighted | The grant is performance-contingent (progress above the learner's previous best), small, capped per concept and explained (the reason is the rule id), never contingent on engagement or completion. The disagreement is why the numbers are data with versions, not constants in code. This does not prove the design is motivating; that needs the owner's measurement |
| Microsoft Learn, [Event Sourcing pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/event-sourcing) (read in full on 2026-10-09, see ADR-014) | Undo a change with a compensating event, never an update; consumers of at-least-once events must be idempotent; keep intent in the event | The ledger is append-only; a reversal is a new negative entry that names the entry it undoes; every grant has a key derived from its source event, so a retried or replayed event pays once |
| IETF, [The Idempotency-Key HTTP Header Field](https://www.ietf.org/archive/id/draft-ietf-httpapi-idempotency-key-header-07.html), draft 07, October 2025, expired April 2026 (found by search, not read in full) | A key must be unique and must not be reused with another payload; the server should answer 422 for reuse with a different payload; a retry that arrives while the first request runs should get a conflict | Keys are derived by the server from the event and rule, so a client cannot reuse one with another payload; a duplicate returns the stored entry. The HTTP header is not used on the grant (no client sends it); the reversal route is idempotent by its natural key (the entry id). The draft is cited as work in progress, as it asks |
| [gamification-audit.md](../01-audit/gamification-audit.md) | the specification forbids rewarding login, page views, chat messages, clicks and time on site without verified learning; the grant of step completion is repeatable and needs no evidence | the direct grant of `UserStepsRepo.complete` is removed; points come from the ledger only |

## Current state

Measured on the working tree of 2026-10-09 after RC-14 and RC-15.

| # | Fact | Evidence | Consequence |
|---|---|---|---|
| 1 | Completing a user step adds 10 points to three `LeaderboardScore` rows (`g-{user}`, `t-{user}-{topic}`, `st-{user}-{subTopic}`); RC-14 made it once per step, but it needs no evidence and no record of why | `user-steps.repo.ts` `awardStepPoints` | a learner can complete steps without learning anything |
| 2 | Every seventh consecutive active day adds 50 to GLOBAL through `LeaderboardsRepo.incrementScore`, which finds the row by `(userId, scope)` and creates one with a random id when none exists | `streaks.repo.ts`, `leaderboards.repo.ts` | a second GLOBAL row can exist next to `g-{user}`; two concurrent first activities can credit twice |
| 3 | `User.totalPoints` is declared and never written; the web reads `LeaderboardScore` | `schema.prisma`, grep of `totalPoints` in `src` | the leaderboard rows are the only points store |
| 4 | There is no ledger, rule id, rule version, idempotency key or reversal | gamification audit | a grant cannot be explained, deduplicated or undone |
| 5 | `LearningEvent` now has a writer and a per-learner stream with the mastery after each event | ADR-014 | the evidence exists; row 9 no longer waits for row 3 |
| 6 | `forbid_row_mutation` exists for the money ledgers and raises on UPDATE and DELETE | `20260930040500_domain_foundation` | a gamification ledger must not use it as is: deleting a learner cascades to their entries, and a trigger that forbids DELETE would block erasure |

## Conceptual model

```
LearningEvent (ASSESSMENT_COMPLETED, ADR-014)
   | same transaction as the append, under the learner's stream lock
   v
RewardEngine  --- rules (catalog, versioned) ---> RewardGrant { ruleId, version, points, key, concept }
   v
RewardLedgerService.grant  (idempotent insert; append only)
   v
GamificationLedger  (+ reversal entries)
   v  projection, same transaction
LeaderboardScore  GLOBAL g-{user}  /  TOPIC t-{user}-{topic}  /  SUBTOPIC st-{user}-{subTopic}
```

Invariants:

1. **Ledger first.** A point is on the leaderboard only if a ledger entry carries it, except the legacy points that predate the ledger (the earlier step grants), which stay where they are and are never recomputed.
2. **Evidence first.** The only rule that pays on activity is the legacy streak bonus, kept for compatibility and flagged; every other rule needs a learning event with a graded result.
3. **Once per cause.** Every entry has a unique key derived from its cause; a second attempt to grant the same cause returns the first entry.
4. **Bounded.** Each concept can pay at most 100 points in total (50 for progress, 50 for passing), so the total is bounded by 100 times the number of concepts, whatever the learner does.
5. **Append only.** An entry is never updated; a mistake is undone by a reversal entry that equals minus the original, names it, and can exist once.
6. **Same transaction.** Event, mastery, grant and projection commit together or not at all.
7. **api only.** `ai-api` has no route to the ledger and no grant path; it can read the history through `GET /gamify/rewards/me` only as the learner.

## Schema

```prisma
model GamificationLedger {
  id             String   @id @default(uuid())
  userId         String
  ruleId         String
  ruleVersion    Int
  points         Int
  idempotencyKey String   @unique
  sourceType     String
  sourceId       String?
  conceptId      String?
  topicId        String?
  subTopicId     String?
  reversalOf     String?  @unique
  reason         String?
  actorId        String?
  createdAt      DateTime @default(now())
  user           User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  concept        Concept? @relation(fields: [conceptId], references: [id])
  original       GamificationLedger?  @relation("Reversal", fields: [reversalOf], references: [id])
  reversal       GamificationLedger?  @relation("Reversal")

  @@index([userId, createdAt])
  @@index([userId, ruleId, conceptId])
}
```

Hand-written migration tail:

- `CHECK (points <> 0)` and `CHECK ((reversalOf IS NULL AND points > 0) OR (reversalOf IS NOT NULL AND points < 0))`.
- `CHECK (reversalOf IS NULL OR (reason IS NOT NULL AND actorId IS NOT NULL))`.
- Trigger `gamification_ledger_no_update`: rejects every `UPDATE`. `DELETE` stays allowed so that deleting a learner erases their entries; the application never deletes.
- Trigger `gamification_ledger_reversal_matches` (before insert): when `reversalOf` is set, the original must exist, belong to the same user, not be a reversal itself, and `points` must equal minus the original's points; otherwise the insert fails.

`LeaderboardScore` is unchanged. Its synthetic ids are the projection keys.

## Algorithms

### Rule catalog

A rule is data plus a pure function. The catalog lives in `gamify/rewards/reward-rules.ts`; changing a number means a new `version` of that rule, and old entries keep the version that produced them.

| Rule | Version | Trigger | Points | Key |
|---|---|---|---|---|
| `MASTERY_PROGRESS` | 1 | each new `ASSESSMENT_COMPLETED` | `max(0, floor(100 × (scoreAfter − 0.5)) − alreadyPaid)` where `alreadyPaid` is the sum of this rule's grants (reversals not counted, so a grant that an admin reversed is never paid again) for the learner and the concept | `reward:MASTERY_PROGRESS:v1:{eventId}` |
| `CONCEPT_PASSED` | 1 | the concept is passed after the event (`score >= 0.7` and at least 3 events, the thresholds of the policy) | 50, once per learner and concept | `reward:CONCEPT_PASSED:v1:{userId}:{conceptId}` |
| `STREAK_BONUS_7` | 1 | the streak reaches a multiple of seven days | 50 (legacy, activity based, flagged) | `reward:STREAK_BONUS_7:v1:{userId}:{yyyy-mm-dd}` |

Properties that follow from the formula and are tested:

- The cumulative `MASTERY_PROGRESS` of a concept equals `floor(100 × (peak − 0.5))`, where `peak` is the highest score reached, and never exceeds 50, so failing and regaining the score pays nothing until the old peak is passed.
- Retakes pay little: the mastery weight halves per retake, so eight retakes of one quiz stay below the pass mark and below 20 points in total.
- A failed attempt, a hinted attempt (graded as not demonstrated and recorded as no event) and a quiz without approved concept links pay nothing.
- A reference run from a fresh learner, five perfect five-question attempts on one concept: scores 0.6225, 0.7026, 0.7558, 0.7929, 0.8198 give progress grants 12, 8, 5, 4 and 2 (cumulative 31, because the last score is 0.8198 and the formula floors) and a pass grant of 50 at the third attempt, 81 in total.

### Grant

1. The caller passes the transaction it already holds. The grant is only called after the event append, so the learner's stream row is locked and no second grant for the same learner runs concurrently.
2. Insert the entry with `skipDuplicates` (`ON CONFLICT DO NOTHING` on `idempotencyKey`). A conflict means the cause was already paid: return the stored entry and change nothing.
3. If inserted, add the points to the three projection rows with one `INSERT ... ON CONFLICT (id) DO UPDATE SET score = score + EXCLUDED.score` each: GLOBAL always, TOPIC when `topicId` is known, SUBTOPIC when `subTopicId` is known.
4. After the commit, the three updated rows are published on the leaderboard emitter, as other leaderboard writes do.

### Reversal

`POST /gamify/rewards/ledger/{id}/reverse`, role ADMIN, body `{ reason }` (3 to 500 characters, strict). In one transaction: load the entry (404 unknown); if a reversal of it exists return it with 200; refuse to reverse a reversal (409); insert the compensating entry (`points = -original.points`, `reversalOf`, `reason`, `actorId`, key `reward:REVERSAL:{id}`); subtract the points from the same projection rows; write an `AuditLog` entry `REWARD_REVERSED` with the entry before and after. A concurrent second request hits the unique `reversalOf` and receives the first reversal.

### Reading

`GET /gamify/rewards/me?limit=` (default 20, maximum 100): the caller's entries, newest first, with `balance` (the sum of the caller's entries, reversals included). The balance counts ledger entries only, not the legacy leaderboard points.

### Removed and rerouted grants

- `UserStepsRepo.complete` no longer awards points. It still marks the step done once, unlocks the next step and returns the row.
- `StreaksRepo.incrementOrReset` grants `STREAK_BONUS_7` through the ledger instead of `LeaderboardsRepo.incrementScore`, which makes the grant idempotent per day and moves it to the `g-{user}` row. `incrementScore` is no longer called by the streak code.

## Trade-offs

| Option | Verdict |
|---|---|
| A. Keep the direct step grant and add the ledger beside it | rejected: it keeps the evidence-free grant that H-008 names |
| B. Pay a fixed amount per graded attempt | rejected: retakes and easy quizzes would be farmed; the progress above the previous best is bounded by construction |
| C. Pay on the score of the attempt | rejected for the same reason, and because it rewards the quiz rather than the learning |
| D. Compute points by replaying the whole event stream (no ledger) | rejected: rules change, and a past grant must not change with them; the ledger stores what was granted under which rule version |
| E. Asynchronous reward consumer through a queue | rejected for now: it adds a consumer that can lag or skip; one learner event produces at most two entries |
| F. Reuse `forbid_row_mutation` | rejected: it forbids DELETE, which blocks erasing a learner |
| G. Foreign key from the entry to `LearningEvent` | not chosen: `ON DELETE SET NULL` needs an update the trigger forbids, and cascade would delete history of other rules; the source id is a plain reference, and the event stream is the audit trail |
| H. Recompute leaderboard rows from the ledger | not done: legacy points have no ledger entries; a reconciliation view per learner is a follow-up |
| I. Remove the streak bonus | not chosen here: it is a product rule, not a defect; it moves to the ledger and is flagged as activity based so the owner can retire it (D-22) |
| J. Change what credits the streak now | not chosen: a separate decision about activity; see "Out of scope" |

Residual risks: learners who earned points through completion before this change keep them (no ledger entry exists for those); the removal of the step grant lowers the points a learner earns until quizzes are linked to concepts, because only linked quizzes produce evidence (in the dev data no quiz exists); the numbers are a proposal; legacy GLOBAL rows with random ids may sit beside `g-{user}` and are not merged here.

## Migration notes

- **Database**: one migration with the table and the tail above, checked on the scratch database first, then `migrate deploy` on the dev database (dumped first).
- **Order**: schema and ledger service, then the rule engine, then the quiz hook, then removal of the step grant and the streak reroute, then the routes. The step grant is removed in the same release as the hook so that the learner never has no source of points.
- **Behavior change to confirm with the owner**: completing a step no longer adds points; points come from graded concept progress.
- **Rollback**: the table can stay; restoring the previous images restores the step grant; ledger entries written meanwhile stay as history and the projection rows keep their sums.

## Verification

Run on 2026-10-09 and 2026-10-10 against the scratch database `reducera_ls_scratch` and the live dev stack.

| Check | Result |
|---|---|
| `prisma migrate diff` after `migrate deploy`, scratch and dev | empty |
| `services/api` `pnpm jest --ci --silent` | 131 suites, 1421 tests passed (18 integration suites skip without a database) |
| same with `TEST_DATABASE_URL` on the scratch database, `--runInBand` | 148 suites, 1636 tests passed |
| `services/ai-api` `uv run pytest -q` | 662 passed (647 before; 15 new gate tests) |
| `scripts/check-ownership-rules.sh` | PASS, with the new gate "reward ledger written outside the reward ledger service" |
| Mutants that the tests killed | no-update trigger dropped, reversal trigger dropped (twice: a unique index had masked it in the first version of the test), progress cap 50 to 60, already-paid subtraction removed, pass evidence threshold removed, projection skipped on duplicate, projection overwrite instead of add, reversal without projection, reward call outside the grading transaction, `@Roles(ADMIN)` removed, internal fields returned to the learner |
| Live, student with a lesson quiz linked to `l2-t01-balance-sheet`: perfect attempt | 4 points (hand computed: score 0.5498, floor(4.98) = 4), ledger entry with rule `MASTERY_PROGRESS` v1 and key `reward:MASTERY_PROGRESS:v1:{eventId}`, rows GLOBAL, TOPIC and SUBTOPIC at 4 |
| Live: second submit of the same attempt | 409, no entry added |
| Live: perfect retake, then a failed attempt | 3 points (target floor(7.10) = 7 minus 4 paid), then 0; rows at 7, ledger balance 7 |
| Live: `POST /learning/user-steps/complete/{id}` | step done, 201, rows still 7, a second completion 409 |
| Live: reversal | student 403, anonymous 401, admin with an extra field 400, admin 200 with `-4` and `duplicate: false`, again 200 with the same entry and `duplicate: true`, balance 3 |
| Live: `UPDATE "GamificationLedger"` by SQL | rejected, "GamificationLedger is append-only" |
| Live: deleting the test learner | their ledger entries were erased by the cascade (count 0) |
| Fixtures | test student, admin, quiz and user step were deleted afterwards; the registry (65 concepts) stays |

Defects found while verifying live and fixed here:

- `ActivityDetectorInterceptor` ran its recording in an `async` callback of `tap` that nothing awaited, so any failure (a validation error, a database error) became an unhandled promise rejection and stopped the whole `api` process. It happened when the test learner had a non-UUID id: the container exited and restarted in the middle of the check. The recording now catches its own failure and logs a warning; `daily-activity.interceptor.spec.ts` has two tests that fail on the old code. After the fix the same request logs the warning and the container keeps running (restarts 0).
- The first test of the ledger service used fixed idempotency keys and a cleanup that tried to delete append-only audit rows, so a failed run left rows behind; keys are per learner now and the cleanup leaves the audit log alone.

Not verified: a real learner with a UUID id and a quiz authored by the platform (the dev database has no quiz; the check used one inserted for the test), the web leaderboard pages (they read `LeaderboardScore` as before; no component was changed), realtime leaderboard events for ledger grants (the ledger does not publish them, as the step grant did not), behavior of the legacy random-id GLOBAL rows, and the weight of the numbers for motivation.

## Evidence citations

- `services/api/src/v1/learning/user-steps/user-steps.repo.ts` (`complete`, `awardStepPoints`), `services/api/src/v1/gamify/streaks/streaks.repo.ts` (`incrementOrReset`), `services/api/src/v1/gamify/leaderboards/leaderboards.repo.ts` (`incrementScore`)
- `services/api/prisma/schema.prisma` (`LeaderboardScore`, `User.totalPoints`), `prisma/migrations/20260930040500_domain_foundation/migration.sql` (`forbid_row_mutation`)
- `services/api/src/v1/learner-model/{events,mastery,policy}` and `v1/quiz/quiz-attempts/quiz-attempts.service.ts` (ADR-014)
- `docs/01-audit/gamification-audit.md`, `docs/01-audit/implementation-readiness.md` row 9
