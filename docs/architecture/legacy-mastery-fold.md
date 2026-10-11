# Folding the Legacy Mastery Path

> **Status**: `stable` · **Owner**: `backend-lead` · **Last reviewed**: `2026-10-10`
>
> How the topic level EMA (`TopicMasteryRecord`), its skill nodes and its `personalization/*` routes are retired so that the concept projection of ADR-014 is the only mastery in the system.

Decision source: ADR-010 (one mastery, one policy) left partly open by [ADR-014](../decisions/ADR-014-concept-registry-and-event-sourced-mastery.md). Decision record: [ADR-017](../decisions/ADR-017-retire-topic-mastery-ema.md). Tasks: [legacy-mastery-fold-plan.md](../plans/legacy-mastery-fold-plan.md). Concept model: [learner-state-and-concept-registry.md](./learner-state-and-concept-registry.md).

---

## Purpose

Defines what replaces each reader and writer of `TopicMasteryRecord` and `SkillNode`, the one new read time computation (the topic aggregate), the route and web changes, and what is kept.

Out of scope, each with its owner decision:

| Not covered | Why | Tracked as |
|---|---|---|
| Dropping the tables `TopicMasteryRecord` and `SkillNode` | a destructive migration of data the owner has not agreed to lose; the code stops reading and writing them and a gate keeps it that way | owner decision after one release |
| The misconception routes and services | need the misconception ontology in `api` first | IMPL-LS-12 |
| The learner home page of `pages/learn/profile/dashboard.vue` | it renders hard coded numbers and never called the API; replacing it is a product design task, not a fold | finding F-01 below |
| The topic aggregate threshold and rule | a proposal until the owner confirms | D-23 |

## Research

| Source | What it says | What this design takes |
|---|---|---|
| [Khan Academy help, "What are Course and Unit Mastery?"](https://support.khanacademy.org/hc/en-us/articles/115002552631), read through a search result summary only | each skill is worth 100 mastery points, a unit shows the points available (100 per skill), a course shows the share of its points earned; points can drop after a wrong answer | the unit score is points earned over points available, so a skill the learner has not touched counts as zero, never as the prior. The topic score is the mean of its concepts' scores with unseen concepts at zero |
| ALEKS (class reports and the knowledge space overview found by search; the sources do not define a percent figure) | topics are reported as mastered, not yet mastered or ready to learn | the skill node state is a three way label derived from the prerequisite graph and the score, computed on read; no percent definition is taken from ALEKS |
| ADR-014 and its Microsoft and Fowler sources | a projection is a cache and a second writer of the same fact is a defect | the EMA cannot stay as a second writer of mastery |

Not opened: the Khan Academy page itself and any ALEKS documentation of its percent figure.

## Current state

| # | Fact | Evidence | Consequence |
|---|---|---|---|
| 1 | `QuizAttemptsService.submit` still calls `MasteryService.updateFromAttempt` (EMA, alpha 0.3) for quizzes with a `topicId`, after the transaction, and returns `updatedMastery` | `quiz-attempts.service.ts:198-203` | two mastery numbers for one quiz |
| 2 | `TopicMasteryBackfillService` rewrites `TopicMasteryRecord` from average step progress, with no assessment | `learner-model/topic-mastery-backfill.service.ts`, route `POST /learner-model/backfill/topic-mastery` | mastery manufactured from clicking through steps, the same defect class as the evidence free reward grant |
| 3 | `CreatorEligibilityService` decides whether a learner may apply as a creator from `TopicMasteryRecord.score >= 0.85` | `teacher/eligibility/creator-eligibility.service.ts`, `teacher/applications/applications.service.ts:43` | an access decision rests on the legacy record |
| 4 | Marketplace recommendations average `TopicMasteryRecord` scores | `marketplace/marketplace-discovery.controller.ts:24` | personalization rests on the legacy record |
| 5 | Admin `top-topics` groups `TopicMasteryRecord` by topic | `analytics/admin/admin-analytics.controller.ts:38` | analytics rest on the legacy record |
| 6 | `personalization/mastery/me`, `personalization/policy/next` and `personalization/skill-nodes/me` serve the legacy record, the old navigation policy (never matched concept ids) and `SkillNode` rows written as a side effect of the EMA | `v1/personalization/{mastery,policy,skill-node}` | duplicates of `learner-model/me/{mastery,next}` |
| 7 | The web reads `personalization/mastery/me` in `pages/student/dashboard.vue` and `pages/my-learning/mastery/index.vue` and prints the topic uuid as the label; `listSkillNodes`, `nextActivity` and `listMisconceptions` are defined in `lib/api.ts` and called by no page | `apps/web/app` grep | only two pages need a new source |
| 8 | Dev database: `TopicMasteryRecord` 0, `SkillNode` 0, `MasterySnapshot` 0, `Quiz` 0, `TeacherApplication` 0 (2026-10-10) | `psql` counts | no data to migrate; the legacy tables stay readable |
| 9 | The scheduled analytics job `SnapshotService.snapshotMastery` copies `TopicMasteryRecord` into `MasterySnapshot` (`topicId`, no foreign key); nothing reads `MasterySnapshot` | `analytics/snapshots/snapshot.service.ts` | a job that would snapshot a table nobody writes any more |
| F-02 | `route-catalog.json` is a generated file that already lacked every route added since RC-15; it is not regenerated here | `grep -c` on the file | regenerate with `services/api/scripts/build-route-catalog.js` when the owner wants the diff |
| F-01 | `pages/learn/profile/dashboard.vue` shows a fixed next activity, a fixed level of 62 and a fixed streak of 4 | the file | a user sees invented progress; reported, not changed here |

## Decisions

1. **The EMA stops.** `QuizAttemptsService` no longer calls `MasteryService`; `updatedMastery` leaves the response. The evidence appended inside the grading transaction is the only mastery write.
2. **The backfill is removed.** No code derives mastery from step progress.
3. **Topic aggregate, computed on read.** `topicConceptIds(topicId)` is the union of the approved links of the topic's sub-topics and of their lessons, restricted to active concepts. `topicMastery(userId, topicId)` returns `score` = mean of the concept scores with an unseen concept counted as 0, `passedConcepts` (score at least `PASS_SCORE` and evidence at least `PASS_EVIDENCE`), `totalConcepts`, `evidenceCount`, `lastEventAt`. A topic without approved concepts has `score: null` and is never eligible.
4. **Creator eligibility** (proposal D-23): eligible when `totalConcepts > 0`, every concept has passed and the mean is at least 0.85 (the existing threshold). One strong concept cannot carry a topic and a single quiz cannot reach it.
5. **Marketplace recommendations** use the mean score of the concepts that have evidence (zero without evidence), which is what "average mastery" meant for attempted topics.
6. **Admin analytics**: `top-topics` becomes `top-concepts` (concept id, title, learners, average score) because the topic aggregate is per learner and a group by over it would need a join per learner for no reader. The web caller changes with it.
7. **Skill nodes are derived.** `GET /learner-model/me/skill-nodes` computes `LOCKED`, `AVAILABLE`, `IN_PROGRESS` or `MASTERED` per concept from the prerequisite graph and `ConceptMastery`; nothing is stored. The old constants are kept (`PREREQ_THRESHOLD` 0.7 becomes `PASS_SCORE`, `MASTERY_THRESHOLD` 0.9 stays as a read time constant).
8. **Routes.** `personalization/mastery`, `personalization/policy` and `personalization/skill-nodes` are deleted with their modules, repos and specs; `personalization/misconceptions` and `personalization/memory` stay. The web maps `listMastery` to `learner-model/me/mastery`, shows the concept title and keeps the pages' layout.
9. **Snapshots follow the concept.** `snapshotMastery` reads `ConceptMastery` rows with evidence and writes `MasterySnapshot.conceptId`; migration `20261010100000_mastery_snapshot_concept` renames the column and its index. The table had no rows and no reader; a database that holds rows written before this migration keeps topic ids in the renamed column and must be checked by the owner before deploying.
10. **The server says passed and mastered.** `GET /learner-model/me/mastery` entries carry `passed` (score at least 0.7 and at least 3 evidences) and `mastered` (passed and score at least 0.9), so the web does not copy the rule.
11. **Tables stay.** `TopicMasteryRecord` and `SkillNode` remain in the schema, unread and unwritten. `scripts/check-ownership-rules.sh` fails when code outside `prisma/` references either model.

## Algorithms

Topic aggregate, `rows` are the learner's `ConceptMastery` rows:

```
ids      = topicConceptIds(topicId)
score    = ids.empty ? null : sum(over ids of rows[id]?.score ?? 0) / ids.length
passed   = count of ids with rows[id].score >= PASS_SCORE and rows[id].evidenceCount >= PASS_EVIDENCE
eligible = ids.nonEmpty and passed == ids.length and score >= 0.85
```

Skill node state per concept `c`, `prereqs` the active prerequisites of `c`:

```
if any prerequisite has not passed        -> LOCKED
else if no evidence for c                 -> AVAILABLE
else if score >= 0.9 and passed(c)        -> MASTERED
else                                      -> IN_PROGRESS
```

Consequence of the rule worth the owner's attention (D-23): under `mastery-v1` a concept reaches 0.85 after seven perfect assessments (five give 0.8198, seven give 0.8560; checked by the fold and by the integration spec), so a creator needs seven flawless assessments on every concept of the topic. The old threshold was set for an EMA where one high score was enough.

## Trade-offs

| Alternative | Verdict |
|---|---|
| Keep the EMA as a second view for the web | rejected: the second number is the defect ADR-010 closes |
| Treat an unseen concept as the prior 0.5 in the topic mean | rejected: a topic would look half learned before the first quiz; Khan counts untouched skills as zero |
| Weight the topic mean by confidence | deferred: no data to calibrate; the mean is explainable in one line |
| Store the topic aggregate | rejected: a cache of a cache; the registry read is small (65 concepts) |
| Drop the tables now | rejected: owner decision |
| Keep `top-topics` and compute a per learner aggregate in SQL | rejected: no reader needs it |

## Migration notes

No schema change. Deploy order: `api`, then `web` (the new route exists before the web calls it). Rollback: the images tagged before deploy; the tables were never touched.

## Verification

Checked on 2026-10-10 on the dev stack with fixture learners and an admin (all deleted afterwards; `LearningEvent`, `ConceptMastery`, `GamificationLedger`, `QuizAttempt`, `User` and the fixture curriculum are back to zero rows).

| Check | Result |
|---|---|
| Unit and integration | api `jest` 1665 passed and 5 skipped with the scratch database (`--runInBand`; the suite needs only `TEST_DATABASE_URL`, exporting the whole root `.env` makes `manual-payment.provider.spec.ts` read `MANUAL_PAYMENT_ACCOUNTS`); web `vitest` 179 passed; ownership gate PASS; `tsc` clean |
| Mutation checks | 6 mutants of the aggregate, 5 of the registry SQL and state service, 4 of the web helper, 3 of the gate: all killed |
| Submission response | no `updatedMastery`; legacy tables stay at 0 rows after seven submissions |
| Eligibility on real evidence | five perfect five-question quizzes: score 0.8198, passed 1/1, not eligible; seven: 0.8560, eligible; a topic with a second, untouched concept: 0.4099 then 0.4280 (1/2 passed), not eligible |
| Fixture quizzes of two questions | five perfect submissions gave 0.6822 (item weight `2/5 = 0.4`), not passed; this is the fold working as designed |
| Skill nodes | `t01` `IN_PROGRESS` at 0.856, `t02` `AVAILABLE`, `t03` `LOCKED`; with `t01` at 0.6822 `t02` stayed `LOCKED` |
| Recommendations | `averageMastery` 0.8560, difficulty `ADVANCED` |
| Admin | `top-concepts` answers title, 2 learners, mean 0.7691 (the mean of 0.8560 and 0.6822); a student gets 403 |
| Snapshot job | `POST /analytics/snapshots/run` wrote `MasterySnapshot` rows with `conceptId` and the right scores; the three engagement rows it also writes were removed |
| Removed routes | `personalization/mastery/me`, `policy/next`, `policy/me`, `skill-nodes/me`, `learner-model/backfill/topic-mastery`, `analytics/admin/top-topics` answer 404; `personalization/misconceptions/active` still 200 |
| Eligibility path | `GET /teacher/eligibility` answered 404 for the web (the controller repeated the router prefix); fixed with a spec; confirmed 200 on the new image |
| Browser (playwright, reduced motion) | `/student/dashboard`, `/my-learning/mastery`, `/admin/analytics` at 375, 768 and 1280 in light and dark: 18 loads, horizontal overflow 0, console errors 0; the pages show concept titles, three concepts, mean 53% (from 55, 55 and 50), mastered 0; the admin page lists the top concepts with titles |

Not verified: a positive creator application (the application DTO has no `expertiseTopicId`, see "Found, not fixed"), the tone colors `success` and `primary` in the browser (covered by the unit test, no fixture reached a passed concept with 5-item quizzes), a prod database that holds `MasterySnapshot` rows.

Found, not fixed: the strict `SubmitApplicationDto` has no `expertiseTopicId`, so the eligibility gate in `ApplicationsService.submit` is unreachable through the API; `teacher/creators` repeats its router prefix the same way as eligibility did (not checked live); `route-catalog.json` is stale; `apps/web` does not build from the working tree because `nuxt.config.ts` (changed on 2026-10-09 for a landing page) lists `~/assets/css/landing.css`, which does not exist; the web image of this change was built from an export of `HEAD` plus the seven files of this change.

Deploy note: the old web calls the routes that this change removes, so `api` and `web` must be deployed together.

## Evidence citations

- `services/api/src/v1/quiz/quiz-attempts/quiz-attempts.service.ts`, `learner-model/topic-mastery-backfill.service.ts`, `teacher/eligibility/creator-eligibility.service.ts`, `marketplace/marketplace-discovery.controller.ts`, `analytics/admin/admin-analytics.controller.ts`, `personalization/{mastery,policy,skill-node}`
- `apps/web/app/pages/student/dashboard.vue`, `pages/my-learning/mastery/index.vue`, `lib/api.ts`, `pages/learn/profile/dashboard.vue`
- Dev database counts of 2026-10-10
