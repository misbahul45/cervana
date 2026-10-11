# API Audit — services/api

> **Status**: `stable` · **Owner**: `architect` · **Last reviewed**: `2026-10-09`
>
> Module wiring, authority over learning state, grading, the internal contract and the queue to ai-api, measured at `HEAD cb0572f`.

---

## Scope

NestJS service `services/api` (port 3002): module registry, controllers, Prisma models, the learner-state and grading paths, the internal contract used by ai-api, and the BullMQ processors that call ai-api. Payments, orders, refunds and payouts are out of scope except where they touch AI credits; their integration suites (`*.int.spec.ts`) were not run.

## Findings

### Module and route wiring

| Feature | Status | Source | Runtime / test |
|---|---|---|---|
| Module registry | `IMPLEMENTED` | `services/api/src/v1/v1.module.ts:36-72` (33 import entries, 32 distinct modules; `AuthModule` listed twice at 37-38) | 94 of 97 modules reachable from `AppModule` |
| Global guard chain JWT → Roles → Ownership → IdempotencyKey | `IMPLEMENTED` | `services/api/src/app.module.ts:58-70`; `services/api/src/v1/auth/guards/jwt.guard.ts:19-52` | `route-access.spec.ts` passes (jest run) |
| Access decision per route | `IMPLEMENTED` | ratchet in `services/api/src/common/authz/__tests__/route-access.spec.ts` | passes |
| Internal service guard (HMAC, 60 s skew, Redis replay `NX EX 120`) | `IMPLEMENTED` | `services/api/src/common/authz/internal-service.guard.ts:56-118` | 4 specs in `services/api/src/v1/internal/__tests__/`; the guard fails open when Redis is unreachable (`:116`) |
| Internal routes | `IMPLEMENTED` | `InternalOnly` on `/internal/{resources,episodes,decision-traces,agent-sessions,credits}` | registered; no producer authenticates correctly (C-001) except resources |
| Unreachable modules | `UNWIRED` | `EventLogModule`, `SnapshotModule`, `DailyLogSseModule`; `DailyLogSseController` | see M-011 |

### Learner-state authority

| Feature | Status | Source | Notes |
|---|---|---|---|
| Server-side quiz grading | `PARTIAL` | `services/api/src/v1/quiz/quiz-attempts/quiz-attempts.service.ts:76-204`; evaluator `services/api/src/v1/quiz/services/quiz-evaluation.service.ts:21-48` (switch on question type; `hintUsed` ⇒ incorrect, 0 points) | One transaction covers attempt, quiz load, per-answer upsert and completion. Client cannot set `isCorrect`/`score`. Weaknesses: M-001, M-002. Integration suites skipped here. No web caller for `quiz-attempts` found |
| Topic mastery update | `PARTIAL` | `services/api/src/v1/personalization/mastery/mastery.service.ts:36` (`updateFromAttempt`), called only from `quiz-attempts.service.ts:172` | writes `TopicMasteryRecord`. A second `MasteryService` at `services/api/src/v1/learner-model/services/mastery.service.ts:31` serves the tutor and marketplace (M-004) |
| Misconception capture | `PARTIAL` | `services/api/src/v1/personalization/misconception/misconception.service.ts:31` called from `quiz-attempts.service.ts:181` | M-002. Lifecycle rules live in a separate `MisconceptionLifecycleService` (`services/api/src/v1/misconception/misconception-lifecycle.service.ts:32`) used only by the tutor |
| Learning event store | `SCAFFOLDED` | `model LearningEvent` `services/api/prisma/schema.prisma:1232` | no reader or writer in `src`; `EventLog` (analytics) is the only event record, e.g. `QUIZ_SUBMITTED` at `quiz-attempts.service.ts:195` |
| Deterministic tutor | `PARTIAL` | `services/api/src/v1/tutor/tutor.service.ts:58-152`, `POST /tutor/message` `AuthenticatedOnly` | no LLM; reply is `"Mari kita {strategy}. {knowledgeGap}"` (`:200-209`); writes real `Episode` and `DecisionTrace` rows (`:243-295`); see M-003 |
| Adaptive policy (api) | `PARTIAL` | `services/api/src/v1/policy/adaptive-policy.service.ts:75` used by the tutor; `services/api/src/v1/personalization/policy/adaptive-policy.service.ts:27` serves `GET /personalization/policy/{next,me}` | two implementations (M-004) |
| Skill nodes | `UNVERIFIED` | `services/api/src/v1/personalization/skill-node/` route `GET /personalization/skill-nodes/me`; model `SkillNode` has one write path (`skill-node.repo.ts`) | `skill-node.service.spec.ts` passes; whether the controller calls the service or only the repo was not read |
| AI credits | `UNWIRED` | `services/api/src/v1/ai-credits/` four `InternalOnly` routes; advisory-lock reservation | no ai-api reference to credits (grep) and no api caller of `AiCreditsService` outside its module; LLM spend is not reserved, settled or gated |
| API-side evaluation / optimization services | `UNWIRED` | `services/api/src/v1/evaluation/evaluation.service.ts`, `services/api/src/v1/optimization/prompt-optimization.service.ts` | referenced by no module; see [self-improvement-audit](./self-improvement-audit.md) |

### Model usage

Application code (non-spec) reads or writes these Prisma models never: `SandboxScenario`, `SandboxJournalLine`, `SandboxAttempt`, `Achievement`, `DailyStats`, `LearnerGoal`, `StepMasteryRecord`, `LearningPreference`, `BehavioralSignals`, `SemanticLearnerMemory`, `ProceduralMemory`, `LearningEvent`, `PolicyVersion`, `Experiment`, `ExperimentRun`, `OptimizationRun`, `TeacherOverride`, `TenantSettings`, `AICreditPackage`, `HoldWindow`, `RevenueShareRule` (21 of 104). `SandboxAccount`, `TenantMembership`, `OrderItem`, `CreditPackage` are read only. Models written by application code in the AI area, with the number of files that write them: `Episode` 3 (`evaluation.service.ts`, `internal-episodes.controller.ts`, `tutor.service.ts`), `DecisionTrace` 3 (`decision-trace.service.ts`, `internal-decision-traces.controller.ts`, `tutor.service.ts`), `PromptVersion` 1 (`prompt-optimization.service.ts`, unregistered), `InteractionEvaluation` 1 and `EvaluationDataset` 1 (`evaluation.service.ts`, unregistered), `EpisodicMemory` 1 (`memory.repo.ts`), `Misconception` 2 (`misconception.repo.ts`, `tutor.service.ts`), `TopicMasteryRecord` 2 (`topic-mastery-backfill.service.ts`, `mastery.repo.ts`), `AdaptivePolicy` 1, `SkillNode` 1, `EventLog` 1, `MasterySnapshot` 1.

### H-001

**`AI_URL` missing for the API → AI queue.** The three BullMQ processors read `AI_URL` and throw `AI_URL is not defined` when it is empty: `services/api/src/v1/queue/queues/content.processor.ts:24-26`, `user-steps.processor.ts:36-37`, `knowledge.processor.ts:18-19`. `printenv` showed `AI_URL` unset in `api`, `ai-api` and `celery-worker`; `.env` did not define it and `.env.example` did not list it. Fixed in `.env` and `.env.example` on 2026-10-09 (`AI_URL=http://ai-api:3003/ai/v1`, which matches the two processors that call `/users-steps/generate`, `/learning/generate-material`, `/resources/extract`). The containers load `.env` through `env_file`, so they pick the value up when recreated. Open: `content.processor.ts:34` calls `${aiUrl}/v1/resources/embedding/content`; ai-api has no such route (`/resources/embedding/{resource_id}` at `services/ai-api/v1/resources/router.py:29`), and with the new base URL the path would be `/ai/v1/v1/resources/…`. Status `BROKEN`; the `.env` change is necessary and not sufficient. Behind it are two more blockers in the same path:

| Blocker | Evidence |
|---|---|
| The processors send no `Idempotency-Key`; ai-api requires it on `/users-steps/generate` and `/learning/generate-material` (`mint_if_missing=False`) and answers 400 `IDEMPOTENCY_KEY_REQUIRED` | `user-steps.processor.ts:44-48,80-84`; `services/ai-api/v1/users_steps/router.py:124-126`; `services/ai-api/v1/learning/router.py:41-43`; `services/ai-api/middleware/idempotency.py:30-47` |
| When the pipeline fails ai-api returns HTTP 200 with `{"error": …}` (`users_steps/router.py:155-165`); the processor tests only `res.ok` and then spreads the body into a user-step record (`user-steps.processor.ts:55-71`) | a failed generation is stored as a step instead of raising |

`knowledge.processor.ts` does not check `res.ok` on the `TEXT` branch (`:30-37`), so an embedding failure is reported as triggered.

### H-006

**Learner-state tables without code.** `LearnerGoal` (`schema.prisma:1099`), `LearningPreference` (`:1153`), `BehavioralSignals` (`:1164`), `SemanticLearnerMemory` (`:1200`), `ProceduralMemory` (`:1214`), `LearningEvent` (`:1232`) exist in migrations and have no reader or writer. `StepMasteryRecord` (`:1127`), `PolicyVersion` (`:1312`), `Experiment` (`:1324`), `ExperimentRun` (`:1337`), `OptimizationRun` (`:1359`) are in the same state. Mastery therefore cannot be rebuilt from events: the only mastery write is the aggregate update at `quiz-attempts.service.ts:172`.

### M-001

**Post-commit side effects.** `submitAttempt` commits the grading transaction (`quiz-attempts.service.ts:91-167`) and then calls mastery (`:172`), misconception (`:181`) and event log (`:195`) outside it. If any of them throws, the attempt is already `COMPLETED`, and a retry returns `409 Quiz attempt already submitted` (`:99-101`). The mastery update is lost with no compensating path.

### M-002

**Misconception evidence is thin.** `recordFromAnswer` receives `correctAnswer: ''` (`quiz-attempts.service.ts:186`), and the pattern classifier returns only `wrong_multiple_choice` or `wrong_answer` (`:278-285`). No concept is attached to a misconception at capture time.

### M-011

**Dead modules.** `EventLogModule` (`services/api/src/v1/analytics/events/event-log.module.ts`), `SnapshotModule` (`.../snapshots/snapshot.module.ts`) and `DailyLogSseModule` (`.../sse/daily-log-sse/daily-log-sse.module.ts`) are imported by no reachable module; `AnalyticsModule` registers the event-log and snapshot controllers and providers directly. `DailyLogSseController` is registered nowhere. Two files export a class named `QuizModule` (`quiz/quiz.module.ts`, `quiz/services/quiz.module.ts`); name-keyed tooling mis-resolves them.

## Evidence citations

- `services/api/src/v1/v1.module.ts:36-72`; `services/api/src/app.module.ts:58-70`
- `services/api/src/common/authz/internal-service.guard.ts:56-118`
- `services/api/src/v1/quiz/quiz-attempts/quiz-attempts.service.ts:22-26,76-204,278-285`
- `services/api/src/v1/tutor/tutor.service.ts:58-295`
- `services/api/src/v1/queue/queues/{content,user-steps,knowledge}.processor.ts`
- `services/api/prisma/schema.prisma:697,841,1099-1406,2289`
- jest run 2026-10-09: 104 suites passed, 11 skipped; 1091 passed, 143 skipped

## Verdict

The api is the strongest part of the system: guards, access decisions, the internal contract and server-side grading exist, are registered, and have passing specs. What it lacks is the learner-state layer the AI side assumes: no event store, no preference or behavior data, two mastery and two policy implementations, a personal policy that is never saved, and an AI-credit service that no AI path calls. Its outbound queue to ai-api was dead for lack of one environment variable and still forwards raw bearer tokens.
