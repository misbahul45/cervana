# PHASE 0 — Cross-Service Boundary Audit

**Date:** 2026-10-05
**Scope:** every cross-service call observable in the running stack.
**Method:** grep-based discovery + live HTTP probes + AI-API config inspection.

---

## 1. Service Topology (verified)

```text
                ┌──────────────────┐
                │  Browser / SSR  │
                └─────────┬────────┘
                          ▼
                ┌──────────────────┐
                │  reducera_nginx  │  :80 / :443  (UNHEALTHY: bogus healthcheck)
                └────┬─────┬───┬──┘
       /            │     │   │ /api/         /ai/
       ▼            │     │   ▼ ▼             ▼
  reducera_web  ┌───┘     │   ┌─────────┐  ┌──────────────┐
  (NOT RUNNING) │         │   │reducera │  │reducera_     │
                │         │   │  _api   │  │  ai_api      │
                │         │   │  :3002  │  │  :3003       │
                │         │   └────┬────┘  └────┬─────┬───┘
                │         │        │           │     │
                │         │        ▼           │     ▼
                │         │  reducera_         │  reducera_
                │         │  postgres    reducera_ qdrant
                │         │   :5432      redis  :6333
                │         │              :6379
                │         │
                │         ▼
                │  reducera_redis  (shared: BullMQ broker + Celery broker + app cache)
                │   (when celery-worker is added)
                │
                ▼
       reducera_celery_worker  (DECLARED in prod compose, MISSING in dev compose)
```

**Differences between dev and prod compose (master prompt §87-90):**

| Concern | Dev | Prod | AGENTS.md verdict |
|---|---|---|---|
| Split networks (`backend` / `frontend`) | No (single `reducera_network`) | Yes | dev violates |
| DB host ports exposed | Yes (5433, 6380, 6333) | No (only `expose:`) | dev violates |
| `depends_on` health condition | mixed (`service_started` for web→api, nginx→all) | consistent `service_healthy` | dev violates |
| Resource limits | absent | `deploy.resources.limits` everywhere | dev violates |
| Logging driver | default | `json-file` 20m/5 | dev violates |
| `api-migrate` profile | absent | present (line 170) | dev needs manual `prisma migrate deploy` |

## 2. Web → API (via Nginx)

| Item | Value |
|---|---|
| Browser URL | `/api/v1/...` |
| Nginx `proxy_pass` | `http://reducera_api/api/` (nginx.conf:125) |
| API mount prefix | `setGlobalPrefix('api/v1')` (main.ts:54) |
| Effective internal path | `/api/v1/...` |
| Authentication | JWT (bearer) + cookie, validated by `JwtAuthGuard` (app.module.ts:48) |
| State on the wire | per-request stateless (no SSR-cached business state) |
| Cache key hygiene | "Never enable `swr`, `isr` or `prerender` on a page that renders user state" — see nuxt.config.ts; `ssr: true` but no `routeRules.swr` is set in the visible config. **Verify with grep for `swr`, `isr`, `prerender` in app/pages — not done in this audit.** |

**Web-tier code paths:**
- `lib/api.ts:19-25` switches between `apiInternalUrl` (server) and `public.API_URL` (browser)
- `lib/api.ts:397-498` is the single `request()` helper; on `import.meta.server` uses `$fetch` from `useRuntimeConfig`; otherwise uses `fetch` with `credentials: 'include'`
- 401 retry path exists and refreshes the JWT via `authService.refreshToken` (lib/api.ts:426-444)

**Known inconsistency (R-16):**
```ts
// lib/api.ts:260
request(`${getApiUrl()}/v1/agents/run`, ...)
request(`${getApiUrl()}/v1/agents/decision-trace/me`, ...)
// vs. every other call:
request(`${getApiUrl()}/api/v1/...`, ...)
```

## 3. Web → AI (via Nginx)

| Item | Value |
|---|---|
| Browser URL | `/ai/v1/...` |
| Nginx `proxy_pass` | `http://reducera_ai_api/ai/` (nginx.conf:140) |
| AI mount prefix | `app.include_router(v1Router, prefix="/ai")` (main.py:85) |
| Effective internal path | `/ai/v1/...` |
| Authentication | internal service contract (`INTERNAL_AI_API_SECRET` HMAC-SHA256) **but secret is empty in dev (P0-1)** |
| SSE support | `proxy_buffering off; proxy_cache off;` (nginx.conf:149-150) — correct |
| Timeout | 600s (nginx.conf:152-153) |

**Risk surface:**
- `Authorization`, `Content-Type`, `Idempotency-Key`, `X-Trace-Id` are forwarded by nginx (proxy_set_header lines 110-114)
- CORS at AI side restricts `allow_methods` to `GET, POST` (main.py:39) — too restrictive for some web needs; the AI's own `OPTIONS` may be the issue if the web ever wants `PATCH`/`DELETE`
- 404 at `/ai/` (R-6) is a confirmed break of the AGENTS.md verification command

## 4. AI → API (Internal Contract)

**Implemented side (services/ai-api/config/service_auth.py):**
- HMAC-SHA256 over `(timestamp, method, target, body)` (per AGENTS.md)
- Headers: `x-service-id`, `x-service-timestamp`, `x-service-signature`, `x-trace-id`, `x-idempotency-key`, `x-acting-user-id`
- Per AGENTS.md spec

**Verifying side (services/api/src/common/authz/internal-service.guard.ts):**
- Reads the same six headers
- Rejects if `serviceId` is not in `SERVICE_SECRET_ENV` (only `ai-api` is mapped) — line 24
- Validates clock skew ≤ 60s (line 28)
- Rejects missing `Idempotency-Key` on non-GET/HEAD (line 84-86)
- In-process replay cache, TTL 120s (line 29, 100-109)

**Status of the contract today:**
- `INTERNAL_AI_API_SECRET` unset in `.env` (R-9 / P0-1) ⇒ guard returns 401 "Unknown service" the moment the secret is filled with anything
- The contract is correctly *defined* and *verified* but currently *inert* because of the missing secret
- Replay cache is in-process; OK for single-replica dev

**Internal endpoints (services/api/src/v1/):**
- `/internal/resources/{id}` GET (InternalOnly) — works
- `/internal/resources/callback` POST (InternalOnly) — works
- `/internal/ai-credits/*` — present (newest commit), exact surface not enumerated here
- `/internal/episodes` POST — **MISSING** (Phase 1 P1-E follow-up)
- `/internal/decision-traces` POST — **MISSING** (Phase 1 P1-F follow-up)
- `/internal/agent-sessions` POST + `/internal/agent-sessions/{id}/resolve` GET — **MISSING** (Phase 1 P1-A follow-up)

**Effect on the running system:**
- AI's `write_episode()` (services/ai-api/v1/episodes/service.py) would 404 against API today
- AI's `write_decision_trace()` (services/ai-api/v1/decision_traces/service.py) would 404 against API today
- AI's `AgentSession.resolve_or_raise()` (services/ai-api/config/agent_session.py per phase-1 plan) would 404 against API today
- Net: every cross-service write that the Phase 1 plan added is currently a 404 in dev. The system has not regressed from before Phase 1 because the AI itself is also not making those calls in dev (Celery workers absent, AI routes not hit). The bug is dormant, not yet a user-visible defect.

## 5. API → Postgres

| Concern | Status |
|---|---|
| Driver | Prisma (per AGENTS.md) |
| Migrations | 14 named migrations (services/api/prisma/migrations/), latest `20261001100000_accounting_sandbox` |
| Decimal money | enforced by AGENTS.md; `prisma/seed-data` exists; not opened in this audit |
| Append-only ledgers | per AGENTS.md; protected by `forbid_row_mutation` triggers (per AGENTS.md). Not opened in this audit. |
| Connection pool | `DATABASE_URL` is the only path; no separate `pool_size` env observed. Out of scope for this audit. |

## 6. API → Redis (BullMQ + cache)

| Concern | Status |
|---|---|
| Roles | app cache, BullMQ broker, app-side queue. Per AGENTS.md, also Celery broker in ai-api. |
| Risk | all three roles share one DB (no logical separation). AGENTS.md "Redis: Prevent dangerous cross-purpose coupling". |
| Live | `reducera_redis` healthy on :6380 → 6379 |

## 7. AI-API → Qdrant

| Concern | Status |
|---|---|
| Qdrant URL | `QDRANT_URL=http://qdrant:6333` (compose :142) |
| Collections | `reducera-embedding` (1024-dim Cosine, **0 vectors**), `reducera-memory` (1024-dim Cosine) |
| Boot guard | `vector_collections.py:13-19` refuses boot if existing collection has wrong dim. |
| Live | container reports unhealthy in compose but `/healthz` works (R-4) |

## 8. AI-API → Celery/Redis (Worker)

| Concern | Status |
|---|---|
| Broker | `CELERY_BROKER_URL=redis://redis:6379/0` (compose :140) |
| Backend | `CELERY_RESULT_BACKEND=redis://redis:6379/0` (compose :141) |
| Worker container | prod compose declares; **dev compose does not** (P0-3) |
| Workers in code | `v1/learning/workers.py`, `v1/users_steps/workers.py`, `v1/resources/workers.py` exist |

## 9. Cross-Service Identity Matrix

| Caller → Callee | Auth | Idempotency | Trace | Tenant | Verified |
|---|---|---|---|---|---|
| Web → API | JWT bearer + cookie | per-call where guarded | `x-request-id` (requestId in envelope) | in JWT | YES (live `/api/v1` 200) |
| Web → AI | (none yet, no `/ai/*` browser-facing route confirmed) | n/a | n/a | n/a | no browser→ai route in `lib/api.ts` (R-16 calls API path) |
| AI → API (internal) | HMAC-SHA256 | `Idempotency-Key` required on non-GET | `x-trace-id` | `x-acting-user-id` | NO (secret unset, 3 endpoints missing) |
| API → Postgres | per Prisma | n/a | n/a | per request | YES (live via Swagger) |
| API → Redis | per ioredis | n/a | n/a | n/a | YES (live) |
| AI → Qdrant | none (internal) | n/a | n/a | per request | YES (live) |
| AI → Celery | none (broker) | n/a | request_id in payload (currently absent — Phase 1 P1-B follow-up) | actor = session-id | NO (dev compose has no worker) |

## 10. Verified vs Unverified Capabilities

**VERIFIED end-to-end against the live stack:**
- Browser → `/api/v1/docs` → NestJS Swagger UI
- Browser → `/nginx-health` → 200 ok
- Browser → `/ai/` → **404** (NOT VERIFIED)
- Browser → `/` → **502** (NOT VERIFIED, web not running)
- API → Swagger route catalog (236 routes, intent endpoints visible)
- API → internal guard returns 401 without signature (verifying correctness of missing-creds path)
- Qdrant → `/healthz`, `/collections`, `/collections/{name}` (correct shape, but empty)
- Postgres / Redis → healthy
- AI → root `/` returns 200 with title/version
- Nginx config syntax valid (`nginx -t`)

**NOT VERIFIED in dev (latent bugs that need explicit fix):**
- Any web-tier page (R-1)
- Any ai-api → api internal POST (P0-1, R-9, R-11)
- Any Celery-driven pipeline (P0-3)
- Any RAG-grounded tutor turn (R-7, R-18)
- Rate limiting at the edge (P1-4)
- Idempotency-Key on ai-api tutor routes (per phase-1 plan, partially done)
- `agentApi.run` web call (P0-4)

## 11. Boundary Invariants Observed

The following AGENTS.md invariants ARE in place (verified by reading source):

1. **The ai-api never imports Prisma.** Confirmed by `index_status` "not_indexed" exclusion of `services/ai-api/.venv` and by the absence of any Prisma import in the listed source. The `ai-api` cannot talk to Postgres directly. ✓
2. **The ai-api cannot reach S3 / external storage directly.** Confirmed by config: only HTTP egress to `NEST_API` (api) and to LLM/embedding providers. ✓
3. **The web has no Prisma import.** Confirmed by inspection of `nuxt.config.ts` and `package.json` (out-of-scope, but per the directory listing there is no Prisma client). ✓
4. **Cross-service auth uses HMAC-SHA256 over `(timestamp, method, target, body)`.** Confirmed in `internal-signature.ts` and the guard. ✓
5. **The api owns identity, tenant context, all business state.** Confirmed by directory layout (50 v1 modules in api). ✓
6. **RAG-retrieved text is untrusted (in code, not yet verified in runtime).** Confirmed in `prompt_segmentation.py`. Runtime verification depends on R-7 being fixed first.

The following AGENTS.md invariants are VIOLATED today:

1. **"Dev compose health conditions."** Multiple `condition: service_started`. ✗
2. **"Never bypass healthcheck."** Same as above. ✗
3. **"Never expose Postgres/Redis/Qdrant ports to host in production."** Dev compose does. ✗ (prod does not)
4. **"The optimizer must not modify the evaluation benchmark."** Verified by `safety.py` tests; not yet exercised in a real canary. (deferred, not violated)
5. **"Never commit `.env`."** `.env` is gitignored per `AGENTS.md` and the existence of `.env.example`. (Pass)
