# AI Evaluation Audit — services/ai-api

**Scope:** Phase 0 master-prompt §57–§63, §114. Independent evaluator, frozen benchmark, evaluation dimensions, episode-based grading, human calibration, and the security boundary that keeps the evaluator a read-only observer of authoritative business state.
**Audit date:** 2026-10-05.
**Service container:** `reducera_ai_api` :3003. **Source of truth:** `services/api` :3002 (NestJS).
**Evidence rule:** every claim cites a file and line range, or `MISSING` is stated. Confirmation of the negative space is via `codebase-memory-mcp` `search_graph` (see §13 Evidence Trail Summary).

---

## 1. Headline Verdict

`services/ai-api` has **no evaluation layer of any kind**. There is no evaluator module, no `Evaluator` or `Judge` class, no `EvaluationDataset` or `InteractionEvaluation` table, no `BenchmarkRun` or `FrozenBenchmarkService`, no `Episode` record, no scoring dimensions, no human-labeled calibration subset, and no Cohen's κ measurement. The only structured post-LLM validation in the entire service is `QuizResponse.model_validate(...)` at `v1/users_steps/generate_quiz_pipeline.py:151` and `GenerateUserStepRespon(**payload)` at `v1/users_steps/generate_user_steps_pipeline.py:351` — both of which are Pydantic **schema** checks, not domain-grounded **semantic** grading. The only `benchmark` artefact in the repo is `v1/learning/__tests__/test_rag_recall.py`, which tests the **RAG retriever** (recall@k ≥ 0.7 on 20 chunks), not the tutor. All evaluation logic and Prisma tables for it live exclusively in `services/api` (`src/v1/evaluation/evaluation.service.ts`, `prisma/schema.prisma:1275-1290` for `InteractionEvaluation`, `:1348-1357` for `EvaluationDataset`); the ai-api has zero coupling to those tables and zero equivalent code.

## 2. Independent Evaluator (master prompt §57)

| Item | Status | Evidence |
|---|---|---|
| `Evaluator` / `Judge` / `Grader` class in ai-api | **MISSING** | `codebase-memory-mcp search_graph` query `evaluation evaluator benchmark grader interaction` against `services/ai-api` returns 0 hits (all 31 hits are in `services/api` or `services/api/prisma/schema.prisma`). Grep of `services/ai-api/` for `eval`, `judge`, `grader`, `kappa`, `cohen`, `metric` returns only `v1/learning/__tests__/test_rag_recall.py:1` ("Frozen recall benchmark for RAG retrieval") and `v1/users_steps/generate_quiz_pipeline.py:151` (`QuizResponse.model_validate`) — neither is an evaluator |
| Evaluator is **distinct from** the tutor module | **MISSING** (vacuously) | No evaluator exists; no separation question arises |
| Evaluator runs against tutor outputs (post-LLM) | **MISSING** | The only post-LLM hook is `QuizResponse.model_validate` (`v1/users_steps/generate_quiz_pipeline.py:151`), which validates JSON shape (list of `{question,type,difficulty,options,answer}`) — no semantic check, no scoring, no grade, no feedback |
| Evaluator runs against the learning-path generator | **MISSING** | The only post-LLM hook is `GenerateUserStepRespon(**payload)` at `v1/users_steps/generate_user_steps_pipeline.py:351` — same Pydantic shape check, no semantic evaluation |
| Evaluator runs against the tutor `generate_material` output | **MISSING** | `v1/learning/content_pipeline.py:218-251` (`generate_material` node) stores `state.generate` as a plain `dict` (`{"chatId","chatMessageId","data","citations","metadata"}`) and returns it. No schema validation, no evaluator. Pydantic type `GenerateContentMaterialResponseDto` exists at `v1/learning/dto.py:18-50` but is **never** instantiated in the pipeline — the union is `Union[GenerateContentMaterialResponseDto, dict]` at `v1/learning/dto.py:112` and the runtime always takes the `dict` branch |
| Per-interaction evaluation emitted as a side effect of every tutor run | **MISSING** | `v1/learning/workers.py:20-39` (`generate_content_material_task`) only POSTs `create_content_material` and exits. `v1/learning/workers.py:42-103` (`generating_new_content`) same. No `InteractionEvaluation` write, no `episode/evaluate` call, no score field anywhere |

## 3. Evaluation Tables / DTOs in ai-api (master prompt §57)

| Item | Status | Evidence |
|---|---|---|
| `EvaluationDataset` model / DTO in ai-api | **MISSING** | Definition exists only in `services/api/prisma/schema.prisma:1348-1357` (out of audit scope). No equivalent Pydantic class in `services/ai-api/v1/**/dto.py` |
| `InteractionEvaluation` model / DTO in ai-api | **MISSING** | Definition exists only in `services/api/prisma/schema.prisma:1275-1290` (out of audit scope). No equivalent in ai-api |
| `BenchmarkRun` model / DTO in ai-api | **MISSING** | Grep `services/ai-api/` for `BenchmarkRun` → 0 hits. No schema, no DTO |
| `EvaluationCase` model / DTO in ai-api | **MISSING** | Grep `services/ai-api/` for `EvaluationCase` → 0 hits |
| `Episode` model / DTO in ai-api | **MISSING** | Grep `services/ai-api/` for `episode`/`Episode` → 0 hits in source. `Episode.evaluationScore`, `Episode.evaluationJson` fields are referenced only in `services/api` (`prisma/schema.prisma:1263-1270`) |
| ai-api schema lives in (Prisma migration / DDL) | **MISSING** | ai-api has no database. `services/ai-api/` has no `prisma/`, no `migrations/`, no `.sql`. Per `AGENTS.md` ai-api is forbidden from direct DB access; all persistence is via HTTP to `services/api` |
| ai-api can read `Episode` over HTTP for evaluator input | **MISSING** | No route in `services/ai-api/v1/**/router.py` references `/v1/episodes`, `/internal/episodes`, `Episode`, `evaluation`, `evaluate`, `judge`, `score` in path. The agent endpoint `v1/agents/router_endpoint.py:67-82` POSTs to `/v1/agents/decision-trace/record` on `api` but never reads evaluation results back |

## 4. Frozen Benchmark for Accounting Tasks (master prompt §60, §61)

| Item | Status | Evidence |
|---|---|---|
| 50+-scenario frozen benchmark for accounting tasks | **MISSING** | No frozen benchmark exists in ai-api. The only benchmark artefact in the entire repo is `v1/learning/__tests__/test_rag_recall.py:1-...` with exactly **20** questions on retrieval recall, not on tutor outputs. 20 < 50 |
| Benchmark located in ai-api | **MISSING** | `v1/learning/__tests__/test_rag_recall.py` is the only file in `services/ai-api/` whose docstring mentions "benchmark"; the file is a pytest suite, not a frozen dataset |
| Benchmark covers double-entry bookkeeping, journal entries, trial balance, adjustments, financial statements | PARTIAL | `v1/learning/__tests__/test_rag_recall.py:9-29` (`GOLDEN_CHUNKS`) contains 20 chunks across `debits_and_credits`, `balance_sheet`, `income_statement`, `cash_flow`, `inventory`. These are RAG **corpus** chunks, not tutor **output** expected answers. They test that the retriever returns the right chunk for a query, not that the tutor's explanation is correct |
| Benchmark is **frozen** (immutable, version-pinned) | **MISSING** | `test_rag_recall.py` is a pytest module: editable, not versioned, not load-bearing for any production gate. `FrozenBenchmarkService` exists only in `services/api/src/v1/evaluation/evaluation.service.ts:120-195` (out of scope) |
| `isFrozen=true` enforcement | **MISSING in ai-api** | Reference: `services/api/src/v1/evaluation/evaluation.service.ts:134` enforces `isFrozen` via `prisma.evaluationDataset.findUnique(...).isFrozen`. No equivalent in ai-api |

## 5. Evaluation Dimensions (master prompt §58)

| Dimension | Status | Evidence |
|---|---|---|
| **Correctness** scoring | **MISSING** | No `correctness` field, function, or DTO in ai-api. (`services/api/src/v1/evaluation/evaluation.service.ts:4-10` defines `EvaluationScores.correctness` with weight 0.35 — out of scope) |
| **Grounding** (citation/retrieval alignment) scoring | **MISSING** | ai-api produces `citations` in `state.generate` (`v1/learning/content_pipeline.py:226-238`) but no score measures grounding. The `rag_citations` list at `v1/learning/content_pipeline.py:126-134` carries only the Qdrant similarity score, not a grounding verdict against the generated prose |
| **Pedagogy** scoring | **MISSING** | No rubric, no signal. Adaptive strategy is hard-coded in the prompt at `v1/learning/content_pipeline.py:210-214` |
| **Personalization** scoring | **MISSING** | The learning style is used in the prompt (`v1/learning/content_pipeline.py:205-206`, `v1/users_steps/service.py:130-152`) but the output is never checked against the dominant style |
| **Hallucination** detection | **MISSING** | No claim-level verification. `config/prompt_segmentation.py` (referenced in foundation audit §6 row 38) **segments untrusted content** for prompt-injection defense, not for hallucination grading |
| **Latency** capture per episode | **MISSING** | `v1/learning/workers.py:13-19` and `:42-48` are Celery tasks; Celery's per-task duration is available via its own dashboard but the ai-api does not record `latencyMs`, `inputTokens`, `outputTokens`, or `costUsd` anywhere in the task result (`workers.py:31-35` returns only `{"message":"Success","data":...}`) |
| **Cost** capture per episode | **MISSING** | Same as latency — no telemetry field recorded. `pipeline.llm_thinking.invoke(...)` (`v1/learning/content_pipeline.py:219`) and `pipeline.llm.invoke(...)` (multiple sites) do not extract `usage_metadata` from the response object |
| **Per-route LLM timeout** (`LLM_TIMEOUT_SECONDS=60`) | PRESENT (per foundation audit) | `config/providers.py:18, 122-125`. Not an evaluation dimension but the only "budget" signal that exists at all |
| **Per-route LLM retry bound** (`LLM_MAX_RETRIES=2`) | PRESENT (per foundation audit) | `config/providers.py:19, 122-125` |

## 6. Accounting-Specific Evaluation Dimensions (master prompt §59)

| Dimension | Status | Evidence |
|---|---|---|
| **Conceptual correctness** (debits/credits, accrual, matching) | **MISSING** | `v1/users_steps/generate_quiz_pipeline.py:60-141` writes prompts about audit, accounting transaction, financial reconciliation, but the produced `QuizItem.answer` field is a free-text string (`v1/users_steps/dto.py:127-132`) that is never checked against an accounting taxonomy |
| **Calculation correctness** | **MISSING** | No numeric verification. Quiz `type` enum is `multiple_choice | input | matching | scenario` (`v1/users_steps/dto.py:129`); no `calculation` type. The `input` type stores a string answer, not a numeric one with a tolerance |
| **Double-entry validity** | **MISSING** | No journal-entry parser; no debit/credit balance check; no trial-balance rebuild in ai-api |
| **Domain terminology** | **MISSING** | No term taxonomy, no glossary cross-check. `tool_memory_upsert` (`v1/learning/content_pipeline.py:84, 243-247`) just stores raw text — no concept tagging |
| **Rule consistency** (consistency across generated steps of a lesson) | **MISSING** | The user-steps pipeline (`v1/users_steps/generate_user_steps_pipeline.py:255-369`) generates `BaseUserStep` titles in a single LLM call; the 6-9 numbered rules enforce JSON shape only, not conceptual consistency between steps |
| **Scenario interpretation** | **MISSING** | The quiz pipeline tells the LLM to produce scenario questions (`v1/users_steps/dto.py:129` allows `type: "scenario"`), but the ai-api never evaluates whether the LLM interpreted the scenario correctly |
| **Misconception handling** | **MISSING** | The misconception domain lives in `services/api/src/v1/misconception/` (per `services/api/src/v1/` listing, out of scope). ai-api has zero coupling. A `misconception_check` tool does not exist here |
| **Prerequisite awareness** | **MISSING** | `node_fetch` in `v1/users_steps/generate_user_steps_pipeline.py:25-54` retrieves the lesson's full step list but does not load prerequisite graph; no concept mastery input from `services/api` (the `learner-model` domain is out of scope per the listing) |

## 7. Evaluator Independence (master prompt §62)

| Item | Status | Evidence |
|---|---|---|
| Evaluator has its **own** prompt version, separate from tutor's | **MISSING** | No evaluator module exists; the question is vacuous. The only prompts in the service are tutor/content generation prompts (`v1/learning/content_pipeline.py:186-216`), quiz-generation prompt (`v1/users_steps/generate_quiz_pipeline.py:60-141`), learning-path prompt (`v1/users_steps/generate_user_steps_pipeline.py:258-332`), and personality-interpreter prompt (`v1/users_steps/generate_user_steps_pipeline.py:168-203`). None is a judge prompt |
| Evaluator uses a different LLM call (`pipeline.llm_judge` or equivalent) | **MISSING** | `config/embedding_pipeline.py` and `config/providers.py` define exactly two LLM modes: `pipeline.llm` (flash) and `pipeline.llm_thinking` (reasoning). No third "judge" mode. There is no `pipeline.llm_judge` anywhere in the source (confirmed by grep) |
| Evaluator's prompt is **versioned** (`promptVersion` field) | **MISSING** | No evaluator. Tutor prompts are inline string f-strings (`v1/learning/content_pipeline.py:66-74`, `:186-216`); no template registry, no version id |
| `judgeModel`, `judgeVersion` recorded on the evaluation | **MISSING in ai-api** | Defined in `services/api/src/v1/evaluation/evaluation.service.ts:45-46` as `'reducera.per-interaction.v1'` and `'1.0.0'` (out of scope). Not in any ai-api payload |

## 8. Human-Labeled Calibration (master prompt §63)

| Item | Status | Evidence |
|---|---|---|
| Cohen's κ ≥ 0.85 target | **MISSING** | No κ computation in ai-api. Grep `kappa`/`cohen` → 0 hits |
| Calibration subset of human-labeled cases | **MISSING** | No `*.jsonl` or `*.csv` in `services/ai-api/` contains tutor outputs with human grades. The only structured data files in ai-api source are `GOLDEN_CHUNKS` and `BENCHMARK_QUESTIONS` in `v1/learning/__tests__/test_rag_recall.py:9-...` — these are RAG corpus + queries, not human-labeled tutor judgments |
| Agreement measurement between two human raters | **MISSING** | No rater pair, no confusion matrix, no `sklearn.metrics.cohen_kappa_score`. `pyproject.toml:7-30` (per foundation audit §1 row 88) has no `scikit-learn`, no `statsmodels` |
| Agreement measurement between LLM judge and humans | **MISSING** | No judge exists; no LLM-vs-human agreement |
| Calibration recorded per `(dimension, promptVersion)` | **MISSING** | No dimension registry, no prompt registry |

## 9. Episode-Based Evaluation (master prompt §42, §57)

| Item | Status | Evidence |
|---|---|---|
| `Episode` row created on every tutor run | **MISSING** | ai-api never creates an episode. Confirmed by: `v1/learning/workers.py:20-39` and `:42-103` return a Celery result and exit; no `POST /internal/episodes` or `POST /v1/episodes` call. The agent endpoint (`v1/agents/router_endpoint.py:67-82`) posts only a `decision-trace/record` payload — no `episodeId` field in the payload |
| Episode payload includes `inputTokens`, `outputTokens`, `latencyMs`, `costUsd`, `toolCalls` | **MISSING in ai-api** | `Episode` schema is in `services/api/prisma/schema.prisma` (out of scope). The decision-trace POST at `v1/agents/router_endpoint.py:69-77` sends `agentName`, `agentScope`, `userId`, `promptHash`, `responseHash`, `toolCalls`, `deterministicOutputs` — no token counts, no latency, no cost |
| Evaluator reads episodes | **MISSING** | No evaluator; no read path |
| Episode ID returned to the caller for downstream grading | **MISSING** | `v1/learning/router.py:12-37` (`/generate-material`) and `:40-60` (`/chat`) return only the LLM output, no episode handle. `v1/users_steps/router.py` same. The agent endpoint returns `result["idempotencyKey"]` (`v1/agents/router_endpoint.py:62`) but no episode id |

## 10. Cybersecurity Boundary (master prompt §63 + AGENTS.md)

| Item | Status | Evidence |
|---|---|---|
| Evaluator **never** writes to authoritative business tables (`User`, `Order`, `Payment`, `Wallet`, `AICreditLedger`, `GamificationLedger`, `LedgerTransaction`, `DomainEvent`, `QuizResponse`, `UserStep`) | **VACUOUSLY TRUE** | No evaluator exists. ai-api writes only to two destinations: (a) the external `services/api` over HTTP via `requests` / `httpx` (`v1/users_steps/service.py:7-50`, `v1/learning/workers.py:29`, `v1/agents/router_endpoint.py:67`), and (b) the Qdrant vector store via `pipeline.upsert_document(...)` (`v1/users_steps/generate_quiz_pipeline.py:42-50`) |
| Evaluator input is read-only over `Episode` / `InteractionEvaluation` | **VACUOUSLY TRUE** | No evaluator; no DB access. ai-api has no Prisma client, no `DATABASE_URL` (per `AGENTS.md` rule: ai-api must not import Prisma) |
| Evaluator cannot import `services/api`'s authorization decorators | PRESENT by isolation | ai-api is a separate Python service; Python cannot import TypeScript modules. The only auth boundary ai-api enforces is `Bearer` token on resource routes (`v1/resources/router.py:18-20`); `/v1/learning/*` and `/v1/users-steps/*` lack auth entirely (per foundation audit §4 rows 51-53) |
| Evaluator prompt and result are versioned + signed (tamper-evident) | **MISSING** | No evaluator. The decision-trace POST at `v1/agents/router_endpoint.py:67-82` is best-effort (`Exception` swallowed at line 83-87) and not signed — it sends the user's bearer token directly in the `Authorization` header at line 79, which is also a violation of the signed-internal-contract pattern (per foundation audit §3 row 47) |

## 11. Tests for the Evaluator

| Item | Status | Evidence |
|---|---|---|
| `test_eval*` in ai-api | **MISSING** | Grep `test_eval` in `services/ai-api/` → 0 hits |
| `test_grader*` in ai-api | **MISSING** | Grep `test_grader` → 0 hits |
| `test_benchmark*` in ai-api (tutor-output benchmark) | **MISSING** | Grep `test_benchmark` → 0 hits in source (the only `benchmark` literal is the docstring of `v1/learning/__tests__/test_rag_recall.py:1`) |
| `test_score*` / `test_metric*` / `test_kappa*` / `test_cohen*` | **MISSING** | Grep returns 0 hits |
| RAG recall benchmark (proxy) | PRESENT | `v1/learning/__tests__/test_rag_recall.py` — 20-question recall@k ≥ 0.7 suite. **Not** a tutor-output evaluation. It tests `pipeline.retrieve(query=..., top_k=10)` against an in-memory fake corpus, asserting that chunk IDs `c1`-`c20` are returned. Docstring at line 1: "Frozen recall benchmark for RAG retrieval" |
| Tutor citation gating | PRESENT (per foundation audit Phase 1) | `v1/learning/__tests__/test_tutor_citation.py` — tests that `GenerateContentMaterialResponseDto.citations[i].lessonId` round-trips. Structural, not semantic |
| Tutor prompt-fence (prompt-injection defense) | PRESENT | `v1/learning/__tests__/test_service_prompt_fence.py` — tests `<user_input trust="untrusted">` wrapping. Security, not evaluation |

## 12. Critical Defects (evaluation layer)

| Severity | Defect | Location |
|---|---|---|
| CRITICAL | No evaluator module, no frozen benchmark, no `Episode`/`InteractionEvaluation` table, no scoring dimensions, no human calibration — the entire evaluation layer required by master prompt §57–§63 is absent | `services/ai-api/` (whole tree) |
| CRITICAL | The only post-LLM validation is `QuizResponse.model_validate` (Pydantic shape check) and `GenerateUserStepRespon(**payload)` (same) — these are structural, not semantic; a tutor that emits confidently wrong accounting claims passes both checks | `v1/users_steps/generate_quiz_pipeline.py:151`, `v1/users_steps/generate_user_steps_pipeline.py:351` |
| HIGH | No `Episode` record is created on any tutor run; downstream grader, replay, or audit has no observation stream to read | `v1/learning/workers.py:20-39`, `:42-103`, `v1/users_steps/router.py` (whole) |
| HIGH | No `latencyMs` / `inputTokens` / `outputTokens` / `costUsd` captured per episode; no SLO can be measured; no cost guardrail can be enforced | `v1/learning/workers.py:31-35, 99-100` (return shape), `v1/learning/content_pipeline.py:218-238` (LLM call site) |
| HIGH | Tutor and (would-be) evaluator share a single prompt space (inline string f-strings); there is no template registry, no `promptVersion`, no `judgeModel`/`judgeVersion` — the independence test in master prompt §62 cannot even be expressed | `v1/learning/content_pipeline.py:66-74, 186-216`; `v1/users_steps/generate_quiz_pipeline.py:60-141`; `v1/users_steps/generate_user_steps_pipeline.py:168-203, 258-332` |
| MEDIUM | `v1/learning/dto.py:112` declares `state.generate: Optional[Union[GenerateContentMaterialResponseDto, dict]]` but runtime always takes the `dict` branch (`v1/learning/content_pipeline.py:226-238`) — the schema exists but is unused, so even structural validation is not performed on the tutor's prose output | `v1/learning/content_pipeline.py:226-238` |
| MEDIUM | RAG recall benchmark (`v1/learning/__tests__/test_rag_recall.py`) is the only "benchmark" in the service but tests the retriever, not the tutor. A drift in tutor quality will not be caught by any test in `services/ai-api/` | `v1/learning/__tests__/test_rag_recall.py:1-...` (whole file) |
| MEDIUM | Agent decision-trace POST is best-effort and unauthenticated against the internal contract — it carries the user's bearer token directly (`v1/agents/router_endpoint.py:79`) and swallows failures at lines 83-87; an evaluator reading this stream cannot trust its integrity | `v1/agents/router_endpoint.py:64-87` |
| LOW | `test_rag_recall.py` has 20 chunks across 5 accounting topics, which is the closest the repo comes to an accounting benchmark. This is reusable as a starting corpus for a Phase 8 frozen dataset but is not currently load-bearing for any gate | `v1/learning/__tests__/test_rag_recall.py:9-29` (`GOLDEN_CHUNKS`) |

## 13. Evidence Trail Summary

| Source | What was checked | Result |
|---|---|---|
| `codebase-memory-mcp search_graph` query `evaluation evaluator benchmark grader interaction` | All symbols named `Evaluation*`, `Benchmark*`, `Grader`, `Judge`, `PerInteraction*` across the project | 31 hits, **all** in `services/api` or `services/api/prisma/schema.prisma`. **Zero hits in `services/ai-api/`** |
| `grep -ril "EvaluationDataset\|InteractionEvaluation\|BenchmarkRun\|EvaluationCase\|Evaluator"` in `services/ai-api/` | All file paths | Empty (only `.pytest_cache`/`.venv` collateral noise) |
| `grep -rn "QuizResponse"` in `services/ai-api/` | The only "evaluation" surface that actually exists in the service | 5 hits, all in `v1/users_steps/dto.py:135` and `v1/users_steps/generate_quiz_pipeline.py:6, 26, 147, 151, 153` — Pydantic shape only |
| `grep -rn "test_eval\|test_grader\|test_benchmark\|test_score\|test_metric\|test_kappa\|test_cohen\|test_grounding\|test_hallucination"` in `services/ai-api/` | Negative confirmation of evaluator tests | 0 hits |
| `grep -rn "episode\|Episode"` in `services/ai-api/` | Negative confirmation of episode store | 0 hits in source |
| `grep -rn "interaction\|judge\|calibration\|cohen\|kappa\|gamma"` in `services/ai-api/` | Negative confirmation of judge / inter-rater / calibration logic | 0 hits |
| Reference: `services/api/src/v1/evaluation/evaluation.service.ts:1-195` (read for context only — out of audit scope) | Confirm that the evaluation layer exists elsewhere, so the negative result in ai-api is real and not a "search missed it" artifact | `PerInteractionEvaluatorService` (lines 33-117) and `FrozenBenchmarkService` (lines 120-195) both defined; `EvaluationScores` (lines 4-10) with weights (lines 18-24) and thresholds (lines 26-30); all coupled to `prisma.interactionEvaluation` and `prisma.evaluationDataset` which exist in `services/api/prisma/schema.prisma:1275-1290, 1348-1357` |
| Test files inventory (`find services/ai-api -name "*.py" -path "*/tests/*" -o -name "*.py" -path "*/__tests__/*"`) | 19 test files total; none exercises an evaluator, judge, grader, or scorer | Files: `config/__tests__/{test_embedding_pipeline,test_no_gemini,test_prompt_segmentation,test_providers,test_rate_limit,test_service_auth,test_url_allowlist,test_user_auth,test_vector_collections}.py`; `utils/tools/__tests__/{test_memory,test_memory_lesson_scope}.py`; `v1/agents/__tests__/{test_curriculum_agent,test_router_dispatch,test_router_endpoint}.py`; `v1/learning/__tests__/{test_rag_recall,test_service_prompt_fence,test_tutor_citation}.py`; `tests/{test_main,test_web_search}.py`; `__tests__/test_main_no_subprocess_spawn.py` |

## 14. What Phase 8 Must Build (evaluation layer)

```text
1.  New file  services/ai-api/v1/evaluation/__init__.py
    New file  services/ai-api/v1/evaluation/dto.py
        - EvaluatorRequestDto, EvaluationScoresDto, EvaluationResultDto,
          EvaluationCaseDto, EpisodeDto, InteractionEvaluationDto,
          CalibrationSetDto
        - All Pydantic v2 BaseModel; .strict() on writes; forbid `judgeModel`
          from being empty
    New file  services/ai-api/v1/evaluation/evaluator.py
        - PerInteractionEvaluator class with its OWN prompt template
          (system + user), versioned (EVAL_PROMPT_VERSION env or constant)
        - Uses pipeline.llm_judge — a new LLM mode, distinct from
          pipeline.llm and pipeline.llm_thinking; added in
          config/providers.py with a different model name (e.g. the
          strongest judge-class model)
        - evaluate_episode(episode) -> EvaluationResultDto with the 5
          scores from master prompt §58: correctness, grounding,
          pedagogy, personalization, hallucination (low-level numeric
          or categorical; never None)
        - evaluate_quality(generated_prose, citations, lesson_id) ->
          EvaluationResultDto for one-shot tutor runs that have no
          episode yet
    New file  services/ai-api/v1/evaluation/episode_client.py
        - Thin HTTP client (httpx) to POST /v1/internal/episodes on
          services/api with signed headers; called by the tutor Celery
          worker AFTER successful generation; never writes to
          services/api business tables
        - GET /v1/internal/episodes/{id} for the evaluator to read
          back the input payload, generated prose, retrieved chunks,
          token counts, latency, cost

2.  New file  services/ai-api/v1/evaluation/dimensions.py
        - ACCOUNTING_DIMENSIONS = {conceptual_correctness,
          calculation_correctness, double_entry_validity,
          domain_terminology, rule_consistency,
          scenario_interpretation, misconception_handling,
          prerequisite_awareness}
        - Each dimension has (a) a short rubric (3-7 bullets) the
          judge prompt references, (b) a 0-1 score, (c) a textual
          rationale, (d) a flag (PASS / WARN / FAIL)
        - Rubrics live in services/ai-api/prompts/accounting/*.md so
          they are diffable and version-controlled
    New file  services/ai-api/prompts/accounting/{conceptual_correctness,
      calculation_correctness, double_entry_validity,domain_terminology,
      rule_consistency, scenario_interpretation,
      misconception_handling, prerequisite_awareness}.md
        - One file per dimension; loaded by evaluator.py
        - Each rubric is the judge's ground truth — not used to
          constrain the tutor

3.  New file  services/ai-api/v1/evaluation/frozen_benchmark.py
        - FrozenBenchmark class with:
            dataset_dir = "data/benchmarks/accounting/v1/" (gitignored
              raw, but versioned schema lives in
              data/benchmarks/accounting/v1.schema.json)
            load(name, version) -> dict (raises if isFrozen flag is
              False or if version is older than the current head)
            iterate_cases() -> Iterator[EvaluationCaseDto]
        - 50+ scenarios covering the 8 dimensions above; each case has
          (inputPrompt, expectedKeyConcepts[], expectedJournalEntries,
          expectedCitationLessonIds[], rubricOverrides{...})
        - First corpus re-uses the 20 GOLDEN_CHUNKS from
          v1/learning/__tests__/test_rag_recall.py:9-29 as the
          expected-retrieval half; adds 30+ new cases for tutoring
          scenarios, journal-entry validation, double-entry balance,
          and misconception traps

4.  New file  services/ai-api/v1/evaluation/calibration.py
        - CalibrationSet: 50 hand-labeled (human-judge-A,
          human-judge-B) cases; loaded from
          data/calibration/accounting/v1.json
        - cohen_kappa(scores_a, scores_b) -> float (re-implement or
          vendor; do not add sklearn as a hard dep — a 30-line pure
          Python implementation is enough)
        - run_calibration(judge_model_name) -> dict with
          {kappa_overall, kappa_per_dimension, n_cases, target=0.85,
          passed: bool}
        - Wire to pytest: services/ai-api/v1/evaluation/__tests__/
          test_calibration_kappa.py asserts kappa >= 0.85

5.  New file  services/ai-api/v1/evaluation/router.py
    Update  services/ai-api/v1/router.py:6-12 to mount the new router
        - POST /v1/evaluation/run   { episodeId | caseId } -> Result
        - GET  /v1/evaluation/episode/{id}              -> Episode
        - GET  /v1/evaluation/benchmark/{name}/{version}/report
        - POST /v1/evaluation/benchmark/run { name, version } -> Report
        - Every route requires Bearer + role (TEACHER, ADMIN); audit
          log emits a row per call

6.  Update  services/ai-api/v1/learning/workers.py:20-39 and :42-103
        - After create_content_material(...) returns, post an Episode
          to services/api (signed) with inputTokens, outputTokens,
          latencyMs, costUsd (extracted from pipeline.llm.invoke(...)
          .response_metadata.usage and time.monotonic())
        - Pass the returned episodeId back to the caller in the route
          response (or to a follow-up Celery task) so the evaluator can
          be triggered

7.  Update  services/ai-api/v1/learning/content_pipeline.py:218-238
        - Extract .response_metadata from pipeline.llm_thinking.invoke()
          result and stash on state so the worker can persist to
          the Episode

8.  Update  services/ai-api/v1/agents/router_endpoint.py:67-82
        - Replace the raw `Authorization: token` header with a signed
          internal-contract header (x-service-id, x-service-timestamp,
          x-service-signature) so the decision-trace write is
          tamper-evident and the evaluator can trust the source episode
        - Add episodeId to the response payload (the api must echo
          the Episode.id it created)

9.  New file  services/ai-api/v1/evaluation/__tests__/test_evaluator.py
    New file  services/ai-api/v1/evaluation/__tests__/test_frozen_benchmark.py
    New file  services/ai-api/v1/evaluation/__tests__/test_calibration_kappa.py
    New file  services/ai-api/v1/evaluation/__tests__/test_router.py
    New file  services/ai-api/v1/evaluation/__tests__/test_independence.py
        - test_evaluator runs the evaluator against a frozen case and
          asserts dimension scores in [0, 1], rationale is non-empty
        - test_frozen_benchmark refuses non-frozen datasets, refuses
          downgrades, refuses unversioned lookups
        - test_calibration_kappa asserts kappa >= 0.85 on the
          calibration set
        - test_independence: evaluator prompt SHA != tutor prompt
          SHA; judge model name != tutor model name (assert
          os.environ['OPENAI_MODEL_JUDGE'] is set and is NOT
          OPENAI_MODEL_FLASH or OPENAI_MODEL_THINKING)

10. Update  services/ai-api/config/providers.py:117-145
        - Add build_chat_model('judge') and a third env var
          OPENAI_MODEL_JUDGE, OPENAI_JUDGE_MAX_TOKENS, optional
          OPENAI_JUDGE_TEMPERATURE; load in config/envs.py
        - Refuse to start if OPENAI_MODEL_JUDGE is unset or equals
          OPENAI_MODEL_FLASH / OPENAI_MODEL_THINKING (independence
          enforcement at boot)

11. Update  services/ai-api/pyproject.toml:7-30
        - No new runtime deps needed (Cohen's κ is 30 lines; rubric
          comparison is plain string match)
        - Add `[tool.pytest.ini_options]` marker
          `evaluation: marks evaluation-layer tests`

12. Add  data/benchmarks/accounting/v1.schema.json
        - JSON Schema for the frozen benchmark so the loader can
          reject malformed datasets at boot
        - Hash of the dataset is recorded in
          data/benchmarks/accounting/v1.sha256; loader refuses
          to load a dataset whose hash does not match the recorded
          one (frozen-by-hash, not just by isFrozen flag)

13. Update  services/ai-api/config/envs.py:7-32
        - Add EVAL_PROMPT_VERSION, OPENAI_MODEL_JUDGE,
          OPENAI_JUDGE_MAX_TOKENS, CALIBRATION_KAPPA_TARGET=0.85
```
