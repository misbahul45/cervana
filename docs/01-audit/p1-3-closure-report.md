# P1-3 Closure — Internal API Endpoints

**Date:** 2026-10-05
**Scope:** Add the three internal API endpoints that ai-api has been ready to call since Phase 1 (per `docs/01-audit/phase-1-implementation-plan.md` P1-A, P1-E, P1-F).
**Status:** **RESOLVED** with end-to-end signed-contract verification.

---

## 1. What was added

Three new controllers in `services/api/src/v1/internal/`:

```text
internal-episodes.controller.ts        — POST /internal/episodes
internal-decision-traces.controller.ts — POST /internal/decision-traces
internal-agent-sessions.controller.ts  — POST /internal/agent-sessions
                                       POST /internal/agent-sessions/resolve
                                       GET  /internal/agent-sessions/{id}/resolve
```

Plus the `internal.module.ts` was extended to import `PrismaModule`, `IdempotencyModule`, and `AuthzModule` and to register the three new controllers.

Total internal routes in live OpenAPI: **11** (was 2 before P1-3).

```text
/internal/agent-sessions
/internal/agent-sessions/resolve
/internal/agent-sessions/{id}/resolve
/internal/credits/reservations
/internal/credits/reservations/{id}/release
/internal/credits/reservations/{id}/settle
/internal/credits/top-up
/internal/decision-traces          ← NEW
/internal/episodes                  ← NEW
/internal/resources/callback
/internal/resources/{id}
```

## 2. Schema mapping (AI contract → Prisma)

### `POST /internal/episodes`

The AI's `EpisodeCreate` (Pydantic, camelCase) is mapped to the api's `Episode` (Prisma) row:

| AI field | Prisma field | Notes |
|---|---|---|
| `acting_user_id` | `userId` | falls back to `user_id` if provided |
| `agent` | `taskType` |  |
| `task`, `lesson_id`, `step_id`, `topic_id`, `sub_topic_id`, `status`, `error`, `intent` | `inputPayload` (Json) |  |
| `citations` | `retrievedChunks` (Json) |  |
| `retrieval_version` | `retrievedMemory` (Json) |  |
| `prompt_version`, `policy_version`, `retrieval_version`, `decision_trace_ref`, `session_id`, `trace_id`, `tenant_id`, `idempotency_key`, `metadata` | `strategy` (Json) |  |
| `prompt_version` | `promptVersion` |  |
| `model` | `modelName` |  |
| `response_excerpt` | `response` |  |
| `tokens_in`, `tokens_out` | `inputTokens`, `outputTokens` |  |
| `cost_usd` | `costUsd` (Decimal 10,6) |  |
| `latency_ms` | `latencyMs` |  |

The Zod schema is `.strict()` — unknown fields are rejected at the validation layer (AGENTS.md "Forbidden client-writable fields" invariant).

### `POST /internal/decision-traces`

The AI's `DecisionTraceCreate` is mapped to the api's `DecisionTrace` (Prisma). Uses `prisma.decisionTrace.upsert` on `traceId` so a retry with the same `trace_id` is idempotent at the DB level (the unique index on `traceId`).

| AI field | Prisma field | Notes |
|---|---|---|
| `trace_id` | `traceId` | unique key for upsert |
| `acting_user_id` | `userId` |  |
| `session_id` | `sessionId` |  |
| `agent_name` (+ `agent_scope`) | `agentVersion` | composed as `agent_name:agent_scope` if scope present |
| `prompt_version` | `promptVersion` |  |
| `policy_version` | `policyVersion` |  |
| `tool_calls`, `deterministic_outputs`, `reason_codes`, `selected_action`, `prompt_hash`, `response_hash`, `tenant_id`, `idempotency_key`, `metadata` | `strategyJson` (Json) |  |
| (no input) | `modelName` | hardcoded `"unknown-v0"` (ai-api does not send model in DecisionTraceCreate) |
| (no input) | `retrievedMemory`, `retrievedChunks` | `{}` (ai-api does not send chunks in decision trace) |
| (no input) | `responseText` | `""` (decision trace records the decision, not the response text) |

### `POST /internal/agent-sessions` and `GET /internal/agent-sessions/{id}/resolve`

The session store is **in-process Map<string, AgentSessionRecord>** with a 5-minute TTL (default) or `ttl_seconds` (max 900). The store is bounded at 10,000 entries; when over, oldest entries are evicted.

| Field | Source |
|---|---|
| `sessionId` | `randomUUID()` (returned to caller) |
| `actingUserId` | from mint body |
| `tenantId` | `deriveTenant(actingUserId)` — deterministic 16-hex hash of userId, djb2 + hex pad |
| `traceId` | from mint body (optional) |
| `idempotencyKey` | from mint body (optional) |
| `issuedAtMs`, `expiresAtMs` | now, now+ttl |

**Resolve** returns the same fields with `found: true` if the session is live, `{found: false, sessionId}` if expired or missing.

This store is **single-replica safe** (matches the in-process replay cache in `InternalServiceGuard`). For multi-replica deployment, this needs to move to Redis (AGENTS.md P2-6 already tracks this).

## 3. Cross-service header fix (the gap that surfaced)

The ai-api's `send_signed` was setting only `x-idempotency-key` (the internal-contract header). The api's global `IdempotencyKeyGuard` checks `Idempotency-Key` (the global header per AGENTS.md). With only the internal header, every POST to a route with `@RequireIdempotencyKey()` returned 400.

**Fix in `services/ai-api/config/service_auth.py`:**

```python
if method.upper() not in READ_METHODS:
    key = idempotency_key or str(uuid.uuid4())
    headers[IDEMPOTENCY_KEY_HEADER] = key           # x-idempotency-key  (internal contract)
    headers[IDEMPOTENCY_KEY_GLOBAL_HEADER] = key    # Idempotency-Key     (global guard)
```

This also unblocks the previously-added `ai-credits-internal` controller (commit 25f89a8) which had `@RequireIdempotencyKey()` but would have 400'd from ai-api in the same way.

## 4. End-to-End Verification (live, signed)

Test setup: HMAC-SHA256 over `(timestamp, METHOD, target, sha256(body))`, `x-service-id: ai-api`, `x-acting-user-id` set to a real `User.id` from the DB, `x-idempotency-key` + `Idempotency-Key` mirror the same value, `x-trace-id` unique per call.

```text
POST /api/v1/internal/agent-sessions
  → 201  { sessionId: "b7f3569a-...", actingUserId: "teacher-golden", tenantId: "a4193de7", issuedAtMs, expiresAtMs }

GET  /api/v1/internal/agent-sessions/{id}/resolve
  → 200  { found: true, sessionId, actingUserId, tenantId, issuedAtMs, expiresAtMs }

POST /api/v1/internal/episodes
  → 201  { episodeId: "899063f1-...", traceId, storedAt }

POST /api/v1/internal/decision-traces
  → 201  { decisionTraceId: "bd9a8bd8-...", traceId }
```

DB rows actually persisted:

```text
Episode        | 899063f1-5d01-4629-9ac1-ec02c2d84e96 | tutor | 120 | 80 | 0.001200 | 850
DecisionTrace  | trace-0bf6b40d-...                    | tutor:lesson-journal | policy-v1
```

## 5. Files Changed in P1-3 Fix

```text
services/api/src/v1/internal/internal.module.ts                     (extended imports + controller list)
services/api/src/v1/internal/internal-episodes.controller.ts        (NEW)
services/api/src/v1/internal/internal-decision-traces.controller.ts (NEW)
services/api/src/v1/internal/internal-agent-sessions.controller.ts   (NEW)
services/ai-api/config/service_auth.py                              (mirror Idempotency-Key header)
```

No migrations were needed. The existing `Episode` and `DecisionTrace` Prisma models already had all the columns the AI side needs. The `User` FK is satisfied for any real `User.id`.

## 6. Live Stack After P1-3

```text
NAME                     STATUS
reducera_api             Up 4 min  (healthy)
reducera_ai_api          Up 59 s   (healthy)
reducera_celery_worker   Up 58 s   (health: starting)
reducera_nginx           Up 4 min  (health: starting)  (wget healthcheck is in start_period)
reducera_postgres        Up 4 min  (healthy)
reducera_qdrant          Up 4 min  (healthy)
reducera_redis           Up 4 min  (healthy)
reducera_web             Up 4 min  (healthy)
```

11 internal routes registered. AI's `write_episode()`, `write_decision_trace()`, and `AgentSession.resolve_or_raise()` (or its `mint_session` analogue) now have a real destination. The P1-3 critical finding is **closed**.

## 7. Outstanding

- P1-1 (RAG empty), P1-4 (edge rate limit), P1-5 (silent auth downgrade), P2-2 (dev vs prod compose drift), P2-5 (CSP), P2-6 (replay cache) — all still tracked in `critical-findings.md`.
- The in-process `AgentSession` store is single-replica. For multi-replica prod, move to Redis.
- `@RequireIdempotencyKey()` should be removed from internal endpoints if the global guard is ever loosened, or the two should be merged; today both are required and intentional.
