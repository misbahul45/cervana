# Learner State and Concept Registry — Implementation Plan

> **Status**: `stable` · **Owner**: `architect` · **Last reviewed**: `2026-10-09`
>
> Ordered tasks that give `api` one concept registry, one event-sourced mastery model and one policy, and put the learner state into the tutor prompt.

Design: [learner-state-and-concept-registry.md](../architecture/learner-state-and-concept-registry.md). Decision: [ADR-014](../decisions/ADR-014-concept-registry-and-event-sourced-mastery.md), refining ADR-009 and ADR-010. Closes audit rows 2 and 3, the id part of row 4, finding H-004 and the mismatch findings of `personalization-audit.md`; row 5 (misconceptions) and the fold of the legacy routes stay open (IMPL-LS-11, IMPL-LS-12).

---

## Objective

After this plan a quiz of lesson, sub-topic or step level appends learning events for its approved concepts, the concept mastery is a replayable fold of those events, the next-concept and teaching decisions read that state with typed reason codes, and the tutor prompt of `ai-api` carries the learner's derived state read from `api` over the signed contract.

## Scope

| Service | Created | Edited |
|---|---|---|
| `services/api` | `src/v1/learner-model/{concepts,events,mastery,policy}/*`, `prisma/seed-concepts.ts`, `prisma/seed-data/{concept-aliases,concept-curriculum-links}.json`, one migration, specs | `prisma/schema.prisma`, `quiz-attempts.service.ts` and module, `tutor.service.ts` and module, `marketplace-discovery.{controller,module}.ts`, `internal.module.ts`, `learner-model.module.ts`, `test/schema-snapshot.spec.ts`, `package.json` (script), `AUTHORIZATION_MATRIX.md` |
| `services/ai-api` | `v1/domain/adapter.py`, tests | `v1/learning/content_pipeline.py`, `v1/tutor/personalization_prompt.py`, `config/internal_api_client` consumers as needed, tests |
| repo | none | `AGENTS.md`, `docs/progress-tracker.md`, memory |

Rules for every task: no comments in code or configuration; never `git add`, `commit` or `push`; never `prisma format`; database tests only on a scratch database (`TEST_DATABASE_URL`); recreate compose services with `--no-deps`; each task starts with the failing test and ends with the stated command green.

Baselines before this plan (2026-10-09): `services/api` `pnpm jest --ci --silent` 1239 passed (recorded after RC-14); `services/ai-api` `uv run pytest` 615 passed; `scripts/check-ownership-rules.sh` PASS.

## Step-by-step

| ID | Task | Verify |
|---|---|---|
| IMPL-LS-01 | Schema: the models of the design, the extension of `LearningEvent`, `migration.sql` written from `prisma migrate diff` plus the hand-written tail (checks, immutability trigger). Update `test/schema-snapshot.spec.ts`. Apply to a scratch database, then compare `migrate diff` (must be empty) | `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script` empty on the scratch database; `pnpm jest test/schema-snapshot` |
| IMPL-LS-02 | Seed data files and `seed-concepts.ts`; pure validators (unique ids, acyclic prerequisites, every alias target exists, `UNMATCHED` has no target, link titles resolve, only reviewed rows marked `APPROVED`). Spec on the data files first | `pnpm jest src/v1/learner-model/concepts/__tests__/concept-seed-data`; `pnpm seed:concepts` twice gives the same counts |
| IMPL-LS-03 | `ConceptRegistryService`: list active concepts, get, prerequisite closure, `resolveAlias(scheme, alias)` (approved rows only, returns a list), `conceptsForQuiz` (lesson links, else sub-topic links, approved only) | `pnpm jest src/v1/learner-model/concepts` |
| IMPL-LS-04 | `mastery-v1`: `foldMastery`, `replay`, constants named in one object. Spec first: the six reference sequences of the design computed independently, bounds, hint rule, retake decay, weight of items and share, unknown event ignored, event order matters only through `streamSeq` | `pnpm jest src/v1/learner-model/mastery`; two mutants (hint damps penalties, retake decay removed) killed |
| IMPL-LS-05 | `LearnerEventsService.append` (stream row lock, idempotent append, projection in the same transaction, strict payload schema) and `rebuildLearner`. Unit spec with a fake transaction; integration spec on the scratch database: gapless sequence under concurrent appends, duplicate key appends nothing, update of an event is rejected by the trigger, rebuild equals the incremental projection, cascade delete of the learner | `pnpm jest src/v1/learner-model/events`; `TEST_DATABASE_URL=... pnpm jest src/v1/__tests__/learner-events.int` |
| IMPL-LS-06 | Hook in `QuizAttemptsService.submitAttempt`: resolve concepts, append one event per approved concept inside the grading transaction, key `assessment:{attemptId}:{conceptId}`; no links, no events; legacy topic update unchanged. Spec: lesson quiz, sub-topic quiz, two links split the share, retake gets `attemptNumber`, unapproved link ignored, event failure rolls the attempt back | `pnpm jest src/v1/quiz` |
| IMPL-LS-07 | `LearnerPolicyService` (`nextConcept`, `teachingStrategy`, reason codes) replacing `v1/policy/adaptive-policy.service.ts`; `TutorService` reads `ConceptMastery`; delete `learner-model/services/mastery.service.ts` and its injections | `pnpm jest src/v1/learner-model src/v1/tutor src/v1/policy src/v1/marketplace`; `grep -rn "learner-model/services/mastery" src` empty |
| IMPL-LS-08 | Learner routes `GET /learner-model/me/mastery`, `GET /learner-model/me/next` with access decisions; matrix updated | `pnpm jest src/common/authz/__tests__/route-access.spec.ts` and the controller spec |
| IMPL-LS-09 | Internal routes `GET /internal/learner-state` (acting user bound) and `GET /internal/concepts` with `@InternalOnly()` and ownership; signed-request specs | `pnpm jest src/v1/internal` |
| IMPL-LS-10 | `ai-api`: `ConceptCatalog` adapter (fetch, cache, `resolve`), learner block renderer, chat prompt wiring with fail-open, tests with the `internal_wire` fixture | `uv run pytest -q v1/domain v1/tutor v1/learning` and the whole suite |
| IMPL-LS-10b | Wire the learner block into the chat continuation prompt (`get_propmpt_material`): the internal route resolves a `userStepId` (owned by the acting user) to its lesson, the prompt gets the same block | `uv run pytest -q v1/learning` and a live chat |
| IMPL-LS-11 | Fold the legacy routes: `personalization/mastery`, `personalization/policy`, `skill-node` over the new services; web pages checked in a browser (375, 768, 1280, light and dark, zero console errors). Not started by this change | `pnpm test` (web), playwright |
| IMPL-LS-12 | Misconception events and the fold of the two misconception services after the misconception ontology moves to `api`. Not started by this change | to be defined by its design |
| IMPL-LS-13 | Deploy and live checks: migrate on the dev database, seed, build and recreate `api` and `ai-api` with `--no-deps`, submit quizzes as a test learner, read the routes, run the replay check, send a tutor chat through the real Mistral configuration and show the learner block in the prompt log; docs, tracker, `AGENTS.md`, memory | the checks of the list; `scripts/check-ownership-rules.sh`; both suites green; logs clean |

## Acceptance criteria

1. Every concept id in `ConceptMastery` and `LearningEvent` exists in `Concept`; no other id vocabulary is read by `api` for learner state.
2. Submitting a lesson, sub-topic or step quiz whose links are approved appends one event per concept; submitting it twice (same attempt) appends nothing the second time.
3. `rebuildLearner(userId)` returns no changed row after any sequence of submissions, and an `UPDATE` of a stored event fails.
4. Five 100 percent attempts on distinct quizzes of one concept give a score of 0.820 (rounded) and eight retakes of one quiz stay below 0.70.
5. `GET /learner-model/me/next` answers a different concept after the first concept is passed, which the old policy never did.
6. A tutor chat request of a learner with events sends a `<learner_state trust="derived">` block to the model, and a request with the api unreachable still answers.
7. `api` and `ai-api` suites pass, `scripts/check-ownership-rules.sh` passes, the live stack is healthy, logs are clean.

## Risks

| Risk | Severity | Mitigation |
|---|---|---|
| a retried submission appends twice | High | idempotency key per attempt and concept plus the unique index; tested with a duplicate append and a concurrent pair |
| the learner lock becomes a bottleneck | Low | one event per quiz and concept; the lock is per learner and held for one insert and one upsert |
| quiz level attribution credits the wrong concept | Medium | only approved links act; `share` splits multi-concept quizzes; per-question tags are a named follow-up |
| the owner rejects a proposed mapping | Low | data files are the review surface; a rejected row is a status change and a rebuild is not needed (no event used it) |
| the formula is replaced after D-08 | Medium | named constants, version string on every projection row, replay command; events do not hold derived values |
| `LearningEvent` already has a consumer | Low | searched `src`, tests and migrations on 2026-10-09: no writer, one invariant test that keeps the unique index |
| removing the dead Elo service breaks an injection | Low | grep before and after; the tutor and marketplace specs run in IMPL-LS-07 |
| prompt block leaks learner data | Medium | the block is built from the acting user's own rows (internal route binds the acting user), contains ids, numbers and titles only |

## Rollback

- Images before this change: tag `reducera-api:pre-ls-20261009` and `reducera-ai-api:pre-ls-20261009` before the build; retag and `docker compose up -d --no-deps api ai-api`.
- Database: the migration only adds tables, columns and constraints; leave them in place when rolling the code back. The immutability trigger and checks apply to rows with a `streamSeq` only.
- Events written meanwhile stay valid and are read again after the roll forward; `rebuildLearner` recomputes the projection.

## Progress

| Task | Status | Evidence |
|---|---|---|
| IMPL-LS-01 | [x] | models, two migrations (`20261009110000_catch_up_unmigrated_models` for models that HEAD declared without a migration, written idempotent because the dev database already held them; `20261009120000_concept_registry_and_learner_stream` with checks, partial unique indexes and the immutability trigger); `learner-schema.int.spec.ts` 9 tests, two mutants killed (trigger and assessment check dropped); `migrate diff` empty on scratch and dev |
| IMPL-LS-02 | [x] | `concept-seed.ts` (pure validators), `concept-seeder.ts`, `seed-concepts.ts`, `pnpm seed:concepts`; 17 unit tests and 7 integration tests; mutants killed (cycle detection, status reset, stale alias); seeded twice on scratch and dev with identical counts (65 concepts, 64 prerequisites, 13 alias rows, 12 sub-topic links, 4 lesson links) |
| IMPL-LS-03 | [x] | `ConceptRegistryService`, `concept-graph.ts`; 11 integration tests and 7 unit tests; mutants killed (approved-only filters) |
| IMPL-LS-04 | [x] | `mastery-v1.ts`; 31 tests with the six reference sequences computed independently; four mutants killed (hint damping on penalties, retake decay, theta limit) |
| IMPL-LS-05 | [x] | `LearnerEventsService` (append, rebuild); 13 integration tests including 12 concurrent appends and 6 concurrent equal keys; mutants killed (row lock removed, version rebuild skipped) |
| IMPL-LS-06 | [x] | hook in `QuizAttemptsService.submitAttempt`; 11 unit tests and 7 integration tests; mutants killed (outside the transaction, hint guard) |
| IMPL-LS-07 | [x] | `LearnerPolicyService`, `LearnerStateService`; the Elo `MasteryService`, `v1/policy/adaptive-policy.service.ts` and their specs removed, `TutorService` reads concept mastery; 36 policy tests with three threshold mutants killed, 12 tutor tests with a mutant killed |
| IMPL-LS-08 | [x] | `GET /learner-model/me/mastery` and `/me/next`; 7 controller tests; matrix updated; route-access spec green |
| IMPL-LS-09 | [x] | `InternalLearnerStateController` (`/internal/concepts`, `/internal/learner-state` with `lessonId` and `conceptId`); 7 tests with two mutants killed (query userId, wrong guard) |
| IMPL-LS-10 | [x] | `v1/domain/adapter.py` (`ConceptCatalog`, `fetch_learner_state`), `render_learner_snapshot`, wiring in `generate_material`; 15 + 10 + 7 tests, five mutants killed; ai-api `pytest` 647 passed |
| IMPL-LS-10b | [x] | `GET /internal/learner-state?userStepId=` resolves the acting user's own user step to its lesson and concepts (`conceptIdsForUserStep`, a step of another learner answers nothing); shared fail-open helper `v1/tutor/learner_block.py` used by `generate_material` and by `get_propmpt_material`, which now has a `<learner_state trust="derived">` section and a guideline for it; api 5 new tests, ai-api 13 new tests (675 passed); three mutants killed; live in the worker: signed read for a UUID learner, the block rendered, a user step of another learner gave no block, the prompt carried the section and the Mistral gateway answered |
| IMPL-LS-11 | [~] | the topic EMA, its skill nodes, the step progress backfill and the `personalization/{mastery,policy,skill-node}` routes are retired and every reader uses `ConceptMastery`; web pages switched; see [legacy-mastery-fold-plan.md](./legacy-mastery-fold-plan.md). Misconception routes stay for IMPL-LS-12 |
| IMPL-LS-12 | [ ] | not started by this change |
| IMPL-LS-13 | [x] | images tagged `pre-ls-20261009`, dev database dumped, both migrations deployed, `api`, `ai-api` and `celery-worker` rebuilt and recreated with `--no-deps`, live checks in the design doc ("Verification"); `scripts/check-ownership-rules.sh` PASS with the new learner writes gate (`test_ownership_gate_learner_writes.py`, 8 tests); AGENTS.md "Learner state" section; one defect found and fixed (`POST /quiz/quiz-attempts/start` returned 400 for every caller) |
