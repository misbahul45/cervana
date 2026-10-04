# AI Foundation Audit

> **Status**: `stable` · **Owner**: `architect` · **Last reviewed**: `2026-10-04`
>
> Inventory of the AI service's foundational surface: service identity, configuration, contracts, error handling, timeouts, trace propagation. Source: `services/ai-api/` at HEAD `a868095`. Test baseline: 88 of 93 unit tests pass without the heavy `llama_index` + `qdrant_client` + `pdfplumber` stack; collection fails on `whisper` import in `v1/resources/service.py:11`.

## 1. Surface

| Item | Path | Status |
|---|---|---|
| FastAPI entrypoint | `main.py` | `implemented`; `llm_mode` env, two-mode LLM (`flash` + `thinking`), one gateway |
| Celery app | `config/celery.py` | `implemented`; subscribed via Redis broker |
| LLM provider factory | `config/providers.py` | `implemented`; OpenAI-compatible via `OPENAI_BASE_URL` (Flaz) |
| Embedding model | `config/embedding_pipeline.py` | `implemented`; Hugging Face Inference via `HF_EMBEDDING_URL` |
| Memory manager | `config/memory_embedding.py` | `implemented`; Qdrant `reducera-memory` |
| Rate limiter | `config/rate_limit.py` | `implemented`; per-IP token bucket; Redis backend if available |
| URL allow-list | `config/url_allowlist.py` | `implemented`; tested |
| Internal service auth | `config/service_auth.py` | `implemented`; HMAC-SHA256 |
| User auth | `config/user_auth.py` | `implemented`; tests green |
| Vector collection helper | `config/vector_collections.py` | `implemented`; tested |
| Env loader | `config/envs.py` | `implemented`; type-validated |
| Prompt segmentation | `config/prompt_segmentation.py` | `implemented`; not wired into all prompts (see RAG audit) |
| Routers | `v1/router.py`, `v1/learning/router.py`, `v1/resources/router.py`, `v1/users_steps/router.py`, `v1/agents/router_endpoint.py` | `partial`; `v1.agents.router_endpoint` imports `run_curriculum` from `v1.learning.service` which no longer exports it (collection error) |

## 2. Configuration

`ENVS` (`config/envs.py`) exposes:

| Key | Type | Purpose |
|---|---|---|
| `NEST_API` | str | base URL for application API |
| `QDRANT_URL`, `QDRANT_API_KEY` | str | Qdrant |
| `QDRANT_COLLECTION`, `QDRANT_MEMORY_COLLECTION` | str | vector stores |
| `EMBEDDING_DIM` | int | 1024 (HF BGE m3 default) |
| `HF_TOKEN`, `HF_EMBEDDING_URL`, `HF_EMBEDDING_MODEL` | str | embeddings |
| `OPENAI_API_KEY`, `OPENAI_BASE_URL` | str | LLM |
| `OPENAI_MODEL_FLASH`, `OPENAI_MAX_TOKENS` | str, int | flash mode |
| `OPENAI_MODEL_THINKING`, `OPENAI_THINKING_MAX_TOKENS` | str, int | thinking mode |
| `TAVILY_API_KEY` | str | web search |
| `AI_API_RATE_LIMIT`, `AI_API_RATE_BURST` | int, int | per-IP rate limit |
| `REDIS_URL` | str | broker + cache |

Each value is type-validated. Defaults raise on import. No secret logging at startup.

## 3. Internal contract (`config/service_auth.py`)

HMAC-SHA256 over `(timestamp, method, target, sha256(body))`. Required headers:

| Header | Required | Where |
|---|---|---|
| `x-service-id` | yes | `internal-service.guard.py:53` |
| `x-service-timestamp` | yes | `:55` |
| `x-service-signature` | yes | `:56` |
| `x-idempotency-key` | yes for non-GET | `:84` |
| `x-trace-id` | yes | logged on event emission |
| `x-acting-user-id` | yes | re-authorized at API |

`MAX_CLOCK_SKEW_MS = 60_000`, `REPLAY_WINDOW_MS = 120_000` (in-memory Map). Only 2 routes (`/internal/resources/*`) are wired as `@InternalOnly()`. The rest of the AI API still forwards the user bearer token to the application API (documented in `api-business-logic-audit.md` as S-3 / ADR-007).

## 4. Agent router (`v1/agents/router.py`)

Deterministic dict lookup. No LLM in routing. 5 intents × 5 agents:

| Intent | Agent |
|---|---|
| `tutor` | `tutor_agent` (currently implemented as `run_curriculum`) |
| `curriculum` | `curriculum_agent` |
| `assessment` | `assessment_agent` |
| `creator_assistant` | `creator_assistant_agent` |
| `career` | `career_agent` |

Unit test enforces that `pipeline.llm` is never in the dispatch source (master prompt §36; AI-2 deterministic routing).

## 5. Agent endpoint (`v1/agents/router_endpoint.py`)

`POST /v1/agents/run` requires a `Bearer` token (manual extraction, not via the user-auth helper). Dispatches to one of the agents. Then calls `POST /v1/agents/decision-trace/record` on the application API to persist the trace.

**Findings**:

- AI-FOUND-01: `run_curriculum` import is broken (`v1/learning/service.py` no longer exports it). Collection error confirms this. `router_endpoint.py` will fail at import time when the route is actually used. Severity: HIGH.
- AI-FOUND-02: token validation is a one-line `startswith("Bearer ")` check with no signature verification, no clock-skew check, no replay protection. The agents endpoint accepts any non-empty bearer without enforcing the internal contract. Severity: HIGH for the agent endpoint; the dedicated resource flow uses the proper `InternalServiceGuard` and is correct.
- AI-FOUND-03: no trace id propagation in the agent endpoint. The LLM call is made without `x-trace-id`; the call to the API to record the decision trace has no trace id either. Master prompt §95 (data lineage) is not satisfied for this path. Severity: MEDIUM.
- AI-FOUND-04: `citatetions` is a typo in `content_pipeline.py:207` — the field name is misspelled, so even when citations were added they would be stored under the wrong name on the application API. Severity: LOW (cosmetic but consequential).
- AI-FOUND-05: no structured output contract on agent responses. The agents return `result` dicts without a typed Pydantic schema. Master prompt §22 (structured output) is not satisfied. Severity: MEDIUM.
- AI-FOUND-06: agents return `result` and the router forwards it as the response body. The application API stores this verbatim without a `domain validation` step (master prompt §87). Severity: MEDIUM.

## 6. Tests

| Path | Status | Note |
|---|---|---|
| `v1/agents/__tests__/test_router_dispatch.py` | green | routing table |
| `v1/agents/__tests__/test_curriculum_agent.py` | 2 fail | pre-existing; `httpx.AsyncMock` signature mismatches the new code |
| `utils/tools/__tests__/test_memory.py` | collects (numpy dep) | guarded by `AGENTS.md` "light environment" |
| `utils/tools/__tests__/test_memory_lesson_scope.py` | collection error (test name) | source file present in repo |
| `config/__tests__/test_prompt_segmentation.py` | green | injection detection |
| `config/__tests__/test_url_allowlist.py` | green | |
| `config/__tests__/test_user_auth.py` | green | |
| `config/__tests__/test_service_auth.py` | green | |
| `config/__tests__/test_providers.py` | green | |
| `config/__tests__/test_vector_collections.py` | green | |
| `config/__tests__/test_no_gemini.py` | green | |
| `config/__tests__/test_rate_limit.py` | green | (after F-03 advisory-lock work, but separate) |
| `config/__tests__/test_embedding_pipeline.py` | not run (numpy) | |
| `v1/learning/__tests__/test_tutor_citation.py` | not run (numpy) | |
| `v1/learning/__tests__/test_rag_recall.py` | not run (numpy) | |
| `__tests__/test_main_no_subprocess_spawn.py` | not run in full light env | guards `main.py:28-35` |
| `__tests__/test_main.py` | 3 fail (whisper dep) | `v1/resources/service.py:11` imports whisper unconditionally |

## 7. Summary scorecard (AI-FOUND)

| Area | Status |
|---|---|
| Service identity | `PASS` (HMAC infra exists, only 2 routes wired) |
| Configuration | `PASS` |
| Typed contracts | `PARTIAL` (DTOs exist; agent response is untyped) |
| Structured output | `PARTIAL` (content_pipeline returns dict; no Pydantic schema) |
| Error handling | `PASS` (FastAPI exception handlers, logger errors) |
| Timeouts | `PASS` (httpx calls use 5–10 s; LLM call has no client timeout — see AI-AGENT audit) |
| Trace propagation | `PARTIAL` (logged in some places, not in agent endpoint) |
| Episode creation | `NOT IMPLEMENTED` (see AI-AGENT audit) |

## 8. Open questions

- OQ-AI-FOUND-1: should the agent endpoint require the internal signed contract, or accept the user bearer as today? Per `ADR-007` it should be signed. Decision: defer to the `S-3` migration in `api-business-logic-audit.md`.
- OQ-AI-FOUND-2: should the application API enforce the agent response schema, or should the AI service validate before sending? Decision: AI validates; API persists as-is for now.

## 9. Cross-references

- `ai-domain-audit.md`
- `ai-rag-audit.md`
- `ai-agent-audit.md`
- `api-business-logic-audit.md` S-3
