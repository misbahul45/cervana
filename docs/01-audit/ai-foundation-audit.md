# AI Foundation Audit — services/ai-api

**Scope:** Phase 0 master-prompt §105, §106, §107. Map-and-list depth.
**Audit date:** 2026-10-05.
**Service container:** `reducera_ai_api` :3003. **Source of truth:** `services/api` :3002 (NestJS).
**Evidence rule:** every claim cites a file and line range, or `MISSING` is stated.

---

## 1. Headline Verdict

The service is a **FastAPI application with a thin LangGraph tutor layer over OpenAI + HuggingFace embeddings + Qdrant + Celery**. It is functional for the existing narrow surface (lesson material generation, learning-path generation, quiz generation, three agent shims, resource extraction). It is **NOT** an adaptive tutoring system with typed memory, mastery model, adaptive policy, episode store, decision trace, frozen benchmark, independent evaluator, or self-improvement loop. The boundary with `services/api` is enforced through HTTP, not a typed internal contract.

## 2. Entry Surface (`main.py`, `v1/router.py`)

| Item | Status | Evidence |
|---|---|---|
| FastAPI app with title/version/root | PRESENT | `main.py:9-34` |
| CORS allow-list (not wildcard) | PRESENT | `main.py:14-23` (`ADMIN_URL` + `WEB_URL` only) |
| v1 prefix bound to `APP_VERSION` env | PRESENT | `v1/router.py:6-12` (`prefix=f"/{ENVS['APP_VERSION']}"`) |
| Three sub-routers mounted: resources, users-steps, learning | PRESENT | `v1/router.py:10-12` |
| Agents router mounted separately at `/ai/v1/agents` | PRESENT | `main.py:37` (`agents_router, prefix='/ai'`) |
| 404 handler returns JSON envelope | PRESENT | `main.py:25-30` |
| Health endpoint at `/` | PRESENT | `main.py:32-34` |

## 3. Typed Contracts (`v1/learning/dto.py`, `v1/users_steps/dto.py`)

| Item | Status | Evidence |
|---|---|---|
| Pydantic `BaseModel` for all wire DTOs | PRESENT | `v1/learning/dto.py:1`, `v1/users_steps/dto.py:1-2` |
| `GenerateContentMaterialPipeline` state schema | PRESENT | `v1/learning/dto.py:94-118` |
| `LPState` (learning path state) | PRESENT | `v1/users_steps/dto.py:187-210` |
| `GenerateQuestionPipeline` state schema | PRESENT | `v1/users_steps/dto.py:95-105` |
| `QuizItem` / `QuizResponse` typed schemas | PRESENT | `v1/users_steps/dto.py:127-136` |
| `CitationDto` exists but unused outside docs | PRESENT but INERT | `v1/learning/dto.py:11-15` — never referenced in router/service/workers |
| `UserStepBase` and `LessonBase` schemas | PRESENT | `v1/learning/dto.py:53-91` |
| `AgentRequest` schema | PRESENT | `v1/agents/router_endpoint.py:15-19` |
| Output contract `OUTPUT_SCHEMA` for tutor responses | **MISSING** | no schema enforces typed tutor response — only example in `GenerateContentMaterialResponseDto.Config.schema_extra` |

## 4. Auth and Identity (`config/user_auth.py`, `config/service_auth.py`, `v1/resources/router.py`)

| Item | Status | Evidence |
|---|---|---|
| Bearer-token authentication on user routes | PRESENT | `v1/resources/router.py:18-20` (`authenticate(Authorization, RESOURCE_ROLES)`) |
| Role allow-list for resource routes (`TEACHER`, `ADMIN`) | PRESENT | `v1/resources/router.py:9` |
| Internal signed-contract client (`send_signed`) | PRESENT | `config/service_auth.py:63-89` |
| HMAC-SHA256 signature over `(timestamp, method, target, sha256(body))` | PRESENT | `config/service_auth.py:22-28` |
| Signed headers include trace_id, idempotency_key, acting-user-id | PRESENT | `config/service_auth.py:38-60` |
| Resource routes enforce auth + role | PRESENT | `v1/resources/router.py:13-44` |
| `/v1/learning/chat` auth check | **MISSING** | `v1/learning/router.py:40-60` — `Authorization` header parsed but no role/ownership check |
| `/v1/learning/generate-material` auth check | **MISSING** | `v1/learning/router.py:12-37` — same gap |
| `/v1/users-steps/*` auth check | **PARTIAL** | `v1/users_steps/router.py:21-90` — only checks `token` truthy for `/generate-question`; `/generate` checks bearer starts-with but is in dead code path (lines 111-115 unreachable after `return` on line 109) |
| Signed server-side guard for ai-api **receiving** signed calls | **MISSING** | no verification middleware in `main.py` — `ai-api` only sends signed; it never receives. Internal calls from `services/api` go directly into HTTP routes, not via a signed handshake |

## 5. Structured Configuration (`config/envs.py`, `config/embedding_pipeline.py`, `config/providers.py`)

| Item | Status | Evidence |
|---|---|---|
| Typed `ENVConfig` TypedDict | PRESENT | `config/envs.py:7-32` |
| All env vars loaded once at import | PRESENT | `config/envs.py:34-62` |
| Defaulted fallbacks for every variable | PRESENT | `config/envs.py:35-62` |
| Two LLM modes (flash + thinking) via `build_chat_model(mode)` | PRESENT | `config/providers.py:117-145` |
| HuggingFace embedding with retry + dimension guard | PRESENT | `config/providers.py:27-114` |
| Vector size mismatch at startup aborts boot | PRESENT | `config/vector_collections.py:13-19` |
| Secret rotation support | **MISSING** | secrets read once into `ENVS` TypedDict at import; `INTERNAL_AI_API_SECRET` read fresh per call but no rotation path |
| Typed runtime config schema (e.g. Pydantic `BaseSettings`) | **MISSING** | env is plain `TypedDict` — typos at call sites are silent |

## 6. Structured Output

| Item | Status | Evidence |
|---|---|---|
| `pipeline.llm.with_structured_output(QuizResponse)` for quiz | PRESENT | `v1/users_steps/generate_quiz_pipeline.py:147-151` |
| Quiz schema validated post-parse | PRESENT | `v1/users_steps/generate_quiz_pipeline.py:151` (`QuizResponse.model_validate`) |
| Learning-path output validated against `GenerateUserStepRespon` | PRESENT | `v1/users_steps/generate_user_steps_pipeline.py:351` |
| Personality output validated against `PersonalityQuizResult` | PRESENT | `v1/users_steps/generate_user_steps_pipeline.py:230-237` |
| Tutor response (`generate-material`) structured into `state.generate` dict | PARTIAL | `v1/learning/content_pipeline.py:226-238` — typed `GenerateContentMaterialResponseDto` exists (`v1/learning/dto.py:18-50`) but state stores plain `dict`, no schema validation post-generation |
| Tutor chat response (`generating_new_content`) structured | **MISSING** | `v1/learning/workers.py:78-87` stores `citations: []` literally — no schema |
| Chat-message streaming JSON parse with regex | **MISSING** | `v1/users_steps/generate_user_steps_pipeline.py:344-349` — strips ```json fences by string ops, not structured output |

## 7. Trace Propagation

| Item | Status | Evidence |
|---|---|---|
| `traceId` header support in signed outbound calls | PRESENT | `config/service_auth.py:14, 54` (`TRACE_ID_HEADER = "x-trace-id"`, generated as `uuid4()` if absent) |
| `traceId` propagated through agent endpoint | PARTIAL | `v1/agents/router_endpoint.py:65-87` sends to `decision-trace/record` but trace_id is NOT included in that call |
| `traceId` propagated through Celery workers | **MISSING** | `v1/learning/workers.py:13-39, 42-103` — payload does not contain `traceId`; not generated per task |
| `traceId` propagated through LangGraph tutor run | **MISSING** | `v1/learning/content_pipeline.py:254-271` no trace_id on `state` |
| OpenTelemetry / observability hook | **MISSING** | `pyproject.toml:7-30` has no OTel dependency; `main.py` registers no instrumentation |
| End-to-end trace_id preservation across request → Celery → DB | **MISSING** | no trace_id is generated or carried |

## 8. Idempotency

| Item | Status | Evidence |
|---|---|---|
| `/v1/agents/run` requires `Idempotency-Key` header (>=8 chars) | PRESENT | `v1/agents/router_endpoint.py:27-35` |
| Idempotency key scoped to `(userId, intent, key)` | PRESENT | `v1/agents/router_endpoint.py:36` |
| Idempotency key forwarded to `decision-trace/record` | PRESENT | `v1/agents/router_endpoint.py:79-82` |
| Idempotency-Key on `/v1/learning/chat` | **MISSING** | `v1/learning/router.py:40-60` — no header check |
| Idempotency-Key on `/v1/learning/generate-material` | **MISSING** | `v1/learning/router.py:12-37` — no header check |
| Idempotency-Key on `/v1/users-steps/generate-question` | **MISSING** | `v1/users_steps/router.py:21-90` — none |
| Idempotency-Key on `/v1/users-steps/generate` | **MISSING** | `v1/users_steps/router.py:92-131` — none |
| Idempotency-Key on `/v1/resources/extract` | **MISSING** | `v1/resources/router.py:13-25` — none |
| Idempotency-Key on `/v1/resources/embedding/{id}` | **MISSING** | `v1/resources/router.py:28-44` — none |
| Idempotency table on the API side | PRESENT (per `AGENTS.md`) | out of scope here, but referenced |

## 9. Error Handling and Budgets

| Item | Status | Evidence |
|---|---|---|
| Per-route LLM timeout (`LLM_TIMEOUT_SECONDS=60`) | PRESENT | `config/providers.py:18, 122-125` |
| LLM retry count bounded (`LLM_MAX_RETRIES=2`) | PRESENT | `config/providers.py:19, 122-125` |
| HTTP client timeout for cross-service calls (15s default) | PRESENT | `v1/learning/service.py:18, 27, 46, 59, 67, 83`; `config/service_auth.py:72` |
| LLM-call wrapped in `try/except` with degraded fallback | PRESENT | `v1/learning/content_pipeline.py:76-81, 218-225`; `v1/learning/workers.py:68-75` |
| LLM-call in `prepare_learning_context` swallows all exceptions with bare `except:` | PRESENT but **INERT** | `v1/learning/content_pipeline.py:92-94` — `history_results = []` silently; cannot distinguish "no history" from "API down" |
| RAG retrieval swallowed with bare `except:` | PRESENT but **INERT** | `v1/learning/content_pipeline.py:136-137` (returns empty), `:148-149` (web returns empty), `:36-39, 41-45` (swallows `get_learning_style` and `get_user_step` lookup errors) |
| Bare `except:` in `/v1/learning/chat` and `/v1/learning/generate-material` | PRESENT | `v1/learning/router.py:34-36, 58-60` |
| Agent budget (max iterations, max tokens, max cost) on tutor run | **MISSING** | LangGraph state has no `max_steps` field; `generate_content_material_pipeline` (`v1/learning/content_pipeline.py:264-271`) has no iteration cap |
| Per-run cost / token / latency capture | **MISSING** | no telemetry hook records `inputTokens`, `outputTokens`, `costUsd`, `latencyMs` per episode |
| Per-route rate limit decorator wired | PRESENT | `config/rate_limit.py:88-119`, applied at `v1/resources/router.py:14, 29` |
| Rate limit applied to `/v1/learning/*` | **MISSING** | `v1/learning/router.py` does not apply `@rate_limit` |
| Rate limit applied to `/v1/users-steps/*` | **MISSING** | `v1/users_steps/router.py` does not apply `@rate_limit` |
| Rate limit applied to `/v1/agents/run` | **MISSING** | `v1/agents/router_endpoint.py` does not apply `@rate_limit` |

## 10. Episode Store and Decision Trace

| Item | Status | Evidence |
|---|---|---|
| `Episode` table | **MISSING in ai-api** | schema does not exist in ai-api; no DDL, no migration. Per `AGENTS.md` §2 it is expected in `services/api` Prisma — out of audit scope here |
| Tutor run produces an `Episode` record | **MISSING** | `v1/learning/content_pipeline.py:264-271` returns the final state to the Celery worker; the worker only POSTs `create_content_material` and exits; no episode creation |
| `DecisionTrace` recorded by ai-api | **MISSING** | `v1/learning/content_pipeline.py`, `v1/learning/workers.py`, `v1/users_steps/generate_user_steps_pipeline.py`, `v1/users_steps/generate_quiz_pipeline.py` — none of them POST a decision-trace record |
| `DecisionTrace` recorded by `/v1/agents/run` | PRESENT but best-effort | `v1/agents/router_endpoint.py:64-87` posts to `/v1/agents/decision-trace/record` on the api; failures are silently logged, not retried, not surfaced to caller |
| Decision trace payload includes `agentName`, `agentScope`, `userId`, `promptHash`, `responseHash`, `toolCalls`, `deterministicOutputs` | PRESENT | `v1/agents/router_endpoint.py:69-78` |
| Decision trace includes `learnerStateVersion`, `retrievalVersion`, `policyVersion`, `promptVersion` | **MISSING** | only `promptHash` (sha256 of raw query, not a versioned prompt id) and `responseHash` (also absent in payload) are sent |

## 11. Secrets and PII

| Item | Status | Evidence |
|---|---|---|
| No plaintext secret in repository | PRESENT | `.env` is gitignored (`AGENTS.md`); only `.env.example` ships. `services/ai-api/.env` excluded |
| `OPENAI_API_KEY`, `HF_TOKEN`, `INTERNAL_AI_API_SECRET`, `TAVILY_API_KEY` read from env | PRESENT | `config/envs.py:40-58`, `config/service_auth.py:31-33` |
| `OPENAI_API_KEY` warning if unset | PRESENT | `config/providers.py:118-119` |
| Bearer token carried into Celery payload | **VIOLATION** of master-prompt §3.3 | `v1/learning/router.py:19-22` strips `Bearer ` then forwards `state.dict()` to Celery; `state.token` ends up in the broker payload. Workers `v1/learning/workers.py:20-25, 49-58` also accept `token` in payload |
| `Idempotency-Key` derived from raw user header in `/v1/agents/run` without HMAC | PARTIAL | `v1/agents/router_endpoint.py:36` — `f"{req.userId}:{req.intent}:{idempotency_key}"`; allows client-controlled collision unless idempotency storage enforces user scope |

## 12. CORS, Network, Container

| Item | Status | Evidence |
|---|---|---|
| CORS restricted to ADMIN_URL + WEB_URL | PRESENT | `main.py:14-23` |
| `allow_credentials=True` with non-wildcard origin list | PRESENT | `main.py:20` |
| `allow_methods=["*"]` and `allow_headers=["*"]` | PARTIAL | `main.py:21-22` — broad header list is acceptable here because browser callers need `Authorization`; `allow_methods` should be tightened to `["GET","POST"]` |
| Docker `host` and `port` correct (0.0.0.0:3003) | PRESENT | `main.py:41` (`uvicorn.run("main:app", host="0.0.0.0", port=port)`); default port 3003 from `envs.py:35` |
| Celery worker does NOT spawn as subprocess from ai-api | PRESENT | `config/celery.py:25-34` uses standard Celery app; `__tests__/test_main_no_subprocess_spawn.py` (path only) confirms the no-spawn rule |

## 13. Logging and Observability

| Item | Status | Evidence |
|---|---|---|
| Per-module `logging.getLogger(__name__)` | PRESENT | ubiquitous across services |
| Structured JSON logging | **MISSING** | logs are plain text via stdlib `logging` |
| Request-id / trace-id in every log line | **MISSING** | no logging filter injects trace context |
| Log level configurable via env | **MISSING** | no `LOG_LEVEL` env, hardcoded `INFO` in places (`config/embedding_pipeline.py:27`, `config/memory_embedding.py:19`) |
| Sensitive token redaction in logs | PARTIAL | logs do not contain raw bearer; but bare `print(user_step)` and `print(userStep)` leak internal structures (`v1/learning/service.py:106`, `v1/learning/content_pipeline.py:42`) |

## 14. Test Coverage (foundation-relevant)

| Item | Status | Evidence |
|---|---|---|
| `tests/test_main.py` | PRESENT | path only — file exists, not inspected line-by-line here |
| `__tests__/test_main_no_subprocess_spawn.py` | PRESENT | path only — file exists, not inspected line-by-line here |
| `config/__tests__/test_url_allowlist.py` | PRESENT | referenced by graph cluster 21 |
| `config/__tests__/test_prompt_segmentation.py` | PRESENT | referenced by graph cluster 38 |
| `config/__tests__/test_providers.py` | PRESENT | referenced by graph cluster 18 |
| `config/__tests__/test_rate_limit.py` | PRESENT | referenced by graph cluster 52 |
| `config/__tests__/test_service_auth.py` | PRESENT | referenced by graph cluster 10 |
| `config/__tests__/test_user_auth.py` | PRESENT | file exists |
| `config/__tests__/test_embedding_pipeline.py` | PRESENT | file exists |
| `config/__tests__/test_vector_collections.py` | PRESENT | file exists |
| `utils/tools/__tests__/test_memory.py` | COLLECT-IGNORED | `pyproject.toml:43-44` (`collect_ignore`) |
| `utils/tools/__tests__/test_memory_lesson_scope.py` | PRESENT | file exists |
| `__tests__/test_main_no_subprocess_spawn.py` | PRESENT | file exists |

## 15. Critical Defects (foundation layer)

| Severity | Defect | Location |
|---|---|---|
| CRITICAL | Raw bearer token forwarded into Celery payload | `v1/learning/router.py:19-22` → `v1/learning/workers.py:23, 53` |
| CRITICAL | `NameError` in fallback string for content material error | `v1/learning/workers.py:73` (`user_step_title` is undefined) |
| HIGH | All `/v1/learning/*` and `/v1/users-steps/*` endpoints lack `Idempotency-Key` requirement | `v1/learning/router.py:12-60`, `v1/users_steps/router.py:21-131` |
| HIGH | No trace_id propagation through Celery or LangGraph | `v1/learning/workers.py`, `v1/learning/content_pipeline.py` |
| HIGH | No episode store creation in ai-api | `v1/learning/content_pipeline.py:264-271`, `v1/users_steps/generate_*_pipeline.py` |
| HIGH | No decision trace written by learning or users-steps paths | `v1/learning/content_pipeline.py`, `v1/users_steps/*` |
| MEDIUM | No `@rate_limit` on tutor endpoints | `v1/learning/router.py`, `v1/users_steps/router.py`, `v1/agents/router_endpoint.py` |
| MEDIUM | Bare `except:` blocks silently mask API failures as empty results | `v1/learning/content_pipeline.py:37-39, 44-45, 92-94, 136-149`, `v1/learning/router.py:34-36, 58-60` |
| MEDIUM | Dead-code auth path after early `return` | `v1/users_steps/router.py:107-115` (after `return` on lines 103, 109) |
| MEDIUM | `print()` debug left in production paths | `v1/learning/service.py:106`, `v1/learning/content_pipeline.py:42` |

## 16. Evidence Trail Summary

| Cluster (graph) | Files | What's confirmed |
|---|---|---|
| 0 (services, 33 members) | `v1/learning/service.py`, `v1/users_steps/service.py` | curriculum service: API cross-calls |
| 10 (services, 14 members) | `config/service_auth.py`, `v1/resources/service.py` | signed internal contract |
| 21 (services, 19 members) | `config/url_allowlist.py` | SSRF defense |
| 31 (services, 21 members) | `config/prompt_segmentation.py`, `utils/tools/memory.py` | prompt injection detection |
| 38 (services, 15 members) | `config/prompt_segmentation.py`, `v1/learning/content_pipeline.py` | untrusted content segmentation |
| 52 (services, 10 members) | `config/rate_limit.py` | rate limiting decorator |
| 24 (services, 20 members) | `v1/agents/*` | agent dispatcher + 4 agents |

## 17. What Phase 1 Must Build (foundation layer)

```text
1.  Strip Bearer from Celery payload; pass service identity + acting user + idempotency key only
2.  Inject trace_id at request ingress; propagate to Celery payload and to all LangGraph state
3.  Require Idempotency-Key on every /v1/learning/* and /v1/users-steps/* and /v1/agents/* route
4.  Apply @rate_limit to every route
5.  Create ai-api `Episode` DTO + DDL-free write target (POST to /internal/episodes on api)
6.  Wire decision-trace POST on every LangGraph tutor run, not only /v1/agents/run
7.  Replace bare except: with typed except (HTTPError, LLMError, TimeoutError) and structured error envelope
8.  Fix the NameError in v1/learning/workers.py:73
9.  Remove dead-code auth path in v1/users_steps/router.py:107-115
10. Tighten CORS allow_methods to ["GET","POST"]
11. Add LOG_LEVEL env, structured JSON logging, request-id filter
12. Add typed output schema for tutor /generate-material and chat responses
```