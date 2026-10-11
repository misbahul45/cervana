# Security Audit — Boundaries, Identity, Secrets, Injection

> **Status**: `stable` · **Owner**: `security` · **Last reviewed**: `2026-10-09`
>
> Service-ownership boundaries at source and at runtime, service and user identity between api and ai-api, and containment of untrusted content.

---

## Scope

The ai-api ↔ api boundary in both directions, the web ↔ api/ai-api boundary, container environment, rate limiting, idempotency, trace propagation, and injection and poisoning defenses (prompt, RAG, memory, SSRF). Payments and tenant isolation inside the api were not re-audited. No exploit was attempted and no secret value appears in this document; where a secret is mentioned, only its presence is stated.

## Findings

### Ownership boundary (static source versus runtime)

| Rule (`AGENTS.md`) | Source | Runtime |
|---|---|---|
| `api` has no LLM, embedding or Qdrant code or credentials | clean: no provider imports in `services/api/src`; no `qdrant_client` | **violated**: `api` container holds `OPENAI_API_KEY` and `HF_TOKEN` (C-004) |
| `ai-api` has no `DATABASE_URL`, Prisma or SQLAlchemy | clean: no match outside `.venv` | **violated**: `ai-api` and `celery-worker` containers hold `DATABASE_URL` and JWT/cookie secrets (C-004) |
| `ai-api` does not write business truth | clean: its writes go through api HTTP | holds, but see C-001 for the writes that cannot succeed |
| `scripts/check-ownership-rules.sh` | exits 1 on a third-party `.venv` file (M-008); blind to runtime | n/a |

### C-001

**ai-api calls api without a valid credential.** The api accepts either a user JWT (global guard, `services/api/src/v1/auth/guards/jwt.guard.ts:19-52`) or, on `@InternalOnly` routes, a full service signature (`services/api/src/common/authz/internal-service.guard.ts:56-94`: `x-service-id`, `x-service-timestamp`, `x-service-signature`, plus an idempotency key for mutations). The ai-api helpers that carry the learner's work send neither a bearer token nor a signature:

| Caller | Headers sent | Target route access | Expected result |
|---|---|---|---|
| `learning/service.py:122-142` `update_message_chat` | `x-acting-user-id`, `x-trace-id`, `x-idempotency-key` | `chat-messages/:id`: JWT + `RequireOwnership('message')` | 401 |
| `learning/service.py:145-165` `create_message_chat` | same | JWT + `RequireParentOwnership('chat')` | 401 |
| `learning/service.py:168-188` `query_content_history` | same | JWT (`chat/contents/similarity`) | 401 |
| `learning/service.py:191-209` `get_lesson` | same | `AuthenticatedOnly` | 401 |
| `learning/service.py:212-230` `get_user_step` | same | `RequireOwnership('user-step')` | 401 |
| `learning/service.py:233-253` `create_content_material` | same | JWT (`chat/contents`) | 401 |
| `users_steps/service.py:23-27,35,53` | same | JWT | 401 (observed: `[SSE] upstream fetch failed: 401 Client Error: Unauthorized for url: http://api:3002…`, 2026-10-08 20:00–20:10 UTC) |
| `episodes/service.py:35-41` | adds `x-service-id`; no timestamp, no signature, no capital `Idempotency-Key` | `InternalOnly` | 401 `Service credentials required` |
| `decision_traces/service.py:40-46` | same | `InternalOnly` | 401 |
| `resources/service.py:22,43` via `send_signed` | full signed set (`config/service_auth.py:39-92`) | `InternalOnly` | works |

The correct helper (`send_signed`) exists and is used only by the resource flow. The pre-written `_signed_get/_post/_patch` in `learning/service.py:20-119` are unused. The same unauthenticated pattern was present at `HEAD 25f89a8` (`git show` of `learning/service.py` shows the raw `x-acting-user-id` calls), so it predates the hardening work. If the api ever accepted `x-acting-user-id` without a signature, any caller on the network could act as any user; it does not (the guards above), which is why the calls fail instead. Failures in the episode and decision-trace writers are caught and logged (`learning/workers.py:140-141,171-172`), so the loss is silent to the learner and to the task result.

Status `BROKEN`. Tests: the learning tests replace the service functions with mocks, so none sends a request through the real guards; `UNVERIFIED` by tests.

### C-004

**Every container receives every secret.** All nine services declare `env_file: .env` (`docker-compose.yml:14,44,70,…`), and compose then adds explicit `environment` entries. Presence check on the running containers (Y = variable set; values not read):

| Container | `OPENAI_API_KEY` | `HF_TOKEN` | `DATABASE_URL` | `JWT_ACCESS_SECRET` | `JWT_REFRESH_SECRET` | `COOKIE_SECRET` | `INTERNAL_AI_API_SECRET` |
|---|---|---|---|---|---|---|---|
| `api` | **Y** | **Y** | Y | Y | | | Y (verifier) |
| `ai-api` | Y | Y | **Y** | **Y** | **Y** | **Y** | Y (signer) |
| `celery-worker` | Y | Y | **Y** | **Y** | | **Y** | Y |
| `web` | **Y** | **Y** | **Y** | **Y** | | | **Y** |

Bold cells are outside the service's declared ownership; blank cells were not checked. Empty variables (Stripe, Cloudinary, Supabase, Google, Resend, Arcjet, Tavily) are unset in this environment and would flow the same way if filled. Impact: a compromise or log leak in the `web` SSR container or in `ai-api` exposes the database URL, the JWT signing secrets (token forgery) and the service-signing secret. `AGENTS.md` ("Migration of existing violations") records "Open violations: none" and requires a single root `.env`; the two requirements are compatible only with per-service `environment` allow-lists instead of `env_file`. Status `BROKEN`. Not changed in this audit.

### H-002

**Bearer tokens at rest and in transit between api and ai-api.** `UserStepsProcessor` receives `{ userId, token, … }` as BullMQ job data (stored in Redis), forwards `Authorization: Bearer ${token}` and also places `token` in the JSON body (`services/api/src/v1/queue/queues/user-steps.processor.ts:33-53`); `KnowledgeProcessor` does the same through its header (`knowledge.processor.ts:30-46`). The ai-api side stopped putting tokens into Celery payloads (`config/agent_session.py:55-58` `session_payload_is_safe`; `learning/workers.py:25-28`), so the hardening covers half of the path. Access tokens that wait in a queue may also expire before use. `POST /ai/v1/agents/run` forwards the caller's bearer to the api (`v1/agents/router_endpoint.py:48,73-87`). The target (ADR-007, signed service identity) is not implemented; `AGENTS.md` still prescribes forwarding the user's token.

### H-011

**Rate limiting and idempotency in ai-api.**

| Control | Behavior | Evidence |
|---|---|---|
| Rate limit | token bucket per decorated function, held in process memory; key `"{request.client.host}:{function}"`; behind the nginx container `client.host` is the proxy address unless uvicorn trusts forwarded headers (uvicorn flags not inspected) | `services/ai-api/config/rate_limit.py:82-110` |
| Redis-backed limiter | a Redis client is constructed in `get_default_limiter` (`:61-79`) but `RateLimiter.check` uses only `_local` (`:44-57`), and the decorator builds its own limiter without a client (`:88`) | same |
| Idempotency | `require_idempotency_key` checks that a key of at least 8 characters is present and stores it on the request (`middleware/idempotency.py:16-47`); no result cache, no lock | a repeated `POST /learning/chat` with the same key enqueues a second task |
| Edge | nginx returns a 429 envelope (`infra/nginx/nginx.conf:155`); zone settings not re-verified here | |

### H-012

**Tenant id is a hash of the user id.** `mint_session` sets `tenant_id = sha256(acting_user_id)[:16]` (`config/agent_session.py:22-23,37`). Episodes, decision traces and Celery payloads carry that value. The real tenant membership model lives in the api (`x-tenant-id` selects among the caller's memberships, `CLAUDE.md`), so tenant isolation in the AI layer is nominal; no retrieval or memory query filters by tenant in any case (rag-audit, memory-audit).

### M-010

**Trace id does not span the system.** `TraceIdMiddleware` accepts or mints `x-trace-id` and echoes it (`middleware/trace_id.py:19-30`); the ai-api → api helpers send it. nginx sets no request or trace id header (only a `$request_id` in a 429 body, `nginx.conf:155`); the api builds `requestId` from `x-request-id` or a new UUID (`common/exceptions/app.exceptions.ts:23`, `common/interceptors/response.interceptor.ts:26`); the BullMQ processors send no `x-trace-id`. A trace therefore starts at ai-api. Web → api linkage is `UNVERIFIED`.

### M-012

**`_signed_patch` cannot work.** It reads `x-service-timestamp` and `x-service-signature` from a prepared request that was never signed, so both headers are empty strings, and it sends the JSON dict as `data=` (form encoding) (`learning/service.py:80-119`). It has no caller.

### Injection and poisoning

| Threat | Control | Status |
|---|---|---|
| Prompt injection through user, retrieved, web or memory text | trust-labelled fences, `neutralize_fences`, `looks_like_instruction` (`config/prompt_segmentation.py:19-110,191`); instruction-like web results and memory writes are dropped | `IMPLEMENTED` at render time; no filter at embedding or retrieval time |
| RAG poisoning | URL allow-list for PDFs, fail-closed (`config/url_allowlist.py`) | `PARTIAL`: cannot be configured (M-014); chunk metadata has no status or access scope |
| Memory poisoning | instruction check on write; no source, confidence or expiry; model output stored (M-007); client-writable long-term memory (M-013) | `PARTIAL` |
| SSRF | PDF fetch gated by the allow-list (`resources/service.py:112-118`); YouTube transcript fetch (`yt_dlp`) not traced | `PARTIAL` / `UNVERIFIED` |
| Unsafe tool invocation | the model has no executable tools in any reachable path | not applicable today; required before agents ship |
| Raw external content in prompts | web results and retrieved text go through `segment_*`; `learner_state`/`course_context` strings are interpolated trusted text | `PARTIAL` |
| LLM output validation | container schema only (`content_pipeline.py:387-400`); JSON validators unused (M-006) | `PARTIAL` |
| LLM failure as typed error | chat: yes; material analysis: silent substitution (M-005); `generate_user_steps` returns HTTP 200 with `{"error": …}` (`users_steps/router.py:155-165`) | `PARTIAL` |
| User identity binding | `authenticated_user` introspects the token against `GET /auth/profile` on every call (`config/user_auth.py:12-39`) and `bind_acting_user` rejects mismatches (`:58-61`) | `IMPLEMENTED` |

## Evidence citations

- `services/ai-api/v1/learning/service.py:20-253`; `services/ai-api/v1/{episodes,decision_traces}/service.py`; `services/ai-api/v1/users_steps/service.py`; `services/ai-api/config/{service_auth,user_auth,agent_session,rate_limit,url_allowlist,prompt_segmentation}.py`
- `services/api/src/common/authz/internal-service.guard.ts`; `services/api/src/v1/auth/guards/jwt.guard.ts`; `services/api/src/v1/queue/queues/*.processor.ts`
- `docker-compose.yml` (`env_file`), container checks 2026-10-09 (presence only), `docker compose logs --since 6h ai-api`
- `git show 25f89a8:services/ai-api/v1/learning/service.py` (unsigned pattern predates the working-tree changes)

## Verdict

The service-identity design is sound and implemented on the api side, and the ai-api has a correct signing helper, but only the resource flow uses it; every other ai-api → api call is rejected. Separately, the runtime environment gives every container every secret, which defeats the ownership boundaries that the source code respects. Between api and ai-api, user tokens still travel through Redis job data. Prompt-level injection defenses are in place; retrieval- and memory-level governance is not.
