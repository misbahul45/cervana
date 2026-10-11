# Legacy Mastery Fold — Implementation Plan

> **Status**: `stable` · **Owner**: `backend-lead` · **Last reviewed**: `2026-10-10`
>
> Ordered tasks that retire the topic EMA and serve every topic level view from concept mastery.

Design: [legacy-mastery-fold.md](../architecture/legacy-mastery-fold.md). Decision: [ADR-017](../decisions/ADR-017-retire-topic-mastery-ema.md). Closes the open part of ADR-010 for mastery (IMPL-LS-11 of the [learner state plan](./learner-state-and-concept-registry-plan.md)).

---

## Objective

After this plan no code writes `TopicMasteryRecord` or `SkillNode`, nothing reads them, every reader (eligibility, recommendations, analytics, web) uses `ConceptMastery`, and the two web pages show concept titles from `learner-model/me/mastery`.

## Scope

| Area | Created | Edited | Deleted |
|---|---|---|---|
| `services/api` | `learner-model/mastery/topic-aggregate.ts` (aggregate, eligibility rule and skill node state), specs, migration `20261010100000_mastery_snapshot_concept` | `concept-registry.service.ts`, `learner-state.service.ts`, `learner-model.controller.ts`, `learner-model.module.ts`, `quiz-attempts.{service,module}.ts`, `creator-eligibility.service.ts` (+ module), `marketplace-discovery.controller.ts` (+ module), `admin-analytics.controller.ts`, `analytics/snapshots/snapshot.service.ts`, `prisma/schema.prisma`, `prisma/seed-data/agents.json`, `personalization.module.ts` | `personalization/{mastery,policy,skill-node}`, `topic-mastery-backfill.service.ts` and its spec |
| `apps/web` | `lib/mastery.ts` and its test | `lib/api.ts`, `interfaces/sandbox/index.ts`, `pages/student/dashboard.vue`, `pages/my-learning/mastery/index.vue`, `pages/admin/analytics.vue` | none |
| repo | `services/ai-api/__tests__/test_ownership_gate_legacy_mastery.py` | `scripts/check-ownership-rules.sh`, `AGENTS.md`, authorization matrix, tracker, decision register, memory | none |

Rules for every task: no comments in code or configuration; never `git add`, `commit` or `push`; each task starts with the failing test; database specs only on `reducera_ls_scratch`; recreate compose services with `--no-deps`.

Baselines before this plan (2026-10-10): `services/api` `pnpm jest --ci --silent` 1427 passed and 220 skipped; `services/ai-api` `uv run pytest -q` 756 passed; `scripts/check-ownership-rules.sh` PASS; `tsc --noEmit` clean.

## Step-by-step

| ID | Task | Verify |
|---|---|---|
| IMPL-FO-01 | `topic-aggregate.ts` (pure): score, passed and total, eligibility rule, node state. Spec first: unseen at zero, exact threshold edges, empty topic, one strong concept does not carry, evidence below `PASS_EVIDENCE` | `pnpm jest src/v1/learner-model/mastery` |
| IMPL-FO-02 | `ConceptRegistryService.topicConceptIds` and `LearnerStateService.topicMastery`, `averageMastery`, `skillNodes`, concept stats. Integration spec on the scratch database: links on sub-topic and on lesson, draft and rejected links ignored, inactive concept ignored | `pnpm jest --runInBand src/v1/__tests__/topic-mastery.int.spec.ts` with `TEST_DATABASE_URL` |
| IMPL-FO-03 | Readers: eligibility, recommendations, admin `top-concepts`, `GET /learner-model/me/skill-nodes`; access decisions and matrix rows. Specs first | `pnpm jest src/v1/teacher src/v1/marketplace src/v1/analytics src/v1/learner-model src/common/authz` |
| IMPL-FO-04 | Writers: remove the EMA call and `updatedMastery` from quiz submission, delete the backfill, delete `personalization/{mastery,policy,skill-node}`; ownership gate for the two legacy models. Specs first (the gate spec fails before the removal) | `pnpm jest`, `bash scripts/check-ownership-rules.sh` |
| IMPL-FO-05 | Web: `listMastery` on `learner-model/me/mastery`, concept titles, copy says concepts, dead `listSkillNodes`/`nextActivity` removed, `top-concepts` caller. Unit test of the mapping first | `pnpm test` (web), `pnpm build` |
| IMPL-FO-06 | Deploy and live: tag images, rebuild `api` and `web` with `--no-deps`, submit quizzes as a test learner and read both pages in a browser (375, 768, 1280, light and dark, zero console errors), eligibility 400 then 201 on a fixture, removed routes answer 404, fixtures deleted | the checks of the list |
| IMPL-FO-07 | Docs: `AGENTS.md`, matrix, tracker row RC-18, decision D-23, memory | `grep -n "TopicMasteryRecord" AGENTS.md` |

## Acceptance criteria

1. `grep` finds no use of `topicMasteryRecord` or `skillNode` outside `prisma/` and the legacy table migrations.
2. A learner who submits graded quizzes sees concept titles and scores on both pages, and the numbers equal `GET /learner-model/me/mastery`.
3. A learner with one strong concept or fewer than three evidences on a concept cannot pass the eligibility check; one with every concept passed and a mean of 0.85 can.
4. The removed routes answer 404 and the new routes answer with an access decision declared.
5. Suites pass, the ownership gate passes, the stack is healthy and the logs are clean.

## Risks

| Risk | Severity | Mitigation |
|---|---|---|
| eligibility rule too strict for real learners | Medium | proposal D-23, constants are named and one line; nobody has applied |
| a client still calls a removed route | Low | only the web used them and it changes in the same release |
| web page regression | Medium | mapping unit test and a browser check at three widths and both themes |
| topic level quiz writes nothing | Low | none exist; recorded in ADR-017 |

## Rollback

- Images before this change: `reducera-api:pre-fo-20261010` and `reducera-web:pre-fo-20261010`.
- No schema change; the legacy tables keep their rows.

## Progress

| ID | State | Evidence |
|---|---|---|
| IMPL-FO-01 | [x] | `topic-aggregate.ts` pure, 16 tests, six mutants killed |
| IMPL-FO-02 | [x] | `topicConceptIds`, `topicMastery`, `averageMastery`, `skillNodes`; unit specs and 8 integration tests on the scratch database, five mutants killed |
| IMPL-FO-03 | [x] | eligibility, recommendations, admin `top-concepts`, `GET /learner-model/me/skill-nodes`, snapshot job and migration `20261010100000_mastery_snapshot_concept` (empty `migrate diff`); eligibility controller path fixed; matrix rows and agent seed endpoints updated |
| IMPL-FO-04 | [x] | EMA call and `updatedMastery` removed, backfill and `personalization/{mastery,policy,skill-node}` deleted, gate `legacy topic mastery tables used by code` with 7 tests and three mutants killed; ownership gate PASS |
| IMPL-FO-05 | [x] | `lib/mastery.ts` (5 tests, four mutants killed), `lib/api.ts`, two pages and the admin page; `vitest` 179 passed |
| IMPL-FO-06 | [x] | images tagged `pre-fo-20261010`, dev database dumped, migration applied, `api` and `web` recreated with `--no-deps`; live and browser checks in the design doc ("Verification"); fixtures deleted |
| IMPL-FO-07 | [x] | `AGENTS.md`, authorization matrix, tracker RC-18, decision D-23, ADR-014 and the learner state plan updated; memory updated |
