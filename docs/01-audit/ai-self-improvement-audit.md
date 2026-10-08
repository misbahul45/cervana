# AI Self-Improvement Audit — services/ai-api

**Scope:** Phase 0 master-prompt §64–§81, §115–§116. Self-improvement: failure mining, DSPy, optimization, baseline, candidate, acceptance gate, canary, rollback, prompt/policy registries, three optimization loops, four experiment arms.
**Audit date:** 2026-10-05.
**Service container:** `reducera_ai_api` :3003. **Source of truth:** `services/api` :3002 (NestJS).
**Evidence rule:** every claim cites a file and line range, or `MISSING` is stated.

---

## 1. Headline Verdict

The `services/ai-api` codebase contains **no self-improvement infrastructure whatsoever**. There is no DSPy program, no prompt version registry, no policy version registry, no failure-category enum, no failure mining, no episode store written by ai-api, no decision-trace from tutor runs, no candidate model, no acceptance gate, no canary, no rollback, no human-in-the-loop hook for prompt changes, no experiment arms, and no separation between training / validation / benchmark / online traffic. The only retry/timeout configuration (`LLM_MAX_RETRIES=2`, `LLM_TIMEOUT_SECONDS=60` in `config/providers.py:18-19`) is operational hardening, not self-improvement. `dspy-ai` is **not** in `pyproject.toml:7-30`, `uv.lock`, or `.venv/lib/python3.11/site-packages/`. Every prompt is a hard-coded f-string (`v1/learning/content_pipeline.py:186-216`, `v1/users_steps/generate_user_steps_pipeline.py:258-332`, `v1/users_steps/generate_quiz_pipeline.py:60-141`) with no version, no hash, and no addressable identity. Master-prompt §64–§81 is **0% implemented**.

## 2. Failure Mining Pipeline (master prompt §66)

| Item | Status | Evidence |
|---|---|---|
| Episode store written by ai-api | **MISSING** | `v1/learning/content_pipeline.py:264-271` returns final state; worker only POSTs `create_content_material` and exits. Per foundation audit, no `Episode` DTO/DDL in ai-api |
| Episode filter (low-quality episodes) | **MISSING** | no `episode` import, no filter module anywhere outside `.venv/` |
| Failure-mode clustering | **MISSING** | no `cluster`, no `failure_mode`, no `pattern` module |
| Dominant-pattern identification | **MISSING** | no pattern-recognition code |
| Hypothesis generation | **MISSING** | no `hypothesis` module |
| Candidate generation from hypothesis | **MISSING** | no `Candidate` class or factory |
| Failure log to disk / S3 | **MISSING** | no logging filter, no failure store; only stdlib `logging` with plain text |

## 3. Failure-Category Enum (master prompt §66)

| Item | Status | Evidence |
|---|---|---|
| `WRONG_ANSWER` enum | **MISSING** | grep for `WRONG_ANSWER` and all 14 named categories returned zero matches across `services/ai-api/**/*.py` |
| `WRONG_DIFFICULTY` enum | **MISSING** | no match |
| `WRONG_STRATEGY` enum | **MISSING** | no match |
| `WEAK_GROUNDING` enum | **MISSING** | no match |
| `MISSING_CITATION` enum | **MISSING** | no match |
| `BAD_PERSONALIZATION` enum | **MISSING** | no match |
| `MEMORY_MISS` enum | **MISSING** | no match |
| `MEMORY_FALSE_POSITIVE` enum | **MISSING** | no match |
| `TOOL_ERROR` enum | **MISSING** | no match |
| `DOMAIN_ERROR` enum | **MISSING** | no match |
| `OVER_SCAFFOLDING` enum | **MISSING** | no match |
| `UNDER_SCAFFOLDING` enum | **MISSING** | no match |
| `EXCESSIVE_VERBOSITY` enum | **MISSING** | no match |
| `HALLUCINATION` enum | **MISSING** | no match |
| Failure classifier (LLM-as-judge or rule-based) | **MISSING** | no classifier module |
| Human-labeller hook (rated feedback) | **MISSING** | no rating UI endpoint, no rating column on DTOs (`v1/learning/dto.py:1-122`, `v1/users_steps/dto.py:1-210`) |

## 4. DSPy Stage Prerequisites (master prompt §68)

| Prerequisite | Status | Evidence |
|---|---|---|
| Episode log (per-interaction `Episode` rows) | **MISSING** | see foundation audit §10 + §2 above |
| Decision trace (per-step tool calls, intermediate outputs) | **MISSING** | see foundation audit §10; `v1/agents/router_endpoint.py:64-87` is the only trace POST and is best-effort with silent failures |
| Frozen benchmark (golden-set questions + expected outputs) | **MISSING in code path** | `v1/learning/__tests__/test_rag_recall.py:1-101` is a pytest file for RAG recall, not a self-improvement benchmark. It is not invoked by any runtime module |
| Independent evaluator (LLM-as-judge or rule-based, separate from generator) | **MISSING** | no `evaluator`, `judge`, or `scorer` module |
| Prompt registry (hashable, addressable) | **MISSING** | see §13 below |
| Typed tutor interface (DSPy `Signature`) | **MISSING** | no `dspy.Signature`, no `dspy.Module`, no `dspy.Predict` anywhere |
| Baseline metrics (correctness, grounding, pedagogy, latency, cost) | **MISSING** | no metric module, no `latency_ms` capture on episode, no `cost_usd` capture |

## 5. DSPy Program — `AdaptiveTutor` (master prompt §69)

| Item | Status | Evidence |
|---|---|---|
| `AdaptiveTutor` DSPy program | **MISSING** | no `AdaptiveTutor` class, no `dspy.Module` subclass |
| DSPy `Signature` for tutor | **MISSING** | no `dspy.Signature` |
| DSPy `Predict` / `ChainOfThought` / `ReAct` module | **MISSING** | no DSPy usage in any `*.py` |
| `dspy-ai` or `dspy` Python dependency | **MISSING** | `pyproject.toml:7-30` lists `celery`, `fastapi`, `langchain`, `langchain-community`, `langchain-core`, `langchain-openai`, `langchain-tavily`, `langgraph`, `llama-index`, `llama-index-llms-langchain`, `llama-index-vector-stores-qdrant`, `numpy`, `openai-whisper`, `pdfplumber`, `pydantic`, `python-dotenv`, `qdrant-client`, `redis`, `requests`, `sse-starlette`, `uvicorn`, `youtube-transcript-api` — no DSPy |
| DSPy package installed in `.venv` | **MISSING** | `ls .venv/lib/python3.11/site-packages/ \| grep -iE "dspy\|optim"` returns no matches |
| DSPy reference in `uv.lock` | **MISSING** | grep for `dspy` in `uv.lock` returns no matches |

## 6. Optimization Dataset Separation (master prompt §70)

| Item | Status | Evidence |
|---|---|---|
| Production episodes dataset | **MISSING** | no episode dataset module |
| Validation dataset (held-out from training) | **MISSING** | no dataset module |
| Benchmark dataset (frozen, manually curated) | **MISSING** | `v1/learning/__tests__/test_rag_recall.py:13-57` (`GOLDEN_CHUNKS` + `BENCHMARK_QUESTIONS`) is a unit-test fixture, not a self-improvement dataset. It is not a registered artifact in any registry. |
| Online traffic split (A/B with logged assignment) | **MISSING** | no A/B infrastructure, no traffic splitter, no `experiment_bucket` field on any DTO |
| Training/validation/benchmark/online data isolation | **MISSING** | no separation exists |

## 7. Baseline Snapshot (master prompt §71)

| Item | Status | Evidence |
|---|---|---|
| Active prompt version recorded | **MISSING** | no `promptVersion` field anywhere; prompts are inline f-strings |
| Policy version recorded | **MISSING** | no `policyVersion` field; `v1/agents/curriculum_agent.py:27-29` reads a policy decision from the api but does not stamp a version |
| Benchmark version recorded | **MISSING** | no benchmark registry |
| Model version recorded (e.g. `gpt-4.1-mini` / `gpt-5-mini`) | PARTIAL (env, not snapshot) | `config/envs.py:43-44` reads `OPENAI_MODEL_FLASH` / `OPENAI_MODEL_THINKING` into `ENVS`; nothing snapshots them at run start |
| Retrieval config snapshot (`HF_EMBEDDING_MODEL`, `QDRANT_COLLECTION`, `EMBEDDING_DIM`) | PARTIAL (env, not snapshot) | `config/envs.py:40, 51-54, 57` reads into `ENVS`; nothing freezes it for comparison |
| Baseline metric record (correctness, grounding, pedagogy, latency, cost) | **MISSING** | no baseline JSON, no baseline table, no baseline artifact |

## 8. Candidate Model (master prompt §72)

| Item | Status | Evidence |
|---|---|---|
| `candidateId` (UUID) | **MISSING** | no Candidate class |
| `basePromptVersion` | **MISSING** | no prompt registry, no version reference |
| `basePolicyVersion` | **MISSING** | no policy registry |
| `benchmarkVersion` | **MISSING** | no benchmark registry |
| `modelVersion` | **MISSING** | not snapshotted |
| `candidateArtifact` (path/hash of compiled prompt) | **MISSING** | no compiled prompt artifact |
| `trainingDataVersion` | **MISSING** | no dataset registry |
| `candidateMetrics` | **MISSING** | no metrics record |
| `baselineMetrics` | **MISSING** | no baseline record |
| `failureModesTargeted` (list of failure categories) | **MISSING** | no failure-mode enum to reference |
| `createdAt` | **MISSING** | no Candidate record |

## 9. Acceptance Gate (master prompt §73)

| Item | Status | Evidence |
|---|---|---|
| `correctness >= baseline` gate | **MISSING** | no gate module |
| `grounding >= baseline` gate | **MISSING** | no gate module |
| `pedagogy >= baseline` gate | **MISSING** | no gate module |
| `personalization >= baseline` gate | **MISSING** | no gate module |
| `hallucination_rate <= baseline × 1.05` gate | **MISSING** | no hallucination measurement, no gate |
| `p95_latency <= baseline × 1.10` gate | **MISSING** | no latency capture (see foundation audit §9: "Per-run cost / token / latency capture — **MISSING**") |
| `cost_per_1k <= baseline × 1.20` gate | **MISSING** | no cost capture |
| ALL criteria must pass (AND, not OR) | **MISSING** | no gate logic anywhere |
| Gate is run on a held-out validation set | **MISSING** | no validation runner |

## 10. Overfitting Protection (master prompt §74)

| Item | Status | Evidence |
|---|---|---|
| Training data | **MISSING** | no training dataset |
| Validation data | **MISSING** | no validation dataset |
| Benchmark data | **MISSING** | no benchmark dataset as a registered artifact |
| Online traffic data (out-of-sample) | **MISSING** | no A/B log, no traffic split |
| Train/validation/benchmark/online separation | **MISSING** | no separation exists anywhere |

## 11. Human Approval (HITL) for Candidate Activation (master prompt §75)

| Item | Status | Evidence |
|---|---|---|
| Candidate `PENDING` state until human review | **MISSING** | no Candidate record, no state machine |
| Human approval required before canary | **MISSING** | no HITL hook in `services/ai-api`; the only `Idempotency-Key` enforcement is on `/v1/agents/run` (`v1/agents/router_endpoint.py:27-35`) and applies to the dispatch, not to prompt activation |
| HITL sign-off record (who, when, what) | **MISSING** | no audit row written for prompt changes |
| Block auto-activation by route handler | **MISSING** | no route blocks on a `promptVersion is active` check |

## 12. Canary Rollout (master prompt §76)

| Item | Status | Evidence |
|---|---|---|
| 95% active / 5% candidate split | **MISSING** | no traffic splitter, no canary module |
| Sticky assignment (same user always sees same arm) | **MISSING** | no `bucket` field on request, no `bucket()` function |
| Per-arm metric capture | **MISSING** | no per-arm telemetry |
| Auto-promote to 100% when candidate beats baseline | **MISSING** | no promotion logic |

## 13. Rollback (master prompt §77)

| Item | Status | Evidence |
|---|---|---|
| Regression detection (>10% in 1 hour) | **MISSING** | no metric stream, no regression detector |
| Automatic rollback to previous active | **MISSING** | no rollback module |
| Manual rollback endpoint | **MISSING** | no admin route to revert a prompt version |
| Rollback audit record | **MISSING** | no rollback ledger |

## 14. Prompt Version Registry (master prompt §78)

| Item | Status | Evidence |
|---|---|---|
| Registry module (`PromptRegistry` / equivalent) | **MISSING** | no `registry/` directory in `services/ai-api/`; only `config/`, `v1/`, `utils/`, `__tests__/` |
| `DRAFT` state | **MISSING** | no state machine |
| `EXPERIMENTAL` state | **MISSING** | no state machine |
| `VALIDATED` state | **MISSING** | no state machine |
| `ACTIVE` state | **MISSING** | no state machine |
| `REJECTED` state | **MISSING** | no state machine |
| `ROLLED_BACK` state | **MISSING** | no state machine |
| `ARCHIVED` state | **MISSING** | no state machine |
| Hashable (sha256 of prompt text) | **MISSING** | only `promptHash` is the sha256 of the raw user query in `v1/agents/router_endpoint.py:73`; no prompt registry has hashes |
| Addressable (by stable id) | **MISSING** | prompts are inline in code; no `prompt://` URI scheme |
| Rollbackable (re-activate previous version) | **MISSING** | no rollback (see §13) |

## 15. Policy Version Registry (master prompt §79)

| Item | Status | Evidence |
|---|---|---|
| Registry module (`PolicyRegistry` / equivalent) | **MISSING** | no policy registry |
| `policyVersion` field | **MISSING** | not on any DTO; not in `v1/agents/curriculum_agent.py:16-50` |
| `ruleset` (the actual policy decision rules) | **MISSING** | policy is owned by the api (`v1/agents/curriculum_agent.py:27` calls `/v1/personalization/policy/next`); ai-api is a consumer only, no ruleset ownership |
| `parameters` (knobs: temperature, top-k, etc.) | PARTIAL (env) | `config/envs.py:47-49` reads `OPENAI_FLASH_TEMPERATURE`; no versioning of parameters |
| `effectiveAt` | **MISSING** | no timestamp on policy |
| `createdBy` | **MISSING** | no audit field |

## 16. Self-Improvement Safety Boundaries (master prompt §80)

Master prompt §80 forbids self-improvement code from altering: authorization, financial rules, accounting engine, evaluation benchmark, security guards, memory isolation, tenant isolation, system policy, educational safety policy.

| Item | Status | Evidence |
|---|---|---|
| Explicit guard against altering authorization | **MISSING** | no guard, no constraint module |
| Explicit guard against altering financial rules | **MISSING** | no guard |
| Explicit guard against altering accounting engine | **MISSING** | no guard |
| Explicit guard against altering evaluation benchmark | **MISSING** | no guard |
| Explicit guard against altering security guards | **MISSING** | no guard |
| Explicit guard against altering memory isolation | **MISSING** | no guard; memory isolation IS enforced in `utils/tools/memory.py:13-78` (lesson scope) and `config/memory_embedding.py:89-98` (user scope), but as a hand-coded invariant, not a self-improvement constraint |
| Explicit guard against altering tenant isolation | **MISSING** | no guard; ai-api has no tenant context at all (no `tenantId` field on any DTO) |
| Explicit guard against altering system policy | **MISSING** | no guard; `config/prompt_segmentation.py:88-161` hard-codes `system_policy` and `educational_policy` blocks but no runtime prevents modification |
| Explicit guard against altering educational safety policy | **MISSING** | no guard |

## 17. Three Optimization Loops (master prompt §65)

| Loop | Cadence | Status | Evidence |
|---|---|---|---|
| **A — fast learner adaptation per interaction** | per turn | **MISSING** | the only per-turn logic is the LangGraph `generate_content_material_pipeline` (`v1/learning/content_pipeline.py:254-271`) which is **not** an adaptation loop; it produces one output per request, with no learning-update step |
| **B — medium-term policy adaptation (daily / weekly)** | daily / weekly | **MISSING** | no scheduler in `services/ai-api`; no Celery beat configured for prompt re-tuning (Celery worker in `config/celery.py:25-34` only runs the content-generation task); no job in the repo runs on a daily/weekly cadence |
| **C — slow system optimization (weekly / monthly)** | weekly / monthly | **MISSING** | no offline job, no scheduled benchmark re-run, no model/policy re-tune |
| All three loops are separate code paths with different ownership | **MISSING** | no loop architecture exists |

## 18. Experiment Structure (master prompt §81)

The 4 arms: **A** static tutor, **B** learner model, **C** learner model + memory, **D** learner model + memory + adaptive policy + DSPy.

| Arm | Status | Evidence |
|---|---|---|
| Arm A: static tutor | PRESENT (incidentally) | `v1/learning/content_pipeline.py:152-251` is a static prompt with no learner model, no memory, no policy — closest match to Arm A but not labeled as such |
| Arm B: learner model | **MISSING** | no learner model; learning style is read from the api (`v1/learning/content_pipeline.py:33-37`) but no `learner_state` model is owned by ai-api |
| Arm C: learner model + memory | **MISSING** | `utils/tools/memory.py:1-133` writes/reads lesson-scoped memory but is not wired into an experiment; no learner model on top |
| Arm D: learner model + memory + adaptive policy + DSPy | **MISSING** | no DSPy, no policy registry, no adaptive policy in ai-api |
| `hypothesis` per experiment | **MISSING** | no experiment manifest |
| `population` (eligibility rules) | **MISSING** | no manifest |
| `treatment` vs `control` (arm assignment) | **MISSING** | no manifest |
| `metrics` per experiment | **MISSING** | no manifest |
| `duration` (start/end) | **MISSING** | no manifest |
| `analysis` plan | **MISSING** | no manifest |

## 19. Operational Retry vs Self-Improvement Retry

| Item | Status | Evidence |
|---|---|---|
| LLM call timeout (`LLM_TIMEOUT_SECONDS=60`) | PRESENT (operational) | `config/providers.py:18, 122-125` |
| LLM call retry (`LLM_MAX_RETRIES=2`) | PRESENT (operational) | `config/providers.py:19, 122-125` |
| Celery `max_retries=3` on tutor tasks | PRESENT (operational) | `v1/learning/workers.py:18, 47` (`@celery_app.task(... autoretry_for=(Exception,), max_retries=3)`) |
| HuggingFace embedding retry loop | PRESENT (operational) | `config/providers.py:41-68` (`MAX_ATTEMPTS=3`, `BACKOFF_SECONDS=2.0`) |
| **Self-improvement prompt retry based on failure-mined feedback** | **MISSING** | no such mechanism |

Operational retry is the only retry in the codebase. It is **not** the same as self-improvement retry, which would re-write the prompt based on episode feedback.

## 20. Critical Defects (self-improvement layer)

| Severity | Defect | Location |
|---|---|---|
| CRITICAL | No DSPy program — `AdaptiveTutor` and any DSPy module | absent (no `dspy` import anywhere) |
| CRITICAL | No prompt version registry — prompts are inline f-strings, not addressable or hashable | `v1/learning/content_pipeline.py:186-216`, `v1/users_steps/generate_user_steps_pipeline.py:258-332`, `v1/users_steps/generate_quiz_pipeline.py:60-141` |
| CRITICAL | No policy version registry — no `policyVersion` field on any DTO | absent |
| CRITICAL | No episode store written by ai-api — foundation audit §10 | `v1/learning/content_pipeline.py:264-271` |
| CRITICAL | No decision trace from tutor runs (only `/v1/agents/run` does best-effort) | `v1/learning/content_pipeline.py:264-271`, `v1/learning/workers.py:13-104` |
| CRITICAL | No failure-category enum — 14 categories from master prompt §66 are all missing | absent (grep confirms zero matches) |
| CRITICAL | No acceptance gate — no measurable correctness / grounding / pedagogy / latency / cost baseline | absent |
| CRITICAL | No canary mechanism — no traffic split, no sticky assignment | absent |
| CRITICAL | No rollback — no regression detection, no auto-revert | absent |
| CRITICAL | No HITL hook for prompt activation — owner cannot approve / reject a candidate | absent |
| CRITICAL | No training / validation / benchmark / online traffic separation — overfitting is unavoidable when self-improvement eventually lands | absent |
| HIGH | No self-improvement safety boundaries — no guardrails on which subsystems the optimizer may alter | absent |
| HIGH | No experiment manifest — the 4 arms from master prompt §81 are not even declared as a planned experiment | absent |
| HIGH | No model / retrieval config snapshot at run start — cannot diff old vs new prompt results | absent |
| HIGH | No baseline metrics record — any "candidate beats baseline" claim is unprovable | absent |
| MEDIUM | Operational retry (`LLM_MAX_RETRIES`, `Celery max_retries=3`, HF `MAX_ATTEMPTS=3`) is the only retry in the codebase; it is not a self-improvement loop and should not be confused with one | `config/providers.py:18-19`, `v1/learning/workers.py:18, 47`, `config/providers.py:15` |

## 21. Evidence Trail Summary

| Cluster (file) | What's confirmed | What's confirmed MISSING |
|---|---|---|
| `pyproject.toml:7-30` | 23 dependencies listed | `dspy`, `dspy-ai` not in list |
| `uv.lock` | (greped) | no `dspy`, no `dspy-ai` reference |
| `.venv/lib/python3.11/site-packages/` | (ls + grep) | no `dspy*` or `optim*` package installed |
| `config/providers.py:1-145` | two LLM modes, HF embedding with retry, prompt-versioning NOT present | no prompt registry, no version fields |
| `config/embedding_pipeline.py:1-275` | RAG + memory Qdrant wrappers | no `Baseline`, `Candidate`, `AcceptanceGate`, no metrics capture |
| `config/prompt_segmentation.py:1-166` | XML fencing for trust boundaries | no version concept, no hash, no registry |
| `config/envs.py:1-64` | all env loaded into `TypedDict` once | no `PROMPT_VERSION`, no `POLICY_VERSION`, no `CANARY_RATIO` |
| `v1/learning/content_pipeline.py:152-271` | LangGraph tutor with inline prompt f-string | no version, no hash, no episode write |
| `v1/learning/workers.py:13-104` | Celery task dispatches to content pipeline | no episode write, no decision-trace, no metrics |
| `v1/users_steps/generate_user_steps_pipeline.py:255-395` | Learning-path LangGraph with inline prompt | no version, no episode write |
| `v1/users_steps/generate_quiz_pipeline.py:60-155` | Quiz LangGraph with inline prompt | no version, no episode write |
| `v1/agents/curriculum_agent.py:16-50` | calls api `/v1/personalization/policy/next` | no `policyVersion` captured on response |
| `v1/agents/router_endpoint.py:64-87` | best-effort POST to `decision-trace/record` | `promptVersion`, `policyVersion`, `learnerStateVersion`, `retrievalVersion` all absent from payload |
| `utils/tools/memory.py:1-133` | lesson-scoped memory + cross-lesson fallback | no memory-isolation guard owned by self-improvement layer |
| `v1/learning/__tests__/test_rag_recall.py:1-101` | pytest fixture for RAG recall | not a registered benchmark artifact |

## 22. What Phase 9 Must Build (self-improvement layer)

```text
1.  services/ai-api/registry/prompt_registry.py — DRAFT/EXPERIMENTAL/VALIDATED/ACTIVE/REJECTED/ROLLED_BACK/ARCHIVED state machine, sha256-addressable, file-backed or Redis-backed
2.  services/ai-api/registry/policy_registry.py — policyVersion, ruleset, parameters, effectiveAt, createdBy with rollback
3.  services/ai-api/registry/candidate.py — Candidate dataclass with candidateId, basePromptVersion, basePolicyVersion, benchmarkVersion, modelVersion, candidateArtifact, trainingDataVersion, candidateMetrics, baselineMetrics, failureModesTargeted, createdAt, status (PENDING/VALIDATED/APPROVED/DEPLOYED/ROLLED_BACK/REJECTED)
4.  services/ai-api/registry/baseline.py — baseline snapshot: modelVersion, retrievalConfig, promptVersion, policyVersion, metrics (correctness, grounding, pedagogy, latency, cost)
5.  services/ai-api/failure_mining/store.py — episode store writer (POST to api /internal/episodes for now; in-process later)
6.  services/ai-api/failure_mining/categories.py — Literal/Enum of 14 failure categories from master prompt §66
7.  services/ai-api/failure_mining/classifier.py — classifier (LLM-as-judge) that returns failure_category + confidence
8.  services/ai-api/failure_mining/cluster.py — cluster episodes by (failure_category, promptVersion, user_cohort)
9.  services/ai-api/failure_mining/hypothesis.py — generate hypothesis from dominant cluster
10. services/ai-api/acceptance_gate/gate.py — exact gate: correctness >= baseline, grounding >= baseline, pedagogy >= baseline, personalization >= baseline, hallucination_rate <= baseline * 1.05, p95_latency <= baseline * 1.10, cost_per_1k <= baseline * 1.20; all must pass
11. services/ai-api/canary/router.py — sticky bucket assignment; default 95/5 split; per-arm metric capture
12. services/ai-api/canary/rollback.py — regression detector (>10% drop in 1h on the candidate arm) + auto-rollback to previous ACTIVE
13 services/ai-api/hitl/approval.py — approval endpoint for candidate ACTIVE transition; records (approver, timestamp, baseline_metrics, candidate_metrics, gate_result)
14. services/ai-api/dspy/adaptive_tutor.py — dspy.Module subclassing; dspy.Signature for tutor prompt; placeholder until dependencies in §5 are stable (master prompt §68)
15. services/ai-api/datasets/{production,validation,benchmark,online}/ — explicit folder + manifest for each split with hash + createdAt + sample_count + provenance
16. services/ai-api/safety/boundaries.py — explicit guard module: refuses to alter authorization, financial rules, accounting engine, evaluation benchmark, security guards, memory isolation, tenant isolation, system policy, educational safety policy
17. services/ai-api/experiments/manifest.py — experiment manifest: hypothesis, population, treatment, control, metrics, duration, analysis; declares 4 arms (A static, B learner model, C learner model + memory, D learner model + memory + adaptive policy + DSPy)
18. services/ai-api/loops/{fast,medium,slow}.py — three loops with separate code paths: fast per-turn (memory write), medium daily/weekly (policy update via Celery beat), slow weekly/monthly (DSPy compile + benchmark re-run)
19. services/ai-api/observability/per_run_capture.py — capture inputTokens, outputTokens, costUsd, latencyMs, promptVersion, policyVersion, retrievalVersion per episode (foundation audit §9 also flags this gap)
20. Add DSPy dependency: pyproject.toml `dependencies += ["dspy-ai>=2.5"]`, regenerate uv.lock, and verify .venv installation before any dspy.* import is added
```
