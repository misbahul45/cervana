# AI Audit — services/ai-api

> **Status**: `stable` · **Owner**: `ml-lead` · **Last reviewed**: `2026-10-09`
>
> LLM access, routing, prompts, pipelines, error handling and tests of the ai-api service at `HEAD cb0572f`.

---

## Scope

`services/ai-api`: FastAPI app, Celery worker modules, LLM registry and router, prompt layering, structured output, error and trace middleware, test suite. Agents, memory, RAG, learner model, evaluation and self-improvement have their own documents; this file covers the shared AI foundation and the reachability of every package.

## Findings

### Reachability of ai-api packages

Static import graph from `main`, `config.celery` and the three worker modules (126 production modules, 15,373 lines). "Called" was checked by reading call sites, not inferred from imports.

| Package | Production modules / lines | Imported from a production entry | Called by a production path | Status |
|---|---|---|---|---|
| `config` (registry, router, auth, rate limit, embedding, trace, session, prompt segmentation) | 18 / 2,072 | yes | yes (except `llm_output.py`, M-006) | `IMPLEMENTED` / `PARTIAL` |
| `errors`, `middleware` | 6 / 310 | yes | yes (`main.py:26,47`) | `IMPLEMENTED` |
| `v1/learning`, `v1/users_steps`, `v1/resources` | 5 + 6 + 4 / 3,243 | yes | yes | `BROKEN` at the api boundary (C-001) |
| `v1/episodes`, `v1/decision_traces` | 3 + 3 / 287 | yes (workers) | yes, every request fails (C-001) | `BROKEN` |
| `v1/agents` | 6 / 265 | yes (`main.py:66`) | `POST /ai/v1/agents/run` | `PARTIAL` |
| `v1/tutor` | 6 / 951 | `tutor_state`, `context_loaders`, `personalization_prompt` via `content_pipeline.py:14-16`; `tool_registry`, `golden_scenarios` only through the `__init__` re-export | prompt renderers: yes, with empty learner blocks. `TutorRuntime` methods: no | `UNWIRED` (H-004) |
| `v1/domain` | 22 / 2,070 | `render_domain_context`, `load_default_taxonomy` | ontology text is placed in prompts; validators and tools are not called | `PARTIAL` |
| `v1/learner_model` | 8 / 1,185 | via `tutor` | no production caller constructs a `LearnerState` | `UNWIRED` |
| `v1/memory` | 9 / 963 | via `tutor` | no | `UNWIRED` |
| `v1/evaluation` | 6 / 1,476 | **no** | no | `UNWIRED` |
| `v1/optimization` | 10 / 1,211 | **no** | no | `UNWIRED` |
| `v1/gamification` | 5 / 437 | **no** | no | `UNWIRED` |
| `v1/research` | 3 / 518 | **no** | no | `UNWIRED` |
| `scripts/ingest_golden_graph.py` | 1 | no (operator script) | run manually; 65 chunks present | `IMPLEMENTED` as a script |

Totals: 126 modules and 15,373 lines; 100 modules reachable by import, 26 not (3,782 lines: evaluation 6, optimization 10, gamification 5, research 3, plus `config/llm_output.py` and `scripts/ingest_golden_graph.py`). Re-run after the owner's commit: unchanged.

### LLM access and routing

| Feature | Status | Source | Notes |
|---|---|---|---|
| Provider registry (`openai`, `mistral`), per-route overrides via `LLM_ROUTES`, 60 s timeout, 2 retries | `IMPLEMENTED` | `services/ai-api/config/llm_registry.py:15-18,55-70` | tests in `config/__tests__/test_llm_registry.py` |
| Versioned routing policy `routing-v1`: task → flash/thinking, complexity score, one failure escalation | `IMPLEMENTED` | `services/ai-api/config/model_router.py:21-40,190-340,357` | `ModelRouter.invoke` returns text only; token usage and cost are not captured (`_attempt`, `:309-335`); per-attempt latency is kept in an in-memory `OutcomeLog` (capacity 1000) |
| Router adoption | `PARTIAL` | 3 router call sites: `learning/workers.py:206`, `learning/content_pipeline.py:161,365` | 5 direct LLM calls bypass it: `users_steps/generate_quiz_pipeline.py:81,181`, `users_steps/service.py:245`, `users_steps/generate_user_steps_pipeline.py:231,359` |
| Compose forwards LLM variables | `IMPLEMENTED` | all services load `.env` via `env_file` (`docker-compose.yml:14,44,70,…`) | also the cause of C-004 |

### Prompt architecture

| Feature | Status | Source | Notes |
|---|---|---|---|
| Typed, trust-labelled prompt blocks | `PARTIAL` | `services/ai-api/config/prompt_segmentation.py:115-190` builds 10 blocks (`system_policy`, `educational_policy`, `course_context`, `learner_state`, `relevant_memory`, `adaptive_strategy`, `current_task`, `retrieved_documents`, `user_input`, `tool_outputs`) with trust attributes | `experience_context` and `output_contract` layers do not exist in the builder |
| Fence neutralization and instruction detection | `IMPLEMENTED` | `prompt_segmentation.py:58-100,191` | used on retrieved, tool and user text |
| Material prompt uses the builder | `PARTIAL` | `content_pipeline.py:336-363` | `learner_state` argument is the string `"Learning Style: {x}"`; `adaptive_strategy` is a fixed formatting instruction (`:357-361`) |
| Chat prompt uses the builder | `MISSING` | `learning/service.py:325-359` is a single f-string with fences added by hand | contradicts the typed-layer requirement |
| Prompt versions | `MISSING` | no `prompt_version` is set by any production path; api defaults `'unknown-v0'` (`internal-episodes.controller.ts`) | |

### Structured output and failures

| Feature | Status | Source | Notes |
|---|---|---|---|
| Typed tutor response (`TutorResponse` with strategy, citations, next action, signals) | `MISSING` | the live response type is `GenerateContentMaterialResponseDto` (text + citations + metadata); the lesson is free prose in `data` | validation covers the container only (`content_pipeline.py:387-400`) |
| JSON/schema validators for LLM output | `UNWIRED` | `services/ai-api/config/llm_output.py:1-37` | M-006 |
| Typed errors and envelope | `IMPLEMENTED` | `services/ai-api/errors/{types,envelope,handlers}.py`; `main.py:47` | tests `test_error_handlers.py` |
| LLM failure surfaced as typed error | `PARTIAL` | chat: `LLMError` (`learning/workers.py:215-220`); material analysis: silent substitution (`content_pipeline.py:167-173`, M-005) | |
| Trace id propagation inside ai-api | `IMPLEMENTED` | `services/ai-api/middleware/trace_id.py:19-30` reads `x-trace-id`, sets a context variable, echoes the header | `test_trace_id_middleware.py`; nginx and the BullMQ processors set no trace id (M-010) |
| Cost and latency capture per interaction | `MISSING` | `learning/workers.py:132-135` writes `tokens_in/out/cost/latency = None` | H-003 |

### H-010

**LLM configuration split across duplicates.** `.env` held `OPENAI_API_KEY` and `OPENAI_BASE_URL` twice: lines 71–72 (Flaz key `sk-…`, `https://ai.flaz.id/v1`) and 107–108 (Mistral key `mst…`, `https://api.mistral.ai/v1`), with Flaz model ids at lines 73–74. Docker Compose used the first occurrence (the running `ai-api` showed the Flaz URL, Flaz models and the 25-character `sk-` key); python-dotenv used the last. The local test run therefore authenticated differently from the containers and received `401 Invalid API Key`. `.env.example` had the same duplicate (`OPENAI_BASE_URL` at lines 78 and 113). Fixed on 2026-10-09 at the owner's direction: one Mistral block, models `mistral-small-latest` and `magistral-medium-latest` (the Mistral defaults in `services/ai-api/config/envs.py`), no Flaz entry left. Not verified: whether the Mistral key authenticates (the probe was declined), whether these models match the benchmark in `docs/plans/reducera-v1-execution-plan.md` §3.4 (not re-run), and the containers, which still carry the old values until recreated. The native provider switch (`LLM_PROVIDER=mistral`, `MISTRAL_*`) exists in `config/envs.py:46-57` and is unused.

### H-013

**Seven failing tests specify unfinished work.** All are in `services/ai-api/v1/users_steps/__tests__/test_pipelines_routing.py`: `TestPersonalityMaterial` (2), `TestPathPlanning` (2), `TestQuizGeneration` (3). They patch the router and expect the `users_steps` pipelines to call it. The pipelines call `pipeline.llm` directly instead, so the tests fail with `AttributeError: 'types.SimpleNamespace' object has no attribute 'llm'` (`generate_quiz_pipeline.py:81`), with `ValidationError … order Field required` (`generate_user_steps_pipeline.py:391`), and with a real client call that returns `401 Invalid API Key`. The tests are ahead of the code; they are not stale.

### M-005

**Silent substitution and a `None` dereference.** On any exception from the analysis call, `prepare_learning_context` replaces the model output with the string `"Analysis unavailable for …"` and continues (`content_pipeline.py:167-173`), then writes that text to memory (`:177-183`). `user_step` is allowed to be `None` after `parallel_fetch` (`:108-115`) but is dereferenced at `:144,155,164`.

### M-006

**Unused validators.** `config/llm_output.py` (`parse_json_object`, `json_validator`) is imported by no production module; its single importer is a test.

## Evidence citations

- `services/ai-api/main.py:26-66`; `services/ai-api/v1/router.py:10-12`; `services/ai-api/config/celery.py:29-33`
- `services/ai-api/config/{llm_registry,model_router,prompt_segmentation,llm_output,envs}.py` (lines as cited)
- `services/ai-api/v1/learning/{content_pipeline,workers,service}.py`; `services/ai-api/v1/users_steps/*.py`
- `.env` (key names, lengths and prefixes only), `docker compose exec ai-api printenv` (masked), pytest output 2026-10-09
- Import graph: `scratchpad/import_graph.py`, run twice (before and after commit `cb0572f`)

## Verdict

The shared foundation (registry, router, error envelope, trace middleware, prompt fences) is real, tested and in use, but incomplete: the router covers 3 of 8 LLM calls, nothing captures tokens or cost, and the prompt builder lacks two required layers and is bypassed by the chat path. About a fifth of the modules (24 of 126, in evaluation, optimization, gamification and research) are unreachable, and the tutor package is reached only through its prompt renderers. The service is not a bounded agent runtime; it is a set of Celery tasks that run short linear pipelines.
