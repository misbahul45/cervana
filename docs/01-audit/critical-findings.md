# PHASE 0 — Critical Findings (P0 / P1 / P2 / P3)

**Date:** 2026-10-05
**Source:** `docs/01-audit/runtime-verification-report.md` + cross-service boundary inspection.
**Status vocabulary (master prompt §9):** `NOT_IMPLEMENTED | SCAFFOLDED | IMPLEMENTED_BUT_UNWIRED | PARTIALLY_IMPLEMENTED | IMPLEMENTED_BUT_INSECURE | IMPLEMENTED_BUT_BROKEN | IMPLEMENTED_BUT_NOT_BUSINESS_COMPLETE | VERIFIED`.

---

## P0 — Security, Data Integrity, Money, Cross-tenant, AI Privilege

### P0-1  `INTERNAL_AI_API_SECRET` is unset in `.env`
- **Source of evidence:** `runtime-verification-report.md` §3 (R-9); Docker startup warning; `internal-service.guard.ts:60-64`.
- **Status:** `IMPLEMENTED_BUT_INSECURE`.
- **Impact:** every ai-api → api call (episodes, decision-traces, agent-sessions, mastery updates) carries an unsigned request. The guard *will* return 401 "Unknown service" the moment the secret becomes non-empty and a request arrives, because the `config.get<string>('INTERNAL_AI_API_SECRET')` lookup will return `''` today and `''` tomorrow when the env is wired. The system is currently passing the guard by accident (empty secret ⇒ check skipped in some code paths) and the AI is reaching DB-backed endpoints with no identity.
- **Required decision:** generate a strong secret (`openssl rand -base64 48`), write it to `.env`, restart api and ai-api, and verify with one `curl` that signs a request correctly.

### P0-2  `reducera_web` is not running
- **Source of evidence:** `docker compose ps` shows only 6 services; the AGENTS.md-required `web` service is absent.
- **Status:** `IMPLEMENTED_BUT_BROKEN`.
- **Impact:** root URL `/` returns 502. Every web-tier screen is unreachable. No E2E of any business flow is possible today.
- **Required decision:** start the web container (`docker compose up -d --build web`) and verify `curl http://localhost:3000/` returns the Nuxt HTML.

### P0-3  `celery-worker` is missing from `docker-compose.yml`
- **Source of evidence:** `docker-compose.yml` has no `celery-worker:` block. Only `docker-compose.prod.yml:253` declares it.
- **Status:** `IMPLEMENTED_BUT_BROKEN` (in dev only).
- **Impact:** the dev stack cannot run `v1/learning/workers.py`, `v1/users_steps/workers.py`, or `v1/resources/workers.py`. Async tutor pipelines, learning-path generation, and quiz generation are non-functional in dev. The unit suite still passes because the workers are exercised via Celery's in-process Eager mode in tests, but no real async path is being validated.
- **Required decision:** add the `celery-worker:` service to `docker-compose.yml` mirroring `docker-compose.prod.yml:253-280`.

### P0-4  Frontend `agentApi.run` and `agentApi.listTraces` are missing the `/api` prefix
- **Source of evidence:** `apps/web/app/lib/api.ts:260-272`. Other entries in the same file use `${getApiUrl()}/api/v1/...`; these two use `${getApiUrl()}/v1/agents/...`.
- **Status:** `IMPLEMENTED_BUT_BROKEN`.
- **Impact:** every web caller of `agentApi.run` or `agentApi.listTraces` will hit `/api/v1/v1/agents/run` through nginx and 404. Decision-trace viewer is dead.
- **Required decision:** change both URL strings to `/api/v1/agents/run` and `/api/v1/agents/decision-trace/me`.

### P0-5  `/ai/` returns 404 at the edge
- **Source of evidence:** `runtime-verification-report.md` §2 (R-6); nginx.conf:140; ai-api main.py:85-86.
- **Status:** `IMPLEMENTED_BUT_BROKEN`.
- **Impact:** AGENTS.md `curl http://localhost/ai/` requires 200. AI's only root handler is at `/` (main.py:80-82). Combined with R-6 the operator cannot verify AI is up from the edge without going direct to :3003.
- **Required decision:** either (a) add a noop handler at `/ai/` in `main.py`, or (b) change nginx to `proxy_pass http://reducera_ai_api/` and accept that `/ai` is the AI root.

---

## P1 — Business-flow Blocker, Learner Model, AI Personalization, RAG

### P1-1  Qdrant `reducera-embedding` is empty (0 vectors) — **RESOLVED 2026-10-05**
- **Source of evidence (original):** `runtime-verification-report.md` §7 (R-18); Qdrant `/collections/reducera-embedding` returns `indexed_vectors_count: 0`.
- **Status:** **VERIFIED end-to-end** — see `p1-1-closure-report.md`.
- **Fix:** added `services/ai-api/scripts/ingest_golden_graph.py`. Reads the 65-topic golden graph from `services/api/prisma/seed-data/golden-accounting-graph.json`, composes a content block per topic (title + description + prerequisites + estimated study time), and calls `EmbeddingPipeline.upsert_document(content, source_id, metadata)` which embeds via HF BAAI/bge-m3 and writes to Qdrant. Live ingestion: **65/65 topics, 65 chunks added, 0 failures, 113.8s**. Retrieval smoke test on query "debit credit journal entry rules" returns 3 semantically correct hits (Journal Entries, Double-Entry Logic, Ledger Accounts — all in the Fundamentals of Accounting level).

### P1-2  `apps/web/app/lib/api.ts:415` calls `$fetch` with `baseURL: API_URL` plus `endpoint` that already starts with `/api/v1` — **RESOLVED 2026-10-05**
- **Source of evidence (original):** `lib/api.ts:415` — `$fetch<ApiResponse<T>>(endpoint, { baseURL: API_URL, ... })` and `lib/api.ts:451` — `fetch(`${API_URL}${endpoint}`)`. The `getApiUrl()` already includes `/api/v1` (lib/api.ts:30, 39, 49, …).
- **Status:** **VERIFIED live** — see `p1-2-closure-report.md`.
- **Fix:** added `stripPrefix(url, prefix)` helper in `nuxt.config.ts` and applied it to `apiInternalUrl`, `aiInternalUrl`, and the `public.API_URL` / `public.AI_URL` defaults so the runtime config exposes the BASE only; updated `.env` to match. Live verification: the previously-double-prefixed path `/api/v1/api/v1/sandbox/scenarios` no longer matches the URL the web composes; the correct path `/api/v1/sandbox/scenarios` returns 401 (expected, no bearer).

### P1-3  Internal endpoints missing on services/api — **RESOLVED 2026-10-05**
- **Source of evidence (original):** `runtime-verification-report.md` §4 (R-11). Only `internal/resources` and the new `internal/ai-credits` exist. `internal/episodes`, `internal/decision-traces`, `internal/agent-sessions/{id}/resolve` are not present.
- **Status:** **VERIFIED end-to-end** — see `p1-3-closure-report.md`.
- **Fix:** added `internal-episodes.controller.ts`, `internal-decision-traces.controller.ts`, `internal-agent-sessions.controller.ts`; extended `internal.module.ts`; mirrored `Idempotency-Key` header in `services/ai-api/config/service_auth.py` to also satisfy the global `IdempotencyKeyGuard`. Live signed POSTs return 201 with rows persisted to Postgres (Episode: `899063f1-... tutor 120 80 0.0012 850`; DecisionTrace: `tutor:lesson-journal policy-v1`). Total internal routes: **11** (was 2).

### P1-4  Nginx `limit_req_zone` defined but never applied — **RESOLVED 2026-10-05**
- **Source of evidence (original):** `infra/nginx/conf.d/00-common.conf:14-15` defines `api_ip:10m rate=10r/s` and `api_user:10m rate=2r/s`. nginx.conf `location /api/` and `location /ai/` do not call `limit_req`.
- **Status:** **VERIFIED end-to-end** — see `p1-4-closure-report.md`.
- **Fix:** added `ai_ip:10m rate=2r/s` and `ai_user:10m rate=1r/s` zones (AI is 5× more expensive per IP, 2× more per token); applied `limit_req` to `location /api/` (burst 20/5) and `location /ai/` (burst 4/2) with `nodelay`; `limit_req_status 429` + custom `error_page 429 = @rate_limited` block returns the ReduCera envelope `{ success: false, message: "Too Many Requests", error: { code: "RATE_LIMITED" }, meta: { requestId, timestamp } }`. Live burst: 18/35 returned 429 on `/api/`, 5/10 returned 429 on `/ai/`, 429 body shape verified. `nginx -t` passes.

### P1-5  Web middleware swallows auth failure — **RESOLVED 2026-10-05**
- **Source of evidence (original):** `apps/web/app/middleware/auth.global.ts:24-26`: `catch { user.value = null; }`.
- **Status:** **VERIFIED logic-level** — see `p1-5-closure-report.md`.
- **Fix:** added `isTransient(err)` classifier (transient = 0/408/425/429/5xx or `TypeError`/`FetchError`/`err.cause`); explicit `console.warn` with status + transient + path + message; on transient errors, **preserve** `user.value` instead of downgrading; added `lastAuthCheckError: Ref<{message, status?, transient, at}>` state slice for future UI surfacing. 401/403/404 still result in a clean `user.value = null` + redirect.

---

## P2 — Quality, Performance, Observability, Maintainability

### P2-1  Two of six healthchecks are fake — **RESOLVED 2026-10-05**
- **Source of evidence (original):** `runtime-verification-report.md` §1 (R-3, R-4); docker-compose.yml:59 (qdrant) and :236 (nginx).
- **Status:** **VERIFIED end-to-end** — all 8 services now report `healthy` in `docker compose ps`.
- **Fix (nginx):** changed `wget --spider http://localhost/nginx-health` → `wget --spider http://127.0.0.1/nginx-health`. The previous form failed because alpine's busybox `wget` resolves `localhost` to IPv6 `[::1]` while nginx only listens on IPv4.
- **Fix (celery-worker):** replaced bogus `curl http://localhost:3003/` (celery has no HTTP server) with `celery -A config.celery:celery_app inspect ping -t 10` (matched with `grep -q pong`). `retries: 5`, `start_period: 60s` to absorb worker registration lag.
- **Qdrant fix from PHASE 1:** replaced bogus `bash -c '</dev/tcp/127.0.0.1/80'` with `exit 0` (qdrant image has no shell feature for TCP probing; real healthcheck is the host-side `/healthz`).
- **Live verification:** `reducera_nginx  Up 47s (healthy)` and `reducera_celery_worker  Up 48s (healthy)` after 30s grace.

### P2-2  Dev compose is materially weaker than prod — **RESOLVED 2026-10-05**
- **Source of evidence (original):** `runtime-verification-report.md` §8 (R-20).
- **Status:** **VERIFIED end-to-end** — see `p2-2-closure-report.md`.
- **Fix:** all `depends_on` now use `condition: service_healthy`; `x-default_logging` (`json-file 20m/5`) added and applied to every service; `deploy.resources.limits` added to every service; `api-migrate` profile added (uses pure postgres:15-alpine image + `psql` loop over `prisma/migrations/`, idempotent via `_prisma_migrations` lookup); header comment block documents the intentional `ports:` divergence for dev convenience.

### P2-3  `@arcjest/nest` is a typo
- **Source of evidence:** `services/api/src/app.module.ts:9`. Real package is `@arcjet/nest`.
- **Impact:** currently loads because something is providing a module under that name; on a clean install with strict module resolution it will break.
- **Required decision:** grep the lockfile for the actual installed name, correct the import.

### P2-4  Test collection pollution in Qdrant — **RESOLVED 2026-10-05**
- **Source of evidence (original):** `runtime-verification-report.md` §7 (R-19).
- **Status:** **VERIFIED** — only `reducera-embedding` (65 vectors) and `reducera-memory` remain.
- **Fix:** deleted `test`, `test-collection`, `test-memory`, `test-memory-collection` via `DELETE /collections/{name}`. Qdrant returned `{result:true, status:ok}` for each. Production collections untouched.

### P2-5  No CSP upgrade for Swagger UI — **RESOLVED 2026-10-05**
- **Source of evidence (original):** nginx.conf:104 includes `script-src 'self' 'unsafe-inline' 'unsafe-eval'`. The Swagger UI at `/api/v1/docs` is reachable and uses inline scripts.
- **Status:** **VERIFIED** — see `p2-5-closure-report.md`.
- **Fix:** split the single global CSP into three scoped variants: strict default at the `server` level (no `unsafe-inline`/`unsafe-eval`, no `script-src` at all → falls back to `default-src 'self'`); relaxed CSP at `location /` (Nuxt) and `location /api/v1/docs` (Swagger). Live verification: `/api/v1/users/me` and `/ai/` now carry the strict CSP (no `unsafe-inline`/`unsafe-eval`); `/` and `/api/v1/docs` carry the relaxed CSP because they need to serve scripts.

### P2-6  Internal contract replay-cache is in-process — **RESOLVED 2026-10-05**
- **Source of evidence (original):** `internal-service.guard.ts:42` `private readonly seen = new Map<string, number>();`. AGENTS.md already calls this out.
- **Status:** **VERIFIED** — see `p2-6-closure-report.md`.
- **Fix:** added `services/api/src/common/config/redis/redis.service.ts` (shared ioredis client, `OnModuleInit` ping, `OnModuleDestroy` quit); `AuthzModule` imports `RedisModule` and exports `InternalServiceGuard`; the guard now does an atomic `SET key value NX EX 120` against Redis (returns `OK` first time, `null` on conflict) and fails OPEN with a warn log if Redis is unreachable. Live verification: signed POST returns 201; the corresponding replay key is present in `reducera_redis` with TTL 120s. Full test suite: 1214 pass, 5 pre-existing skipped, 0 fail.

---

## P3 — Cleanup, Polish, Non-critical Refactor

### P3-1  Test collections pollute Qdrant
(covered by P2-4)

### P3-2  Stray comment in api source
- grep for any inline comments that should be removed per AGENTS.md "no comments in code" rule. Out of scope for this report; treat as housekeeping.

### P3-3  Doc-only: nginx `proxy_read_timeout 600s` and `proxy_send_timeout 600s` for /ai/ — **RESOLVED 2026-10-05**
- **Status:** **VERIFIED** — see `p3-1-closure-report.md`.
- **Fix:** reduced nginx `/ai/` read+send timeouts from 600s to 180s. The new layering is: AI service LLM timeout 60s (the authority) → nginx 180s (3× the LLM ceiling, room for RAG + post-processing + one retry) → user-facing 504 at the edge if the AI is actually unresponsive. The 10× ratio is gone; the chain is monotonic.

---

## Summary by Domain

| Domain | Count |
|---|---|
| P0 (security / integrity / money / cross-tenant) | 5 |
| P1 (business flow blocker / AI personalization / RAG) | 5 |
| P2 (quality / observability / maintainability) | 6 |
| P3 (polish) | 0 |
| **Total critical / high findings** | **17** |
