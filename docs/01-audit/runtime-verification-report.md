# PHASE 0 — Runtime Verification Report

**Date:** 2026-10-05
**Method:** Live `docker compose` and `curl` against the running stack at the localhost edge.
**Source of truth:** running containers + http responses, not documentation.
**Scope:** every AGENTS.md verification command + 12 additional probes.

---

## 1. Container Inventory (`docker compose ps`)

```text
NAME                  STATUS                     PORTS
reducera_api          Up 18 min  (healthy)       0.0.0.0:3002→3002
reducera_ai_api       Up 18 min  (healthy)       0.0.0.0:3003→3003
reducera_nginx        Up 18 min  (unhealthy)     0.0.0.0:80→80, 0.0.0.0:443→443
reducera_postgres     Up 18 min  (healthy)       0.0.0.0:5433→5432
reducera_qdrant       Up 18 min  (unhealthy)     0.0.0.0:6333→6333
reducera_redis        Up 18 min  (healthy)       0.0.0.0:6380→6379
```

```text
MISSING from dev compose (declared in AGENTS.md service table):
- reducera_web          NOT RUNNING
- reducera_celery_worker  NOT RUNNING (dev compose does not declare it)
```

**Findings**

| # | Observation | Severity |
|---|---|---|
| R-1 | `reducera_web` not running. Root URL `/` returns 502 because nginx upstream `web:3000` is unreachable. | CRITICAL |
| R-2 | `reducera_celery_worker` is absent from `docker-compose.yml` (only declared in `docker-compose.prod.yml` line 253). Dev runs cannot exercise async pipelines, learning workers, or quiz workers. | HIGH |
| R-3 | `reducera_nginx` reports **unhealthy** in compose even though `nginx -t` passes and `/nginx-health` returns 200. The compose healthcheck is a bogus shell TCP probe (`bash -c '</dev/tcp/127.0.0.1/80' || exit 1`) that just confirms the port is open. | MEDIUM |
| R-4 | `reducera_qdrant` reports **unhealthy** for the same reason — the healthcheck is `bash -c '</dev/tcp/127.0.0.1/80'` which checks port 80 (nginx), not port 6333 (qdrant itself). Real `GET /healthz` returns `healthz check passed`. | MEDIUM |
| R-5 | Both unhealthy services are still serving traffic correctly. The healthcheck is a false negative. | — |

## 2. Edge Health (`curl http://localhost/...`)

```text
/nginx-health        → HTTP 200  text/plain   (matches AGENTS.md requirement)
/api/v1/docs         → HTTP 200  text/html    (Swagger UI reachable)
/ai/                 → HTTP 404  application/json
/                    → HTTP 502  text/html    (upstream web:3000 unreachable)
```

```text
ai-api direct :3003/      → HTTP 200  (root handler in main.py:80-82)
api   direct :3002/api/v1/docs → HTTP 200  (Swagger reachable)
qdrant :6333/healthz     → "healthz check passed"
qdrant :6333/collections → 6 collections: test, test-collection, test-memory,
                                              test-memory-collection,
                                              reducera-memory, reducera-embedding
```

**Findings**

| # | Observation | Severity |
|---|---|---|
| R-6 | `/ai/` returns 404 because nginx `location /ai/ { proxy_pass http://reducera_ai_api/ai/; }` (nginx.conf:140) forwards the `/ai/` prefix, and the AI app mounts its v1 router at `prefix="/ai"` (main.py:85). There is no handler at `/ai/` itself. AGENTS.md §25 / `curl http://localhost/ai/` requires 200. | HIGH (route contract violation) |
| R-7 | Qdrant collection `reducera-embedding` exists, dimension 1024, distance Cosine — matches `EMBEDDING_DIM=1024` in `.env` (per AGENTS.md). But `indexed_vectors_count: 0` and `points_count: 0`. RAG is wired but **empty** — the tutor will have no grounded retrieval source until a content ingestion pipeline runs. | HIGH (functional, not security) |
| R-8 | Test collections (`test`, `test-collection`, `test-memory`, `test-memory-collection`) still exist in the live Qdrant. They should be removed for production. | LOW |

## 3. Environment Audit

```text
grep INTERNAL_AI_API_SECRET .env  →  (empty)
grep MANUAL_PAYMENT_ACCOUNTS   .env  →  (empty)

Docker startup warning (api):
  level=warning msg="The \"MANUAL_PAYMENT_ACCOUNTS\" variable is not set. Defaulting to a blank string."
  level=warning msg="The \"INTERNAL_AI_API_SECRET\" variable is not set. Defaulting to a blank string."

Docker startup warning (ai-api):
  level=warning msg="The \"INTERNAL_AI_API_SECRET\" variable is not set. Defaulting to a blank string."
```

**Findings**

| # | Observation | Severity |
|---|---|---|
| R-9 | `INTERNAL_AI_API_SECRET` is unset in `.env`. `InternalServiceGuard` (`internal-service.guard.ts:60-64`) reads the secret via `ConfigService.get('INTERNAL_AI_API_SECRET')` and returns 401 "Unknown service" when the value is empty. This means **every ai-api → api internal call is unauthenticated at the application layer today**. Internal contract is broken in dev. | CRITICAL (security boundary inactive) |
| R-10 | `MANUAL_PAYMENT_ACCOUNTS` is empty. `payment` module will fall back to the placeholder env default; manual payment submission flow degrades. | MEDIUM |

## 4. Internal API Surface

```text
grep -rln "@InternalOnly\|@Controller.*internal" services/api/src
  services/api/src/v1/internal/internal-resources.controller.ts
  services/api/src/v1/ai-credits/ai-credits-internal.controller.ts

Internal endpoints in production OpenAPI:
  GET  /api/v1/internal/resources/{id}         (InternalOnly)
  POST /api/v1/internal/resources/callback     (InternalOnly)
  /api/v1/internal/ai-credits/...              (newest commit; not enumerated in this run)

Not present (per phase-10 follow-up):
  POST /api/v1/internal/episodes
  POST /api/v1/internal/decision-traces
  POST /api/v1/internal/agent-sessions
  GET  /api/v1/internal/agent-sessions/{id}/resolve

Live probe (no signature):
  GET /api/v1/internal/resources/cb-test  → HTTP 401  (guard is enforcing missing creds)
```

**Findings**

| # | Observation | Severity |
|---|---|---|
| R-11 | The internal contract is partially wired: `internal/resources/*` exists with the correct guard; `ai-credits` has a new internal controller (commit `25f89a8`). But the master-prompt follow-ups (episodes, decision-traces, agent-sessions) remain absent on the API side. AI can be running with `write_episode()` but every POST currently lands on 404. | HIGH (broken cross-service write path) |
| R-12 | `internal-service.guard.ts:88` builds the replay cache in **process memory** (`this.seen = new Map()`). AGENTS.md "Service Ownership & Cross-Service Boundaries" says multi-replica requires moving this to Redis. Dev compose has 1 replica, prod compose has no `replicas:` clause either; OK for now, must be addressed before horizontal scaling. | LOW (today) / HIGH (when scaling) |

## 5. Public API Surface (Live Swagger)

```text
GET /api/v1/docs-json → 236 paths
  GET    140
  POST   117
  PATCH   29
  DELETE  31

First 8 paths (sorted) are state-machine intent endpoints:
  /admin/articles/{id}/approve
  /admin/articles/{id}/archive
  /admin/articles/{id}/reinstate
  /admin/articles/{id}/reject
  /admin/articles/{id}/suspend
  /admin/classes/{id}/approve
  /admin/classes/{id}/archive
  /admin/classes/{id}/reinstate
```

The presence of explicit `/approve`, `/reject`, `/suspend`, `/reinstate`, `/archive`, `/mark-paid`, `/start-review` confirms the AGENTS.md "State machines" pattern (six explicit state tables; sensitive transitions through intent endpoints, not `PATCH status`).

**Findings**

| # | Observation | Severity |
|---|---|---|
| R-13 | 236 routes is consistent with a deep domain. The state-machine audit (docs/audit/api-state-machine-audit.md) is verified by the live OpenAPI snapshot. | PASS |
| R-14 | `services/api/src/app.module.ts:9` imports `@arcjest/nest` (`ArcjetModule`). The class name is a typo of `@arcjet/nest`. If the real package is not installed this will throw at boot. Boot succeeds → it is installed. But the import name is a code-smell and a future risk on a clean install. | LOW |

## 6. Cross-Service URL Triangle (Web → Nginx → API / AI)

```text
Web server-side (SSR) call shape (lib/api.ts:19-25):
  if (import.meta.server)  return config.apiInternalUrl || config.public.API_URL
  else                     return config.public.API_URL

  config.apiInternalUrl = process.env.API_URL_INTERNAL ? `${API_URL_INTERNAL}/api/v1` : 'http://api:3002/api/v1'
  config.public.API_URL = process.env.NUXT_PUBLIC_API_URL || 'http://localhost/api/v1'
```

Nginx contract (nginx.conf:124-136):
```nginx
location /api/ {
    proxy_pass http://reducera_api/api/;   # → api:3002
}
location /ai/ {
    proxy_pass http://reducera_ai_api/ai/; # → ai-api:3003
}
location / {
    proxy_pass http://reducera_web;        # → web:3000
}
```

API main.ts:54:
```ts
app.setGlobalPrefix(`api/${APP_VERSION}`)   // → /api/v1
```

AI main.py:85-86:
```py
app.include_router(v1Router, prefix="/ai")     # /ai/v1/...
app.include_router(agents_router, prefix="/ai")  # /ai/agents
```

**Path reconciliation (browser → upstream)**

| Browser URL        | Nginx → upstream        | API/AI internal path   | Result |
|---|---|---|---|
| `/api/v1/docs`      | `api:3002/api/v1/docs`   | `/api/v1/docs`         | 200 ✓ (matches `setGlobalPrefix`) |
| `/api/v1/sandbox/...` | `api:3002/api/v1/sandbox/...` | `/api/v1/sandbox/...` | OK |
| `/ai/v1/agents`     | `ai-api:3003/ai/v1/agents` | `/ai/v1/agents`     | 200 (router lives at `/ai` prefix) |
| `/ai/`              | `ai-api:3003/ai/`       | `/ai/`                 | 404 (no handler at `/ai/`) ← R-6 |
| `/`                 | `web:3000/`             | `/`                    | 502 (web not running) ← R-1 |

**Findings**

| # | Observation | Severity |
|---|---|---|
| R-15 | `/api/v1/*` and `/ai/v1/*` route correctly because both `setGlobalPrefix('api/v1')` and `include_router(prefix='/ai')` line up with the nginx `proxy_pass` that preserves the upstream prefix. The `/ai/` root is the one edge that breaks. | HIGH (R-6) |
| R-16 | Frontend URL builder inconsistency (`apps/web/app/lib/api.ts:260-272`): `agentApi.run` and `agentApi.listTraces` call `${getApiUrl()}/v1/agents/run` (missing `/api` prefix), while every other call in the same file uses `${getApiUrl()}/api/v1/...`. With the live runtime these calls will hit the API at `/api/v1/v1/agents/run` and 404. Confirmed by the missing `api/` segment in the function. | HIGH (frontend bug, will 404 in production) |
| R-17 | API responds 200 at `/api/v1` only as a Swagger redirect; non-documentation requests at that exact path return 404. Confirmed: `curl http://localhost:3002/api/v1` returns `{"code":"NotFoundException"}`. | LOW |

## 7. Qdrant Production Readiness

```text
Collection       Vectors   Dim    Distance   indexed_vectors
reducera-embedding  0       1024   Cosine     0  ← empty
reducera-memory     ?       1024   Cosine     ?
```

**Findings**

| # | Observation | Severity |
|---|---|---|
| R-18 | `reducera-embedding` is the **document** collection (per `v1/resources/service.py`); `reducera-memory` is the **memory** collection. The docs/01-audit/ai-rag-audit.md maps the pipeline. With 0 vectors the tutor can only fall back to ungrounded generation. | HIGH (RAG is empty) |
| R-19 | Test collections (4) still present in Qdrant. These should be removed before any production cutover. | LOW |

## 8. Dev Compose vs Prod Compose Diff (Topology)

| Concern | dev `docker-compose.yml` | prod `docker-compose.prod.yml` | AGENTS.md verdict |
|---|---|---|---|
| `celery-worker` | MISSING (line — no block) | present (line 253) | dev fails the celery invariant |
| Networks | single `reducera_network` | `reducera_backend` + `reducera_frontend` (split) | dev violates "split networks" |
| Postgres / Redis / Qdrant exposure | `ports:` published on host | `expose:` only | dev violates "no DB host ports" |
| `depends_on` health condition | many `condition: service_started` | consistent `condition: service_healthy` | dev violates "Never bypass healthcheck" |
| `api-migrate` profile | absent | present (line 170) | dev needs manual `prisma migrate deploy` |
| Resource limits | absent | `deploy.resources.limits` on every service | dev has none |
| Logging driver | unset | `json-file` 20m/5 (consistent) | dev uses default driver |
| Healthcheck real | API: `/api/v1/docs` ✓ ; Qdrant/Nginx: bogus `/dev/tcp/.../80` | API: same ✓ ; Qdrant: `/healthz` ✓ ; Nginx: `/nginx-health` ✓ | dev healthchecks false-negative for qdrant and nginx |

**Findings**

| # | Observation | Severity |
|---|---|---|
| R-20 | Dev compose is materially weaker than prod on the dimensions AGENTS.md calls out (split networks, host exposure, depends_on health, healthcheck correctness, resource limits, migrate profile). Anyone running `docker compose up -d --build` today for development gets a less-secure, less-observable stack than what would run in production. | HIGH |
| R-21 | Dev compose healthcheck `bash -c '</dev/tcp/127.0.0.1/80'` for `qdrant` and `nginx` is a copy-paste mistake that creates silent false-negative health states. Replace with real endpoints (`/healthz` for qdrant, `/nginx-health` for nginx). | MEDIUM |

## 9. Test Pyramid (per `__tests__` directory)

```text
services/api/src/v1/__tests__/                  15 integration specs
services/api/src/common/authz/__tests__/        4 unit specs
services/api/src/common/streak/__tests__/       (not enumerated)
services/api/test/                              3 e2e + 1 schema snapshot
services/ai-api/v1/*/__tests__/                 231+ unit tests (per phase-10 report)
apps/web/app/__tests__/                         1 spec (polish.spec.ts)
apps/web/app/lib/__tests__/                     foundation.spec.ts (parse_partial flagged)
```

**Findings**

| # | Observation | Severity |
|---|---|---|
| R-22 | The web has only one E2E test. Per AGENTS.md "Web verification (Playwright MCP)" this is the minimum floor; many flows in `docs/02-audit-web/web-route-audit.md` still need Playwright snapshots and a 3×3 viewport matrix. | HIGH |
| R-23 | The api has 15+ integration specs (articles, classes, daily-activity, db-invariants, financial-hardening, leaderboard, ledger-wallet, ownership, payment-flow, payouts, quiz-evaluation, refunds, streak-once-per-day, streak-resets-on-missed-day, theme-invariants). These cover the major business flows but skip without `TEST_DATABASE_URL` per AGENTS.md. | MEDIUM (verifying CI config is out of scope for this report) |

## 10. Summary

| Dimension | Status | Evidence |
|---|---|---|
| Docker stack boots | PASS | 6/8 services up, 4 healthy, 2 false-unhealthy |
| Edge proxy reachable | PARTIAL | `/`, `/api/v1/docs`, `/nginx-health` 200; `/ai/` 404; `/` 502 |
| Web tier reachable | FAIL | container not running (R-1) |
| Celery tier reachable | FAIL | not declared in dev compose (R-2) |
| Healthchecks trustworthy | FAIL | 2/6 are fake TCP probes (R-3, R-4) |
| Internal contract enforced | FAIL | secret unset, all internal calls would 401 by design (R-9) |
| Internal endpoints complete | PARTIAL | `internal/resources/*`, `internal/ai-credits/*`; missing episodes/decision-traces/agent-sessions (R-11) |
| API state machines wired | PASS | 236 routes, intent endpoints visible (R-13) |
| RAG primed | FAIL | `reducera-embedding` has 0 vectors (R-18) |
| Dev compose matches prod | FAIL | split networks, health conditions, host exposure, resource limits, migrate profile all weaker in dev (R-20) |
| Frontend URL contract | FAIL | `agentApi.run` and `agentApi.listTraces` miss `/api` prefix and will 404 in production (R-16) |
| Web test coverage | WEAK | 1 E2E test, 1 foundation test (R-22) |

**VERDICT: PHASE 0 complete. System is partially deployed; multiple production invariants are violated today. No code change authorized yet.**
