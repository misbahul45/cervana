# PHASE 1 Implementation Plan — AI Foundation

**Source:** Master Prompt for ReduCera AI §107.
**Audit basis:** `docs/01-audit/ai-foundation-audit.md` and the cross-cutting headlines in `docs/01-audit/README.md`.
**Authorization required before any code edit.**

---

## Exit Gate (Master Prompt §107)

```text
[ ] every AI execution is traceable
[ ] every response is schema-valid
[ ] every failure is explicit (no silent swallow)
[ ] no secret/token leakage (no bearer in Celery, no bearer in logs, no bearer in Qdrant payloads)
```

## Sequencing Rule

Items below are listed in **dependency order**, not priority. Items later in the list assume the earlier items exist.

```text
P1-A   Bearer-in-Celery-payload elimination (CRITICAL, master-prompt §3.3)
       ↓
P1-B   trace_id middleware + propagation through Celery + LangGraph state
       ↓
P1-C   Idempotency-Key requirement on every tutor route
       ↓
P1-D   @rate_limit on every tutor route
       ↓
P1-E   Episode DTO + POST /internal/episodes on every LangGraph tutor run
       ↓
P1-F   Decision-trace POST on every LangGraph tutor run (not only /v1/agents/run)
       ↓
P1-G   Typed output schema for /generate-material and /chat responses
       ↓
P1-H   Replace bare except: with typed except + structured error envelope
       ↓
P1-I   Fix the NameError in v1/learning/workers.py:73
       ↓
P1-J   Remove dead-code auth path in v1/users_steps/router.py:107-115
       ↓
P1-K   Tighten CORS allow_methods
       ↓
P1-L   LOG_LEVEL env + structured JSON logging + request-id filter
```

---

## P1-A  Bearer-in-Celery-payload elimination

**Defect:** master-prompt §3.3 explicitly forbids raw bearer propagation through Celery arguments, Redis payloads, persisted jobs, task metadata, URLs, query strings. Today, `v1/learning/router.py:19-22` and `v1/learning/workers.py:20-25, 49-58` put `state.token` into Celery kwargs.

**Approach:** replace the bearer with a *resolved* internal session token issued by `services/api`. The worker calls `send_signed(...)` to a new `/internal/agent-sessions/{id}/resolve` endpoint on api, which exchanges the session-id for a short-lived `acting_user_id` + `trace_id` + `tenant_id` envelope. The bearer never travels past the HTTP boundary into the broker.

**Files to create**

```
services/ai-api/config/agent_session.py
    AgentSession dataclass {session_id, trace_id, acting_user_id, tenant_id, expires_at}
    resolve_or_raise(session_id) -> AgentSession  # calls /internal/agent-sessions/{id}/resolve
```

**Files to modify**

```
services/ai-api/v1/learning/router.py:19-22
    - remove `state.token` from payload
    - add `Idempotency-Key` header parsing (P1-C)
    - call api /internal/agent-sessions/{userId} POST to mint a session_id, return it in 202

services/ai-api/v1/learning/workers.py:20-25, 49-58
    - accept `session_id`, `trace_id`, `acting_user_id` instead of `token`
    - resolve via AgentSession at the start of the task
    - use resolved fields for every HTTP call into api
    - fix line 73 NameError (`user_step_title` undefined)

services/ai-api/v1/learning/dto.py:94-118
    - remove `token: str` from GenerateContentMaterialPipeline
    - add `session_id: str`, `trace_id: str`, `idempotency_key: str`

services/ai-api/v1/users_steps/dto.py:187-210
    - same token → session-id refactor in LPState
```

**Tests**

```
services/ai-api/v1/learning/__tests__/test_no_bearer_in_celery_payload.py
    assert that generate_content_material_task.delay(...) kwargs never contain 'token'
    assert that generate_content_material_task.delay(...) kwargs contain 'session_id', 'trace_id'

services/ai-api/v1/learning/__tests__/test_session_resolution.py
    mock /internal/agent-sessions/{id}/resolve
    assert worker calls resolve once and uses resolved acting_user_id
```

**Acceptance**

```text
[ ] grep -rn 'token.*delay\|token=.*token' services/ai-api/v1/learning/workers.py returns 0
[ ] pyproject.toml: pytest -k 'not in token' passes
[ ] celery worker log line "Resolving session {id}..." present at start of every task
```

---

## P1-B  trace_id middleware + propagation

**Approach:** ASGI middleware that issues `trace_id = uuid4()` at request ingress, attaches to `request.state.trace_id`, and stashes in a `contextvars.ContextVar` for the whole async request and any sync code that reads it. LangGraph state DTOs get a `trace_id` field; workers read it from Celery payload.

**Files to create**

```
services/ai-api/config/trace_context.py
    _trace_id_var: ContextVar[str | None]
    current_trace_id() -> str | None
    set_trace_id(value: str) -> contextvars.Token
    reset_trace_id(token) -> None

services/ai-api/middleware/trace_id.py
    TraceIdMiddleware(BaseHTTPMiddleware)
        generate or read x-trace-id header
        store on request.state
        set in contextvar
        on response, echo header back
        on exception, still echo header
```

**Files to modify**

```
services/ai-api/main.py
    app.add_middleware(TraceIdMiddleware)   # before CORS

services/ai-api/config/logging_config.py        # (created in P1-L)
    inject trace_id into every log line via contextvar filter

services/ai-api/v1/learning/dto.py:94-118
    add trace_id: Optional[str] = None to GenerateContentMaterialPipeline

services/ai-api/v1/users_steps/dto.py:187-210
    add trace_id to LPState

services/ai-api/v1/agents/router_endpoint.py
    pass request.state.trace_id into AgentRequest and forward to decision-trace POST
```

**Tests**

```
services/ai-api/__tests__/test_trace_id_middleware.py
    - request without x-trace-id header → response has x-trace-id
    - request with x-trace-id header → response echoes same value
    - log line emitted during request contains the trace_id

services/ai-api/__tests__/test_trace_id_propagation.py
    - /v1/agents/run with trace_id H → decision-trace POST body includes trace_id H
```

**Acceptance**

```text
[ ] curl -H 'x-trace-id: abc' http://localhost:3003/  → response carries x-trace-id: abc
[ ] one trace_id survives request → middleware → Celery task → api callback (round-trip test)
```

---

## P1-C  Idempotency-Key on every tutor route

**Defect:** only `/v1/agents/run` (`v1/agents/router_endpoint.py:27-35`) requires Idempotency-Key. `/v1/learning/chat`, `/v1/learning/generate-material`, `/v1/users-steps/generate-question`, `/v1/users-steps/generate`, `/v1/resources/extract`, `/v1/resources/embedding/{id}` do not.

**Approach:** decorator `@require_idempotency_key(min_length=8)` mirroring `/v1/agents/run`. If absent, server mints one (uuid4) and stamps the response. If present, it is propagated. Always sent to api.

**Files to create**

```
services/ai-api/middleware/idempotency.py
    @require_idempotency_key decorator
    parse + validate Idempotency-Key header
    attach to request.state.idempotency_key
```

**Files to modify**

```
services/ai-api/v1/learning/router.py:12-60
    apply @require_idempotency_key to both routes
    forward idempotency_key into Celery payload

services/ai-api/v1/users_steps/router.py:21-131
    apply @require_idempotency_key to both routes

services/ai-api/v1/resources/router.py:13-44
    apply @require_idempotency_key to both routes
```

**Tests**

```
services/ai-api/v1/learning/__tests__/test_idempotency_key_required.py
    POST /v1/learning/chat without header → 400 IDEMPOTENCY_KEY_REQUIRED
    POST /v1/learning/chat with header <8 chars → 400
    POST /v1/learning/chat with valid header → 202 with same key in response
```

**Acceptance**

```text
[ ] curl -X POST .../v1/learning/chat  (no header)  → 400 IDEMPOTENCY_KEY_REQUIRED
[ ] all 7 tutor routes require Idempotency-Key
```

---

## P1-D  @rate_limit on every tutor route

**Defect:** `/v1/resources/*` has it. `/v1/learning/*`, `/v1/users-steps/*`, `/v1/agents/*` do not.

**Approach:** add `@rate_limit(capacity_per_minute=…, burst=…)` decorator to each.

**Files to modify**

```
services/ai-api/v1/learning/router.py
services/ai-api/v1/users_steps/router.py
services/ai-api/v1/agents/router_endpoint.py
```

**Tests**

```
services/ai-api/__tests__/test_rate_limit_applied_to_tutor_routes.py
    hit POST /v1/learning/chat 61 times in 1 minute → 61st returns 429
```

**Acceptance**

```text
[ ] all 7 tutor routes return 429 once capacity is exceeded
```

---

## P1-E  Episode DTO + POST /internal/episodes on every tutor run

**Approach:** define an `Episode` Pydantic model with the master-prompt §42 schema (no secrets, no raw tokens). On every Celery task that completes a tutor run, POST to `/internal/episodes` on api with this payload.

**Files to create**

```
services/ai-api/v1/episodes/dto.py
    EpisodeCreate DTO {trace_id, session_id, agent, lesson_id, step_id,
                       topic_id, sub_topic_id, user_id, task, response_excerpt,
                       citations, decision_trace_ref, tokens_in, tokens_out,
                       cost_usd, latency_ms, prompt_version, policy_version,
                       model, retrieval_version, status}
    episode_create(payload, session, trace_id) -> calls /internal/episodes
                       via send_signed() — bearer does not enter Celery payload

services/ai-api/v1/episodes/service.py
    write_episode(state, status, decision_trace_ref) -> EpisodeCreate
        aggregates tokens via response.usage_metadata if available
        computes latency_ms from start_time
        stamps prompt_version="unknown-v0" until registry exists (Phase 9)
```

**Files to modify**

```
services/ai-api/v1/learning/workers.py:20-39, 49-100
    call write_episode(...) after every create_content_material(...) and at end of generating_new_content

services/ai-api/v1/users_steps/workers.py
    same at end of generate_personality_quiz (if exists) and any pipeline that completes

services/ai-api/v1/users_steps/generate_user_steps_pipeline.py:255-370
    after node_generate: call write_episode with the validated plan
```

**Tests**

```
services/ai-api/v1/episodes/__tests__/test_episode_write.py
    mock api POST /internal/episodes
    assert episode payload contains: trace_id, session_id, agent, prompt_version='unknown-v0',
        policy_version='unknown-v0', tokens_in, tokens_out, latency_ms, citations,
        decision_trace_ref
    assert no bearer / no raw token in payload
```

**Acceptance**

```text
[ ] every successful tutor run produces exactly one POST to /internal/episodes
[ ] grep -n 'token' services/ai-api/v1/episodes/dto.py returns 0
```

---

## P1-F  Decision-trace POST on every LangGraph tutor run

**Defect:** only `/v1/agents/run` writes a decision trace (`v1/agents/router_endpoint.py:64-87`), and that POST (a) does not include trace_id and (b) silently swallows failures.

**Files to create**

```
services/ai-api/v1/decision_traces/service.py
    write_decision_trace(decision: DecisionTrace, session, trace_id)
        POST /internal/decision-traces with trace_id header
        raise on failure (do not silently swallow)
        idempotency_key = "dt-{trace_id}-{step_id}"
```

**Files to modify**

```
services/ai-api/v1/agents/router_endpoint.py:64-87
    pass trace_id into the POST body
    raise on HTTP error (do not except)

services/ai-api/v1/learning/workers.py
    after tutor run, call write_decision_trace with the policy-decision metadata
    (in Phase 1, this is a thin stand-in; real reason-codes come in Phase 5)

services/ai-api/v1/users_steps/generate_user_steps_pipeline.py
    same at the end of node_generate

services/ai-api/v1/users_steps/generate_quiz_pipeline.py
    same after analyze_text node
```

**Tests**

```
services/ai-api/v1/decision_traces/__tests__/test_decision_trace.py
    mock POST /internal/decision-traces
    assert body contains trace_id, prompt_version, policy_version, tool_calls
    assert HTTPError is raised (not swallowed)
```

**Acceptance**

```text
[ ] every successful tutor run produces exactly one decision-trace POST
[ ] no try/except that swallows decision-trace write errors
```

---

## P1-G  Typed output schema for tutor responses

**Defect:** `state.generate` in `v1/learning/content_pipeline.py:226-238` is a plain `dict`. Worker `generating_new_content` in `v1/learning/workers.py:78-87` writes `citations: []` literally.

**Approach:** validate the produced dict against `GenerateContentMaterialResponseDto` (`v1/learning/dto.py:18-50`) before persisting. Refuse to persist if it fails.

**Files to modify**

```
services/ai-api/v1/learning/content_pipeline.py:226-238
    validate state.generate against GenerateContentMaterialResponseDto

services/ai-api/v1/learning/workers.py:78-87
    build the response DTO before create_content_material(...) and validate
    drop the hard-coded `citations: []` — pass real citations from the run

services/ai-api/v1/learning/dto.py:18-50
    tighten CitationDto shape (currently has Optional[str] for chunkId; align with retrieve_material_rag output)

services/ai-api/v1/learning/dto.py
    add TutorChatResponseDto for /v1/learning/chat endpoint
```

**Tests**

```
services/ai-api/v1/learning/__tests__/test_tutor_response_schema.py
    assert state.generate validates against GenerateContentMaterialResponseDto
    assert TutorChatResponseDto rejects empty data field
    assert CitationDto rejects negative score
```

**Acceptance**

```text
[ ] grep -n "citations: \[\]" services/ai-api/v1/learning/workers.py returns 0
[ ] Factory call: GenerateContentMaterialResponseDto(**state.generate) succeeds for every fixture
```

---

## P1-H  Replace bare `except:` with typed except + structured error envelope

**Defect:** foundation audit §9, §15 lists all bare `except:` blocks.

**Approach:** define `class AIServiceError(Exception)` with subclasses `LLMError`, `RetrievalError`, `MemoryError`, `CrossServiceError`, `TimeoutError`. Each handler returns `JSONResponse(status_code=…, body={code, message, requestId=trace_id, timestamp})`.

**Files to create**

```
services/ai-api/errors/__init__.py
services/ai-api/errors/types.py
    AIServiceError, LLMError, RetrievalError, MemoryError, CrossServiceError, TimeoutError

services/ai-api/errors/envelope.py
    error_response(exc, trace_id) -> JSONResponse
```

**Files to modify**

```
services/ai-api/main.py
    register exception_handler for AIServiceError and HTTPException

services/ai-api/v1/learning/router.py:30-36, 54-60
    catch ValidationError and AIServiceError (typed), return error_response

services/ai-api/v1/learning/content_pipeline.py
    replace bare except: at lines 37-39, 44-45, 92-94, 136-137, 148-149
    with typed except CrossServiceError, MemoryError, RetrievalError

services/ai-api/v1/learning/workers.py:37-39, 102-104
    same

services/ai-api/v1/users_steps/router.py:44-45, 87-88, 107-109, 128-130
    same
```

**Tests**

```
services/ai-api/__tests__/test_error_envelope.py
    cross-service timeout → JSONResponse with code=CROSS_SERVICE_TIMEOUT, requestId set
    LLM unavailable → LLMError → JSONResponse with code=LLM_UNAVAILABLE, degraded_mode=true
```

**Acceptance**

```text
[ ] grep -rn 'except:' services/ai-api/v1/ services/ai-api/main.py returns 0
[ ] all 5xx responses have {code, message, requestId, timestamp}
```

---

## P1-I  Fix NameError in `v1/learning/workers.py:73`

**Files to modify**

```
services/ai-api/v1/learning/workers.py:73
    replace f"## Materi untuk {user_step_title}\n\n" with f"## Materi untuk {user_step_id}\n\n"
    or fetch user_step_title from get_user_step(user_step_id, token) — but token is gone after P1-A,
        so the failure message should be content_id-less:
        f"## Materi untuk user step {user_step_id}\n\nMateri tidak dapat dihasilkan saat ini. Silakan coba lagi."
```

**Tests**

```
services/ai-api/v1/learning/__tests__/test_chat_worker_fallback_does_not_raise.py
    force the LLM call to raise
    assert the worker finishes without NameError
    assert the persisted content_material has a fallback message that does not mention user_step_title
```

**Acceptance**

```text
[ ] grep -n 'user_step_title' services/ai-api/v1/learning/workers.py returns 0
```

---

## P1-J  Remove dead-code auth path in `v1/users_steps/router.py:107-115`

**Files to modify**

```
services/ai-api/v1/users_steps/router.py:107-115
    delete unreachable lines 111-115
    in the surviving /generate route, apply bearer parse at the top of the function (not after early returns)
```

**Tests**

```
services/ai-api/v1/users_steps/__tests__/test_generate_route_auth.py
    POST /v1/users-steps/generate without Authorization header → 401
    POST /v1/users-steps/generate with valid bearer → 202
```

**Acceptance**

```text
[ ] coverage report shows lines 111-115 removed from execution path
```

---

## P1-K  Tighten CORS allow_methods

**Files to modify**

```
services/ai-api/main.py:21
    allow_methods=["GET", "POST"]
```

**Tests**

```
services/ai-api/__tests__/test_cors_methods.py
    OPTIONS with Access-Control-Request-Method: PUT → reject
    OPTIONS with Access-Control-Request-Method: POST → accept
```

**Acceptance**

```text
[ ] no other HTTP verbs are accepted at the CORS layer
```

---

## P1-L  LOG_LEVEL env + structured JSON logging + request-id filter

**Files to create**

```
services/ai-api/config/logging_config.py
    configure_logging()
        read LOG_LEVEL env (DEBUG/INFO/WARNING/ERROR)
        JSON formatter with timestamp, level, logger, trace_id, message
        install once at import

services/ai-api/config/log_filters.py
    TraceIdFilter
        inject current_trace_id() into every record
```

**Files to modify**

```
services/ai-api/main.py
    configure_logging() before app = FastAPI(...)

services/ai-api/config/embedding_pipeline.py:27
services/ai-api/config/memory_embedding.py:19
    remove logger.setLevel(logging.INFO) (let configure_logging() decide)

services/ai-api/v1/learning/service.py:106
services/ai-api/v1/learning/content_pipeline.py:42
    remove print(...) debug calls
```

**Tests**

```
services/ai-api/__tests__/test_logging_config.py
    LOG_LEVEL=DEBUG → root logger accepts DEBUG records
    a log record emitted inside TraceIdMiddleware scope carries trace_id field
    print() calls are absent in test logs
```

**Acceptance**

```text
[ ] docker logs reducera_ai_api produce JSON lines with trace_id
[ ] grep -rn 'print(' services/ai-api/v1/ returns 0
```

---

## Cross-Cutting Test Plan

```
tests/phase-1-foundation/
    conftest.py                         # shared fixtures: trace_id, fake_api, fake_qdrant
    test_bearer_out_c_elery.py          # P1-A
    test_session_resolution.py          # P1-A
    test_trace_id_middleware.py          # P1-B
    test_trace_id_propagation.py         # P1-B
    test_idempotency_key_required.py     # P1-C
    test_rate_limit_applied.py           # P1-D
    test_episode_write.py                # P1-E
    test_decision_trace.py               # P1-F
    test_tutor_response_schema.py        # P1-G
    test_error_envelope.py               # P1-H
    test_chat_worker_fallback.py         # P1-I
    test_generate_route_auth.py          # P1-J
    test_cors_methods.py                 # P1-K
    test_logging_config.py               # P1-L
```

---

## Sequencing For Owner Review

The owner should approve these as separate units of work:

```text
1. P1-A  Bearer-in-Celery-payload elimination   (CRITICAL security)
2. P1-I  NameError fix                          (CRITICAL correctness)
3. P1-B  trace_id middleware + propagation      (foundational)
4. P1-C  Idempotency-Key on tutor routes        (contract hardening)
5. P1-D  @rate_limit on tutor routes            (operational)
6. P1-E  Episode store + POST /internal/episodes (observability)
7. P1-F  Decision-trace POST on every tutor run  (observability)
8. P1-G  Typed tutor output schema              (contract hardening)
9. P1-H  Typed except + structured error envelope (contract hardening)
10. P1-J Dead-code removal                       (cleanup)
11. P1-K CORS tightening                         (security)
12. P1-L Structured logging                       (observability)
```

After items 1, 2, 3, and 4 are merged the existing call paths in `services/web` and `services/api` will need their callers to start sending `Idempotency-Key`. The owner will need to coordinate the rollout across the three services.

---

## Authorization Required

Each item P1-A through P1-L is a **Tier 1 (reversible local write)** under `AGENTS.md`, except for the breaking-contract change in P1-C (which is Tier 2 because `/v1/learning/chat` and `/v1/learning/generate-material` will start returning 400 to any existing caller that does not send `Idempotency-Key`).

I will not start editing code without explicit owner authorization. Please confirm:

```text
[ ] I authorize P1-A through P1-L in the order above.
[ ] I authorize only specific items (list them).
[ ] I authorize with the modification that (state it).
```

Until then, I have produced no code changes beyond the 9 audit documents and this plan.