# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

`AGENTS.md` at the repo root is the authoritative rulebook (Docker/compose/Dockerfile rules, **API architecture rules** including decision authority, URL standard, request contract, DTO integrity, authorization, state machines, money/credits, concurrency, idempotency, database, internal contract with `ai-api`, tests; service ownership; forbidden actions; git policy; verification checklist). Read it before infra, cross-service, or API/business-rule changes. The points below are the ones that most often affect day-to-day work.

## Repository shape

Monorepo with a single root `.git` and a single root `.env` (never create `.env` files in service dirs; only `.env.example` is committed).

| Dir | Service | Stack | Port |
|---|---|---|---|
| `services/api/` | `api` | NestJS 11 + Prisma 7 (PostgreSQL), BullMQ, Socket.IO/SSE, Zod | 3002 |
| `services/ai-api/` | `ai-api` + `celery-worker` | FastAPI, LangChain/LangGraph, LlamaIndex, Celery, Qdrant | 3003 |
| `apps/web/` | `web` | Nuxt 4, Nuxt UI, Pinia, TanStack Query | 3000 |
| `infra/nginx/`, `infra/postgres/`, `infra/qdrant/` | infra config | | 80/443 |

There is no admin app in this repo, but `ADMIN_URL` is still a required env var (compose passes it and `services/ai-api/main.py` puts it in the CORS origins).

Nginx routes `/` → web, `/api/` → api, `/ai/` → ai-api. API is served under `/api/v1` (Swagger at `/api/v1/docs`); FastAPI routes are mounted under `/ai` (`v1Router` in `services/ai-api/v1/router.py`).

## Commands

Full stack (from repo root):

```bash
docker compose up -d --build            # dev stack
docker compose config                   # validate compose (also run with -f docker-compose.prod.yml)
docker compose ps
docker compose logs -f api
docker compose -f docker-compose.prod.yml --profile migrate run --rm api-migrate   # prod prisma migrate deploy
```

`services/api/` (pnpm):

```bash
pnpm dev                                # nest start --watch
pnpm build                              # prisma generate && nest build && tsc-alias
pnpm lint                               # eslint --fix
pnpm test                               # jest (rootDir=src, *.spec.ts)
pnpm jest src/v1/learner-model          # single file/dir
pnpm jest -t "test name"                # single test by name
pnpm test:e2e                           # test/jest-e2e.json
pnpm prisma migrate dev --name <name>   # new migration; pnpm seed runs prisma/seed.ts via tsx
pnpm seed:theme                         # also seed:golden-graph
```

CI (`.github/workflows/ci.yml`) runs only two jobs: `bash scripts/check-ownership-rules.sh` (the `AGENTS.md` detection greps) and the `api` suite (`prisma migrate deploy` against a Postgres 15 service, then `pnpm jest --silent`). `ai-api` and `web` tests are not in CI, so run them locally. Run the ownership script after any cross-service change. `bash infra/scripts/check-theme-sync.sh` fails when `services/api/prisma/seed-data/reducera-ocean.theme.json` and `apps/web/app/theme/reducera-ocean.theme.json` differ; the two copies must stay byte-identical.

`services/ai-api/` (uv):

```bash
uv run pytest -q
uv run pytest config/__tests__/test_rate_limit.py::test_name    # single test
uv run pytest --cov=. --cov-report=term-missing
uvicorn main:app --reload --port 3003
celery -A config.celery:celery_app worker --loglevel=info
```

Pytest `testpaths` are `tests`, `__tests__`, `config/__tests__`, `utils/tools/__tests__`, and `v1` (tests colocated with features). `python_files` is `test_*.py` and `*_test.py`, with `pythonpath = ["."]` and `--import-mode=importlib`, because most packages have no `__init__.py` (duplicate basenames such as `service.py` collide, and `config/celery.py` would shadow the real `celery` package under the default import mode). `utils/tools/__tests__/test_memory.py` needs a reachable Qdrant, so `conftest.py` ignores it; run it with `QDRANT_URL=http://localhost:6333 uv run pytest --noconftest utils/tools/__tests__/test_memory.py`. Every public `ai-api` route that spends LLM budget must authenticate the caller (`config/user_auth.py::authenticated_user`) and bind `userId` to it; `@rate_limit` raises at import time if the endpoint has no `request: Request` parameter.

`apps/web/` (pnpm): `pnpm dev`, `pnpm build`, `pnpm preview`, `pnpm test` (`vitest run`, node environment, picks up `app/**/*.test.ts` and `app/**/__tests__/**`), `pnpm vitest run <path>` for one file, `pnpm build:assets` (`scripts/build-brand-assets.mjs`). There is no lint script.

Web is SSR (`ssr: true`): content and theme must be in the first HTML, no `Math.random()`/`Date.now()`/`window` during render, server calls use `API_URL_INTERNAL` not the public URL, and no `swr`/`isr`/`prerender` on pages that render user state. Full list in `AGENTS.md` ("Web Rendering Rules").

## Architecture: strict service ownership

This is the rule most likely to be broken by a well-meaning change:

- `api` is the **only** service that touches PostgreSQL/Prisma, and the only place auth/ownership checks live. It must not call LLM providers or Qdrant.
- `ai-api` (and `celery-worker`) own Qdrant, LLM clients, and Tavily. They must not receive `DATABASE_URL` or use Prisma/SQLAlchemy. When they need DB data they call `api` over HTTP. `AGENTS.md` says to forward the user's bearer token; the target is signed service identity (proposed in `docs/decisions/ADR-007-ai-api-service-boundary.md`, `AGENTS.md` not yet amended). Today the resource flow uses signed `/internal` routes and the other calls still forward the token to user-facing, ownership-checked endpoints.
- When `api` needs AI (embedding, generation, RAG), it calls `ai-api` over HTTP.
- Missing capability on the owner service → add an endpoint there; never bypass. Migration order for existing violations is in `AGENTS.md` ("Migration of existing violations").

No boundary violation is open. `api` has no LLM or embedding code, dependency or credential; the former Gemini call in `common/lib/embeding.ts` had no callers and was deleted. The grep patterns in `AGENTS.md` ("Detection") define violations; run them after cross-service changes.

AI providers (only `ai-api` and `celery-worker` get these): the LLM is one OpenAI-compatible gateway (`OPENAI_API_KEY`, `OPENAI_BASE_URL`; the project uses `https://ai.flaz.id/v1`) with two modes built in `services/ai-api/config/providers.py`: flash (`OPENAI_MODEL_FLASH`, `OPENAI_MAX_TOKENS`, `pipeline.llm`) and thinking (`OPENAI_MODEL_THINKING`, `OPENAI_THINKING_MAX_TOKENS`, `pipeline.llm_thinking`); embeddings are computed remotely by Hugging Face Inference (`HF_TOKEN`, `HF_EMBEDDING_MODEL`, `HF_EMBEDDING_URL`, `EMBEDDING_DIM`). Google Gemini credentials are gone (a `gemini/...` model id served by the gateway is allowed). Changing the embedding model or dimension needs new Qdrant collection names and a re-embed; `ai-api` refuses to start on a vector-size mismatch. A developer's personal `HF_TOKEN` stays in the git-ignored root `.env` only.

Redis serves three roles: app cache, BullMQ broker (`api`, see `services/api/src/v1/queue/`), and Celery broker (`ai-api`). Embedding/indexing work runs as Celery tasks (`v1/*/workers.py`, `config/celery.py`).

### Dev vs prod discrepancy

`main.py` no longer spawns Celery (`services/ai-api/__tests__/test_main_no_subprocess_spawn.py` fails if `Popen` returns), and the `ai-api` image only runs uvicorn. `docker-compose.prod.yml` has a dedicated `celery-worker`; `docker-compose.yml` does not. So in dev nothing consumes the Celery tasks in `v1/*/workers.py` (resource extract and embedding, lesson content generation, personality quiz generation; the routers enqueue them with `.delay()`) unless you start a worker yourself with the `celery -A config.celery:celery_app worker` command above. Check this first when one of those requests never completes in dev.

`AGENTS.md` refers to `docker-compose.build.yml` for production builds; that file does not exist in the repo.

### API layout (`services/api/src`)

`app.module.ts` → `v1/v1.module.ts` aggregates feature modules under `v1/`: learning side (auth, chat, curriculum, learning, learner-model, misconception, quiz, gamify, sse, queue, tutor, teacher) and money/tenancy side (tenants, orders, payments, commerce, entitlements, ledger, payouts, refunds, marketplace, classes, articles, simulator, internal). Cross-cutting code is in `common/` (response interceptor, exception filters, idempotency, logging). Path alias `@/*` → `src/*` (resolved by `tsc-alias` at build). Responses are wrapped globally by `ResponseInterceptor`; validation is Zod-based. Prisma schema/migrations: `services/api/prisma/`.

### Access control (`services/api`)

- **Every route must declare an access decision** or `src/common/authz/__tests__/route-access.spec.ts` fails: `@Public()`, `@Roles(...)`, `@RequireOwnership(resource)` / `@RequireParentOwnership(resource, field, 'body'|'query')`, `@ScopeToUser()`, `@TenantScoped({ roles })`, `@InternalOnly()`, or `@AuthenticatedOnly()` (only when the service enforces the rows). New owned resource types go in `v1/common/guards/ownership.registry.ts`. Guard order is global: JWT → Roles → Ownership; `docs/architecture/AUTHORIZATION_MATRIX.md` lists every route.
- **Sensitive state changes are intent endpoints** (`approve-payment`, `POST /users/:id/role`, `/teacher/applications/:id/approve`), never `PATCH status`. They run in one transaction with a row lock, follow a state table (`orders/order-state.ts`), are idempotent, and write an `AuditService` entry.
- **Tenant context** comes from `@TenantScoped()` (`common/tenancy`). `x-tenant-id` only selects among the caller's own memberships; tenant-owned queries must filter with `tenantWhere(context)`.
- **Service-to-service** calls use signed headers (`common/authz/internal-signature.ts`, Python twin `services/ai-api/config/service_auth.py`, shared test vectors). Routes live under `/internal` with `@InternalOnly()`. The API must keep Nest's `rawBody` parser: do not add `app.use(json())` in `main.ts`, it hides the raw body and every signed POST fails.
- **Zod 4 keeps `.default()` inside `.partial()`**. Build update DTOs with `partialWithoutDefaults` (`common/lib/zod-partial.ts`); `update-dto-defaults.spec.ts` enforces it.
- Money is `Decimal`. Database rules (checks, partial unique indexes, append-only triggers) live in the hand-written tails of `prisma/migrations/*_domain_foundation` and `*_payment_domain`; Prisma does not know about them.

### Payments (`services/api/src/v1/payments`, `orders`, `commerce`)

- Manual payment is the V1 adapter; the provider abstraction is the architecture (`docs/architecture/PAYMENT_ARCHITECTURE.md`, ADR-008). Do not put provider logic (proofs, bank accounts, gateway payloads) in `orders/`, `commerce/` or `entitlements/`, and do not import `payments/providers/*` from them.
- Order → `PaymentService` → provider adapter. Approval, gateway settlement or any other verification ends in `PaymentService.markVerified`, which publishes `PaymentVerified`; `CommerceFulfillmentService` reacts (order paid, entitlement, creator earning, ledger, order fulfilled). Never grant access or write earnings from a controller.
- Events go through `DomainEventBus.publish(event, tx)` inside the caller's transaction and are persisted in `DomainEvent`; a consumer error rolls the whole transaction back. Every event needs a stable `dedupeKey`.
- Lock order is Order, then PaymentIntent (`PaymentService.lockIntent`). Keep it, or approve/cancel/expiry can deadlock.
- A new gateway is a `PaymentProviderAdapter` registered in `PaymentsModule`, selected by `PAYMENT_PROVIDER`; only `providers/manual` exists. `POST /webhooks/payments/:provider` returns `501` until one exists.
- Refunds, wallets and payouts are now in code (`refunds/`, `payouts/`, `ledger/wallet.service.ts`, `commerce/wallet`, `commerce/withdrawals`, `commerce/commerce-refund.service.ts`, state tables `refunds/refund-state.ts` and `payouts/payout-state.ts`, migration `*_payout_refund_guards`). `PAYMENT_ARCHITECTURE.md` and `PHASE_3_REPORT.md` (2026-09-30) still call them "next phase"; trust the code and the `refunds`/`payouts`/`ledger-wallet` integration specs over those docs.
- Payment settings: `PAYMENT_PROVIDER`, `PAYMENT_INTENT_TTL_MINUTES`, `PLATFORM_FEE_PERCENT`, `MANUAL_PAYMENT_MAX_SUBMISSIONS`, `MANUAL_PAYMENT_ACCOUNTS` (JSON). Without accounts, paid orders answer `503`.
- The `*.int.spec.ts` files in `src/v1/__tests__/` (`payment-flow`, `payouts`, `refunds`, `ledger-wallet`, `financial-hardening`, ...) commit rows to `TEST_DATABASE_URL` and append-only tables cannot be cleaned: use a disposable database.

### Database and tests

- Never run `prisma format` (it rewrites the whole schema). `prisma migrate dev` is interactive; in scripts use `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script` and write the migration folder by hand. Expect `migrate diff` to be empty after `migrate deploy`.
- The dev database has no migration history; baseline it with `prisma migrate resolve --applied` for the five pre-Phase-1 migrations before `migrate deploy` (steps in `docs/architecture/PHASE_1_REPORT.md`).
- HTTP tests use `src/test-utils/http-harness.ts` (real Roles/Ownership guards and exception filters, fake login via `x-test-user`). Database tests need a scratch database, never the dev one: set `TEST_DATABASE_URL` (schema at head) and `TEST_LEGACY_DATABASE_URL` (legacy data for the entitlement backfill); without them those suites skip.
- Python tests without syncing the heavy project: `uv run --no-project --with pytest --with requests --with fastapi --with python-dotenv --with pydantic --with httpx pytest -q config/__tests__`. Some existing tests fail for known reasons (see the Phase 1 report).
- `INTERNAL_AI_API_SECRET` must be set in the root `.env` for `api`, `ai-api` and the celery worker.

### AI layout (`services/ai-api`)

Feature packages under `v1/` (`learning`, `resources`, `users_steps`), each with `router.py`, `dto.py`, `service.py`, `workers.py`, and pipeline modules (LangGraph/LangChain). `config/` holds env loading (`ENVS`), Celery app, embedding pipeline, rate limiting, URL allowlist, prompt segmentation. `utils/tools/` holds agent tools (web search, memory).

## Docs

`docs/README.md` explains the Business Flow → Data Flow → System Flow triplet structure (`BF-XXX`/`DF-XXX`/`SF-XXX`); `docs/progress-tracker.md` is the task list. The audit/plans/operations docs live in `docs/audit/`, `docs/plans/`, `docs/operations/` (renamed from `docs/01-audit` etc.); `docs/progress-tracker.md` still links to the old `01-audit`/`03-plans`/`04-operations` paths, `docs/README.md` does not. `docs/STYLE-GUIDE.md` governs doc format.

`docs/architecture/CURRENT_STATE.md` is a pre-Phase-1 snapshot (its own banner says so), and the Phase 1 and Phase 3 reports predate the payout/refund/ledger/simulator work; check the code before quoting them. `docs/superpowers/{specs,plans}/` hold dated design specs and implementation plans. `docs/repomix-output.xml` is a generated 540 KB dump: do not read it.

## Conventions that differ from defaults

- **No comments in code. Ever.** No comments in code, Dockerfiles, docker-compose, nginx.conf, or any other configuration file unless explicitly requested. No JSDoc, no docstrings, no inline `//` or `#` annotations. Self-document through structure and naming. Prefer a clearer function/variable name over a comment. If a piece of logic is non-obvious, restructure the file (split, rename) instead of adding a comment. The full rule and rationale is in `AGENTS.md` under "Code Rules".
- Never run `git add`, `git commit`, `git push`, rebase/merge/reset --hard, or amend. Only read git state; report changed and untracked files when done and let the owner stage/commit.
- Compose/Dockerfile rules (`restart: unless-stopped`, healthchecks on every service, `runner` final stage, non-root `reducera` user, no `latest` tags, prod exposes only nginx ports) are in `AGENTS.md`.
- Audit structure and callers with `codebase-memory-mcp` (`check_index_coverage`, `search_graph`, `trace_path`), then confirm negative claims with `grep`. Details in `AGENTS.md` ("Code audit").
- Verify web changes in a real browser through the `playwright` MCP (viewports 375/768/1280, light and dark, reduced motion, zero console errors), not only `pnpm build`. Details in `AGENTS.md` ("Web verification"). Always pass `filename` as `.playwright-mcp/<name>.png` (git-ignored); a bare name lands in the repo root.
- Before claiming infra work complete: `docker compose config`, prod `config`, `docker compose ps` healthy, `curl http://localhost/nginx-health`, `curl http://localhost/api/v1/docs`.
