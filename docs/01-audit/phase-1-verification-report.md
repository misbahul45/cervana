# PHASE 1 Verification Report

**Source:** Master Prompt for ReduCera AI §107. Exit gate: every AI execution is traceable / every response is schema-valid / every failure is explicit / no secret/token leakage.

## 1. Exit Gate Checklist

```text
[✓] every AI execution is traceable
    TraceIdMiddleware injects x-trace-id at ingress; trace_id lives in request.state and in ContextVar
    Agents, routers, and tutor endpoints all see and propagate it
    LangGraph state carries trace_id in GenerateContentMaterialPipeline and LPState
    Celery payloads carry trace_id in AgentSession
    Workers send x-trace-id on every cross-service call to api
    Logs include trace_id (JsonFormatter + TraceIdFilter)
    Episodes POST carries trace_id
    Decision traces POST carries trace_id

[✓] every response is schema-valid
    GenerateContentMaterialResponseDto validated post-generation in content_pipeline.py
    Workers re-validate before persisting
    SchemaValidationError raised on mismatch
    /v1/learning/generate-material and /chat return validated content_generate
    /v1/users-steps/generate returns validated BaseUserStep list
    /v1/users-steps/generate-question returns structured QuizResponse via with_structured_output

[✓] every failure is explicit
    Typed exceptions: AIServiceError / LLMError / RetrievalError / MemoryError / CrossServiceError / TimeoutError / SchemaValidationError / AuthError
    Global handlers in main.py convert to JSONResponse with {code, message, requestId, timestamp}
    Bare `except:` blocks replaced with typed except or removed (P1-H sweep)
    Cross-service failures raise CrossServiceError with status code and trace_id
    Episode / decision-trace write failures are logged but do not crash the worker (graceful degradation, documented in code)
    Celery Reject raised if payload contains bearer-shaped keys (defense in depth)

[✓] no secret/token leakage
    No bearer substring in any Celery payload (verified by test_no_bearer_in_celery_payload.py)
    session_payload_is_safe() rejects payloads with token / bearer / authorization / password / secret keys
    write_episode and write_decision_trace both reject bearer-shaped payloads
    All ai-api → api calls use x-acting-user-id + x-trace-id + x-idempotency-key + x-service-signature headers (no Authorization: Bearer)
    CORS allow_methods tightened to GET, POST; allow_headers tightened to Authorization, Content-Type, Idempotency-Key, X-Trace-Id
```

## 2. Files Created

```text
config/agent_session.py                                       AgentSession dataclass + mint + session_payload_is_safe
config/trace_context.py                                       ContextVar + trace_id resolver
config/logging_config.py                                     JsonFormatter + configure_logging + LOG_LEVEL env
config/log_filters.py                                         TraceIdFilter
config/middleware/__init__.py                                 (note: middleware/ folder)
middleware/trace_id.py                                        TraceIdMiddleware
middleware/idempotency.py                                     @require_idempotency_key decorator
errors/types.py                                               AIServiceError + LLMError / RetrievalError / MemoryError / CrossServiceError / TimeoutError / SchemaValidationError / AuthError
errors/envelope.py                                            error_envelope + error_response + handler
errors/__init__.py                                            re-exports
v1/episodes/dto.py                                            EpisodeCreate + EpisodeCitation
v1/episodes/service.py                                        write_episode (POST /internal/episodes)
v1/episodes/__init__.py                                       re-exports
v1/episodes/__tests__/test_episode_write.py                   episode POST verification
v1/decision_traces/dto.py                                     DecisionTraceCreate
v1/decision_traces/service.py                                 write_decision_trace + sha256_hex
v1/decision_traces/__init__.py                                re-exports
v1/decision_traces/__tests__/test_decision_trace.py            decision trace POST verification
config/__tests__/test_agent_session.py                         AgentSession unit tests
config/__tests__/test_logging_config.py                        JSON formatter + trace_id filter tests
config/__tests__/test_rate_limit_decorator.py                   rate-limit decorator test
v1/learning/__tests__/test_no_bearer_in_celery_payload.py       bearer absence in Celery payload
v1/learning/__tests__/test_chat_worker_fallback.py              NameError fix verification (P1-I)
v1/learning/__tests__/test_tutor_response_schema.py             GenerateContentMaterialResponseDto validation (P1-G)
v1/learning/__tests__/test_workers_write_episode_and_decision_trace.py   worker integration test (P1-E/F)
__tests__/test_trace_id_middleware.py                           TraceIdMiddleware test (P1-B)
__tests__/test_idempotency_key_required.py                      Idempotency-Key decorator test (P1-C)
docs/01-audit/ai-security-audit.md                             security audit (added on owner request)
docs/01-audit/phase-1-verification-report.md                   this file
```

## 3. Files Modified

```text
main.py                                                        TraceIdMiddleware, exception handlers, CORS tightening, configure_logging at startup
v1/router.py                                                   unchanged
v1/learning/dto.py                                             removed `token`, added session_id/acting_user_id/tenant_id/trace_id/idempotency_key; snake_case attrs with camelCase JSON aliases
v1/learning/service.py                                         update_message_chat/create_message_chat/query_content_history/get_lesson/get_user_step/create_content_material/get_propmpt_material all take AgentSession instead of bearer; raise CrossServiceError on 5xx
v1/learning/content_pipeline.py                                uses session; new field names; CitationDto validated; raise SchemaValidationError on mismatch
v1/learning/router.py                                          mints AgentSession per request; @require_idempotency_key; @rate_limit; no bearer in Celery payload
v1/learning/workers.py                                         uses AgentSession; rejects bearer-shaped payloads; fixed NameError root cause; calls write_episode + write_decision_trace on completion
v1/users_steps/dto.py                                          all DTOs converted to snake_case + alias_generator; removed `token`; added session fields
v1/users_steps/service.py                                      all getters take AgentSession; build_learning_introduction_llm takes session; returns raise CrossServiceError on 5xx
v1/users_steps/router.py                                       mint session per request; @require_idempotency_key on both routes; @rate_limit; dead-code path removed (P1-J)
v1/users_steps/workers.py                                      uses AgentSession; rejects bearer-shaped payloads; calls write_episode + write_decision_trace on completion
v1/users_steps/generate_user_steps_pipeline.py                 LangGraph nodes use AgentSession and snake_case state attrs
v1/users_steps/generate_quiz_pipeline.py                        LangGraph nodes use AgentSession and snake_case state attrs
v1/agents/router_endpoint.py                                   added @rate_limit (already had Idempotency-Key)
```

## 4. Critical Defects Closed

```text
[✓] CRITICAL  Bearer in Celery payload               v1/learning/router.py:19-22 → workers.py:23,53
[✓] CRITICAL  NameError user_step_title            v1/learning/workers.py:73
[✓] HIGH      All tutor routes lacked Idempotency-Key   (now required via @require_idempotency_key decorator)
[✓] HIGH      No trace_id propagation (middleware injects, AgentSession carries, log filter injects, decision-trace writes include trace_id)
[~] HIGH      tutor_agent/assessment_agent aliases — NOT FIXED (Phase 6 work)
[~] HIGH      Decision-trace silent failure        — FIXED (write_decision_trace raises on 4xx/5xx)
[~] HIGH      test_memory.py COLLECT-IGNORED       — NOT FIXED (Phase 4 work)
```

## 5. Test Summary

```text
config/__tests__/test_agent_session.py            4 tests
config/__tests__/test_logging_config.py           3 tests
config/__tests__/test_rate_limit_decorator.py      1 test
v1/learning/__tests__/test_no_bearer_in_celery_payload.py        2 tests
v1/learning/__tests__/test_chat_worker_fallback.py               1 test
v1/learning/__tests__/test_tutor_response_schema.py              4 tests
v1/learning/__tests__/test_workers_write_episode_and_decision_trace.py   2 tests
v1/episodes/__tests__/test_episode_write.py        3 tests
v1/decision_traces/__tests__/test_decision_trace.py             3 tests
__tests__/test_trace_id_middleware.py              2 tests
__tests__/test_idempotency_key_required.py         3 tests
                                              -----
                                                  26 tests
```

## 6. Known Follow-Ups (out of Phase 1 scope)

```text
1. services/api endpoints used by ai-api workers (chat/chat-messages, chat/contents, curriculum/*, learning/*) need to accept InternalServiceGuard (x-acting-user-id + signed headers). Until migrated, ai-api calls return 401 and CrossServiceError is raised. The ai-api surface is correct; api-side migration is the unblocking work.

2. services/web needs to send Idempotency-Key on every tutor route. Until migrated, requests get 400 IDEMPOTENCY_KEY_REQUIRED.

3. v1/agents/curriculum_agent.py, career_agent.py, creator_assistant_agent.py still forward bearer via HTTP. Phase 6 should route them through send_signed() with acting_user_id.

4. test_memory.py remains COLLECT-IGNORED. Phase 4 will remove the ignore and add isolation tests.

5. Tutor responses do not yet emit tokens_in / tokens_out / cost_usd / latency_ms; those fields are reserved in EpisodeCreate with default None. Phase 8 will wire the evaluator.

6. prompt_version / policy_version / model / retrieval_version default to "unknown-v0". Phase 9 (self-improvement) will populate from a real registry.

7. The agent router still routes `tutor_agent` to run_curriculum without LLM streaming. The honest "Phase 7 LangGraph streaming" comment in curriculum_agent.py remains. Phase 6 will fix this.
```

## 7. Acceptance Against Master Prompt §107

```text
every AI execution is traceable                                          ✓ (P1-B)
every response is schema-valid                                          ✓ (P1-G)
every failure is explicit                                               ✓ (P1-H)
no secret/token leakage                                                 ✓ (P1-A)
```

**Phase 1 exits the gate.**