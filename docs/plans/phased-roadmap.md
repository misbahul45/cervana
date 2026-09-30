# Phased Implementation Roadmap

> **Status**: `planned` · **Owner**: `architect` · **Last reviewed**: `2026-09-30`
>
> 13-phase ordered roadmap to take Cervana from current state to a research-grade, self-improving educational agent.

---

## 1. Objective

Define an ordered, dependency-aware sequence of phases that converts the current Cervana codebase (see [`docs/01-audit/system-audit.md`](../01-audit/system-audit.md)) into the target architecture (see [`docs/02-architecture/target-state.md`](../02-architecture/target-state.md)). Each phase has explicit acceptance criteria; downstream phases assume upstream phases are stable.

This is a **roadmap**, not a sprint plan. Phases may take 1–4 weeks each depending on team size.

---

## 2. Overview

| Phase | Title | Priority | Status | Output |
|---|---|---|---|---|
| 0 | Stabilize Current State | P0 | `[ ]` | Close CRITICAL gaps + selected HIGH |
| 1 | Architecture Cleanup | P1 | `[ ]` | Service boundaries enforced, OTel, structured logs |
| 2 | Domain Model | P0 | `[ ]` | Prisma migrations: mastery, memory, episodes |
| 3 | Memory | P0 | `[ ]` | MemoryService + extraction policy + decay |
| 4 | Learner Model | P0 | `[ ]` | MasteryService + MisconceptionDetector |
| 5 | Adaptive Policy | P0 | `[ ]` | AdaptivePolicyService (deterministic) |
| 6 | Agent Integration | P0 | `[ ]` | Tutor endpoint + decision trace |
| 7 | Evaluation | P1 | `[ ]` | QuizEvaluationService + frozen benchmark |
| 8 | DSPy | P2 | `[ ]` | AdaptiveTutor module + teleprompter |
| 9 | Optimization Gate | P1 | `[ ]` | AcceptanceGate + canary + rollback |
| 10 | Experiments | P2 | `[ ]` | A/B/C/D experiment harness |
| 11 | Observability | P1 | `[ ]` | OTel wiring + dashboards |
| 12 | Production Hardening | P0 | `[ ]` | WAF, CSP, rate limits, runbook |

The `[ ]` markers show this roadmap is **not started**. The plan itself is complete; execution follows.

---

## 3. Phase 0 — Stabilize Current State

### 3.1 Objective

Close every CRITICAL finding from the audit so the system can run reliably enough to measure future changes.

### 3.2 Scope

Files affected:

- `cervana-api/src/v1/chat/contents/` (resolve C-002, C-003)
- `cervana-api/src/v1/chat/chat-messages/` (resolve C-002, C-003)
- `cervana-api/src/v1/quiz/quiz-attempts/`, `cervana-api/src/v1/quiz/answers/` (resolve C-004)
- `ai-api-cervana/v1/learning/service.py` (resolve C-001)
- `cervana-api/src/v1/learning/user-steps/`, `cervana-api/src/v1/chat/`, `cervana-api/src/v1/material/` (resolve C-007)
- `cervana-api/test/`, `ai-api-cervana/tests/` (resolve C-006)
- `ai-api-cervana/utils/tools/memory.py` (resolve C-005)
- `cervana-api/src/common/interceptors/daily-activity.interceptor.ts` (resolve H-001)
- `nginx/nginx.conf` (resolve H-006)
- `docker-compose.yml`, `docker-compose.prod.yml` (resolve H-007)

### 3.3 Steps

1. **Resolve C-001** — implement `GET /chat/contents/similarity?chatId=&query=` in NestJS. Use the existing `contents.repo.ts` (after fixing C-002) plus a Postgres similarity via `pg_trgm` extension (already enabled in `postgres/init/01-extensions.sql`).
2. **Resolve C-002** — remove the dead `findById` query in `contents.repo.ts:67-87`, or add a `ContentEmbedding` Prisma model and migration. Recommended: add the model + migration; this also closes C-003.
3. **Resolve C-003** — implement `ContentProcessor` in `cervana-api/src/v1/queue/queues/content.processor.ts` that consumes the `content` queue and writes to `content_embeddings`.
4. **Resolve C-004** — implement `QuizEvaluationService`. For `MULTIPLE_CHOICE`, compare stored `correctAnswer` with `userAnswer`. For `TEXT` and `CASE_STUDY`, call `ai-api /ai/v1/evaluator/grade` with rubric; `ai-api` calls the LLM with structured output. Wire `Answer.isCorrect` and `QuizAttempt.score` updates.
5. **Resolve C-005** — fix `tool_semantic_search` to filter by `lessonId` strictly and log fallback (don't include cross-lesson items).
6. **Resolve C-006** — add real unit + integration tests. Phase 0 target: ≥ 30 tests covering auth, evaluation, memory, RAG retrieval, streak, leaderboard.
7. **Resolve C-007** — add ownership checks on `chats`, `chat-messages`, `contents`, `user-steps`, `user-topics`, `personality-quizzes` controllers. Use a NestJS guard or per-controller check.
8. **Resolve H-001** — restrict `ActivityDetectorInterceptor` to specific high-signal endpoints. Move from global interceptor to explicit invocation in handlers.
9. **Resolve H-006** — add CSP, HSTS, Permissions-Policy headers in `nginx.conf`.
10. **Resolve H-007** — pick one Celery startup path. Remove subprocess spawn from `ai-api-cervana/main.py` and rely on the dedicated `celery-worker` service.

### 3.4 Acceptance criteria

| ID | Criterion | Verification |
|---|---|---|
| AC-0.1 | `GET /chat/contents/similarity` returns 200 with relevant content for valid `chatId` | `curl` smoke test |
| AC-0.2 | `contents_embeddings` table exists; `contents.repo.findById` succeeds | migration applies; integration test passes |
| AC-0.3 | Adding a chat content triggers embedding within 5 seconds | load test |
| AC-0.4 | Submitting a quiz attempt sets `Answer.isCorrect` and `QuizAttempt.score` correctly | unit + integration tests |
| AC-0.5 | `tool_semantic_search` returns only lesson-scoped memories | unit test with multi-lesson dataset |
| AC-0.6 | `npm run build` succeeds in both services; `docker compose config` valid | CI |
| AC-0.7 | Cross-user chat access is rejected with 403 | security test |
| AC-0.8 | Authenticated pings don't mint streaks | unit test |
| AC-0.9 | CSP / HSTS headers present in nginx response | `curl -I` |

### 3.5 Risks

| Risk | Mitigation |
|---|---|
| Implementing `ContentEmbedding` model breaks `contents.repo.ts` migration | Test migration on a clone of prod data first |
| Streak logic split between interceptor and handlers introduces race conditions | Add idempotency check on `StreakHistory(date, userId)` |

---

## 4. Phase 1 — Architecture Cleanup

### 4.1 Objective

Make the system measurable. No optimization can be principled without metrics.

### 4.2 Scope

- OpenTelemetry SDK in both `cervana-api` and `ai-api-cervana`.
- Structured JSON logging (winston in NestJS, structlog in FastAPI).
- Metrics exporter (Prometheus) at `/metrics` on each service.
- Token usage + cost counters per `Episode`.

### 4.3 Acceptance criteria

| ID | Criterion |
|---|---|
| AC-1.1 | OTel traces flow from Nuxt → Nginx → api → ai-api → LLM with one `trace_id` |
| AC-1.2 | `GET /metrics` returns Prometheus-format counters for HTTP requests, queue depth, LLM calls, embeddings |
| AC-1.3 | Every `Episode` row includes `inputTokens`, `outputTokens`, `costUsd`, `latencyMs` |

---

## 5. Phase 2 — Domain Model

### 5.1 Objective

Add the new Prisma tables from [`docs/02-architecture/data-model.md`](../02-architecture/data-model.md). All tables live in `api`.

### 5.2 Scope

- `cervana-api/prisma/schema.prisma` additions.
- `cervana-api/prisma/migrations/<timestamp>_domain_model/migration.sql`.
- Backfill `TopicMasteryRecord` from existing `StepProgress`.
- Mark existing Qdrant memory rows `SUPERSEDED`.

### 5.3 Acceptance criteria

| ID | Criterion |
|---|---|
| AC-2.1 | Migration applies cleanly to a clone of production data |
| AC-2.2 | `TopicMasteryRecord` backfilled for 100% of users with `StepProgress` rows |
| AC-2.3 | All new enums exported |

---

## 6. Phase 3 — Memory

### 6.1 Objective

Replace the Qdrant-only untyped memory with a 4-layer typed memory (`WorkingMemory`, `EpisodicMemory`, `SemanticLearnerMemory`, `ProceduralMemory`) per [`target-state.md` §4.3](../02-architecture/target-state.md#43-memory-architecture).

### 6.2 Scope

- `api/src/v1/memory/memory.service.ts` — CRUD + extraction policy + decay + retrieval scoring.
- `ai-api-cervana/config/embedding_pipeline.py` — keep for vector search; pass `userId` filter at every call.
- `ai-api-cervana/utils/tools/memory.py` — replace with typed calls to `api`'s `MemoryService` over HTTP.

### 6.3 Acceptance criteria

| ID | Criterion |
|---|---|
| AC-3.1 | `MemoryService.should_store(event)` matches the policy in `target-state.md` §4.3 (15+ test cases) |
| AC-3.2 | Retrieval scoring formula matches the spec; golden-vector tests pass |
| AC-3.3 | Decay function reduces `last_used_at` weight over time per `target-state.md` §4.3 |
| AC-3.4 | Cross-lesson leak bug is gone; `ai-api` queries return only lesson-scoped results |

---

## 7. Phase 4 — Learner Model

### 7.1 Objective

Implement the Elo-like mastery update from [`learner-state.md`](../02-architecture/learner-state.md).

### 7.2 Scope

- `api/src/v1/learner-model/mastery.service.ts` — `MasteryService.update(attempt)`.
- `api/src/v1/learner-model/misconception-detector.service.ts` — rule-based + LLM-confirmed detection.
- Hook every `Answer.isCorrect = true|false` update to emit a `LearningEvent` and call `MasteryService.update`.

### 7.3 Acceptance criteria

| ID | Criterion |
|---|---|
| AC-4.1 | All 8 golden-vector tests in `learner-state.md` §3.5 pass |
| AC-4.2 | Hint usage sets `actual = 0` regardless of answer correctness |
| AC-4.3 | Confidence crosses 0.5 at ~25 observations |
| AC-4.4 | Misconception auto-resolves after 5 consecutive correct answers |
| AC-4.5 | Off-topic questions do not update mastery |

---

## 8. Phase 5 — Adaptive Policy

### 8.1 Objective

Replace the implicit "policy" (currently inside the LLM prompt) with an explicit, deterministic `AdaptivePolicyService`. This is the keystone of personalization.

### 8.2 Scope

- `api/src/v1/policy/adaptive-policy.service.ts` — the function in `target-state.md` §4.4.
- `api/src/v1/policy/policy.controller.ts` — `POST /policy/decide`.
- Zod schema for `AdaptiveTutoringStrategy`; reject invalid outputs.
- Property-based tests for invariants.

### 8.3 Acceptance criteria

| ID | Criterion |
|---|---|
| AC-5.1 | Strategy fields always within documented ranges (`difficulty ∈ [0,1]`, `hint_level ∈ [0,3]`, etc.) |
| AC-5.2 | `difficulty` always within `ZoneOfProximalDevelopment` |
| AC-5.3 | `scaffolding = "high"` when open misconceptions ≥ 2 |
| AC-5.4 | 100 random learner-state fixtures produce sensible strategies |

---

## 9. Phase 6 — Agent Integration

### 9.1 Objective

Build the new tutor endpoint that ties everything together.

### 9.2 Scope

- New `POST /ai/v1/tutor/respond` in `ai-api-cervana/v1/tutor/router.py`.
- New `POST /chat/tutor-message` in `cervana-api/src/v1/chat/tutor.controller.ts`.
- Service boundaries enforced: `ai-api` reads all DB state via `api`.
- Decision trace persistence in `decision_traces` table.
- Episode persistence in `episodes` table.

### 9.3 Acceptance criteria

| ID | Criterion |
|---|---|
| AC-6.1 | End-to-end flow: user opens lesson → asks question → receives tutor response → mastery updated; 5 golden scenarios pass |
| AC-6.2 | `trace_id` flows from Nuxt → Nginx → api → ai-api → LLM |
| AC-6.3 | `DecisionTrace` row written for every response |
| AC-6.4 | `Episode` row written for every response with all fields populated |

---

## 10. Phase 7 — Evaluation

### 10.1 Objective

Make the system evaluable. Build the frozen benchmark and the per-interaction evaluator.

### 10.2 Scope

- `api/src/v1/evaluator/quiz-evaluation.service.ts` — for `MULTIPLE_CHOICE`, deterministic; for `TEXT`/`CASE_STUDY`, calls `ai-api /ai/v1/evaluator/grade` with rubric.
- `ai-api-cervana/v1/evaluator/grade.py` — LLM-as-judge with structured output.
- `api/src/v1/evaluator/per-interaction-evaluator.service.ts` — runs after each episode.
- Frozen benchmark: 50 representative accounting scenarios in `EvaluationDataset`.
- Nightly cron: run eval set against current active prompt + policy versions.

### 10.3 Acceptance criteria

| ID | Criterion |
|---|---|
| AC-7.1 | Frozen benchmark has ≥ 50 scenarios; `isFrozen = true` |
| AC-7.2 | Optimizer cannot write to the benchmark (DB-level constraint or separate table) |
| AC-7.3 | Grader agreement with human-labeled subset: Cohen's κ ≥ 0.85 |
| AC-7.4 | Nightly eval produces a result row in `evaluation_runs` |
| AC-7.5 | Dashboard endpoint returns pass-rate, p95 latency, cost per 1k |

---

## 11. Phase 8 — DSPy

### 11.1 Objective

Introduce DSPy for prompt optimization, behind an evaluation gate.

### 11.2 Scope

- Add `dspy` to `ai-api-cervana/pyproject.toml`.
- `ai-api-cervana/v1/tutor/dspy_module.py` — `AdaptiveTutor` + `TutorSignature`.
- Build `OptimizationDataset` from `episodes` where `evaluation.overall_score ≥ 0.7`.
- Initial `BootstrapFewShot` run.

### 11.3 Acceptance criteria

| ID | Criterion |
|---|---|
| AC-8.1 | DSPy module compiles and runs against 10 sample episodes |
| AC-8.2 | First BootstrapFewShot run improves `overall_score` by ≥ 5% on the optimization set (vs baseline) |
| AC-8.3 | Candidate prompts are persisted with version + metrics |

---

## 12. Phase 9 — Optimization Gate

### 12.1 Objective

Implement the controlled improvement loop with human approval.

### 12.2 Scope

- `api/src/v1/optimization/acceptance-gate.service.ts` — applies the gate from `target-state.md` §4.7.
- `api/src/v1/optimization/optimization-runner.service.ts` — async worker.
- Admin endpoints: `GET /admin/optimization-runs`, `POST /admin/optimization-runs/:id/approve`, `/:id/reject`.
- Canary deployment: 5% traffic to candidate prompt version.
- Auto-rollback: if online metric regresses > 10% in 1h, revert.

### 12.3 Acceptance criteria

| ID | Criterion |
|---|---|
| AC-9.1 | Gate evaluates all 7 criteria and exposes each component |
| AC-9.2 | No candidate can deploy without `decidedBy = human` |
| AC-9.3 | Canary auto-rolls back on simulated regression |

---

## 13. Phase 10 — Experiments

### 13.1 Objective

Run the 4-arm comparison from master prompt §25.

### 13.2 Scope

- 4 experiment arms:
  - A: Static tutor (no learner model, no memory, no policy).
  - B: Learner model only.
  - C: Learner model + memory.
  - D: Learner model + memory + adaptive policy + DSPy.
- Stratified sampling by mastery band.
- Pre-registered hypotheses.
- Results published to `docs/research/experiment-results.md`.

### 13.3 Acceptance criteria

| ID | Criterion |
|---|---|
| AC-10.1 | All 4 arms complete ≥ 200 sessions each |
| AC-10.2 | Results include confidence intervals |
| AC-10.3 | Report does **not** declare one condition "best" without uncertainty bounds |

---

## 14. Phase 11 — Observability

### 14.1 Objective

Wire OpenTelemetry end-to-end and ship dashboards.

### 14.2 Scope

- OTel SDK in both services.
- Dashboards: pass-rate per prompt version, p50/p95 latency, cost per 1k episodes, RAG retrieval precision, evaluator disagreement rate.
- Grafana JSON exports under `dashboards/`.

### 14.3 Acceptance criteria

| ID | Criterion |
|---|---|
| AC-11.1 | Every `trace_id` is queryable in Tempo / Jaeger for ≥ 7 days |
| AC-11.2 | Dashboards updated within 1 minute of new episode |

---

## 15. Phase 12 — Production Hardening

### 15.1 Objective

Make the system production-ready.

### 15.2 Scope

- WAF in front of Nginx.
- Rate limits on `ai-api` endpoints.
- CSP, HSTS, Permissions-Policy headers.
- Backup/restore runbook for Qdrant and Postgres.
- On-call runbook at `docs/operations/runbook.md`.

### 15.3 Acceptance criteria

| ID | Criterion |
|---|---|
| AC-12.1 | Penetration test passes OWASP Top 10 baseline |
| AC-12.2 | Runbook covers the 5 most likely production failures |
| AC-12.3 | Recovery from Postgres + Qdrant backup succeeds in ≤ 30 minutes |

---

## 16. Definition of done

The full system is considered complete when every criterion in [`docs/04-operations/acceptance-criteria.md`](../04-operations/acceptance-criteria.md) is met. Phases build toward that target but each phase is itself complete when its own acceptance criteria pass.

Phases are executed in numerical order. A phase may be partially implemented if it unblocks a higher-priority issue, but skipping phases is forbidden — each phase's output is the input to the next.