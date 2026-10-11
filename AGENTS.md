---
name: reducera-agents
description: Operating rules for ReduCera Docker, deployment, environment, and code conventions
metadata:
  owner: reducera
  scope: project
  language: en
  authority: governing-policy
---

# REDUCERA Agent Operating Rules

## Environment Variables

- Use only one `.env` file at the repository root.
- Never create `.env` files inside service subdirectories.
- Commit only `.env.example`. The real `.env` is gitignored.
- Reference variables in compose via `${VAR}` with sensible defaults.
- No compose service uses `env_file`. Each service lists the variables it needs under `environment:`; `ai-api` and `celery-worker` share `x-ai-runtime-environment`. A new variable goes into `.env.example` and into the list of the service that reads it. `scripts/check-compose-env.py` enforces this (ADR-011).
- Never hardcode secrets in `docker-compose.yml`, `Dockerfile`, or source code.
- Rotate `COOKIE_SECRET`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` for every environment.
- Generate secrets with `openssl rand -base64 48` or `python3 -c "import secrets; print(secrets.token_urlsafe(48))"`.
- Service-to-service URLs use Docker service names (`postgres`, `redis`, `api`, `ai-api`, `qdrant`, `celery-worker`).
- Browser-facing URLs (`NUXT_PUBLIC_*`, `PUBLIC_*`) use public host (`http://localhost` or `https://reducera.example.com`).

## Service Naming Convention

| Service | Compose Name | Container Name | Internal Port | Host Port (dev) | Image (prod) |
|---|---|---|---|---|---|
| PostgreSQL | `postgres` | `reducera_postgres` | 5432 | 5433 | `postgres:15-alpine` |
| Redis | `redis` | `reducera_redis` | 6379 | 6380 | `redis:7-alpine` |
| Qdrant | `qdrant` | `reducera_qdrant` | 6333 | 6333 | `qdrant/qdrant:v1.12.4` |
| NestJS API | `api` | `reducera_api` | 3002 | 3002 | `reducera/api:<tag>` |
| FastAPI AI | `ai-api` | `reducera_ai_api` | 3003 | 3003 | `reducera/ai-api:<tag>` |
| Celery Worker | `celery-worker` | `reducera_celery_worker` | — | — | `reducera/ai-api:<tag>` |
| Nuxt Web | `web` | `reducera_web` | 3000 | 3000 | `reducera/web:<tag>` |
| Nginx | `nginx` | `reducera_nginx` | 80, 443 | 80, 443 | `nginx:1.27-alpine` |

## Docker Compose Rules

- Always set `restart: unless-stopped`. Never use `restart: always`.
- Every service must define `healthcheck` with `test`, `interval`, `timeout`, `retries`, `start_period`.
- Use `depends_on` with `condition: service_healthy` or `condition: service_started`.
- Never expose service ports directly to the host in `docker-compose.prod.yml`. Use `expose` only.
- Only `nginx` exposes ports to the host.
- Use named volumes for persistent data. Never use bind mounts for database or model data.
- Networks: `reducera_network` for dev (single), `reducera_backend` + `reducera_frontend` for prod (split).
- Logging driver: `json-file` with `max-size: 20m` and `max-file: 5`.
- Production compose must declare `deploy.resources.limits` for memory and CPU.
- Production must use image references (`image:`) not just `build:` for runtime rollback.

## Dockerfile Rules

- Use multi-stage builds. Final stage named `runner`.
- Use `dumb-init` or `tini` as `ENTRYPOINT` for proper signal handling.
- Run as non-root user (`USER reducera`) in the runtime stage.
- Pin base image to a specific minor version (e.g. `node:20-alpine` not `node:latest`).
- Use `--mount=type=cache,target=/root/.local/share/pnpm/store` for pnpm layer caching.
- Copy only build artifacts (`dist`, `.output`, `build`) to the runtime stage.
- Install `wget` or `curl` in runtime stage for healthcheck.
- Set `ENV NODE_ENV=production` in runtime stage for Node images.
- Set `ENV PYTHONUNBUFFERED=1` and `PIP_NO_CACHE_DIR=1` for Python images.
- Define `HEALTHCHECK` directive inside the Dockerfile, not only in compose.
- Use `EXPOSE` to document port usage, but do not publish from Dockerfile.

## Code Rules

- **No comments in code. Ever.** No comments in code unless explicitly requested. No comments in Dockerfile, docker-compose, nginx.conf, or configuration files. No comments in TypeScript, Python, JavaScript, shell, or YAML. No JSDoc, no docstrings, no inline `//` or `#` annotations. Self-document through structure and naming. Do not leave "I will add a comment later" markers; do not add "explains what this does" comments above simple functions; do not restate the function name in prose. If a piece of logic is non-obvious, prefer a clearer function/variable name over a comment. If a configuration block needs context, restructure the file (split into smaller files, use descriptive env-var names) instead of adding a comment.
- Configuration files should be self-documenting through structure and naming.
- Use environment variables for all deployment-specific values.
- Never commit secrets, tokens, API keys, or passwords to the repository.

## Web Rendering Rules

- `apps/web` renders on the server (`ssr: true`). Every page must put its meaningful content and its theme in the first HTML response.
- During render, never use `Math.random()`, `Date.now()`, `window`, `document` or `localStorage`; derive decorative values from stable inputs. Browser-only code belongs in `onMounted` or `<ClientOnly>`.
- Server-side requests use the internal URLs (`API_URL_INTERNAL`, `AI_API_INTERNAL_URL`), never the public `NUXT_PUBLIC_*` URLs, because `localhost` inside the web container is the container itself.
- Never enable `swr`, `isr` or `prerender` on a page that renders user state; the Nitro cache key ignores cookies and would serve one user's page to another. Cache data payloads that are not user specific instead, with a short timeout and a bundled fallback so rendering never waits on a slow upstream.
- The theme must render from static CSS when the API is unreachable, and the color scheme is stored in a cookie so the server renders the right class.
- Load below-the-fold sections with lazy hydration and avoid duplicate requests: one key per dataset, hydrated from the server payload.
- Never nest `<NuxtLayout>` inside a page under `pages/`: Nuxt then freezes the child route, the URL changes and the screen does not. Layouts are chosen once, in `app.vue`, through `fallbackLayout` (`app/lib/nav.ts`); `lib/__tests__/page-layouts.test.ts` fails on a page that renders `NuxtLayout`.
- Anything that depends on the color scheme or on a media query is decided after mount, or by CSS. The server cannot know the visitor's scheme, so `ThemeShell` renders the light palette inline and the dark palette as a `.dark [data-rc-theme="slug"]` stylesheet (`shellRender`); an attribute or style that differs between the server and the first client render is never repaired by hydration.
- Color and shape come from `--rc-*` tokens (theme rows in the database, `app/theme`), never from fixed palette classes such as `text-white` or `bg-gray-900`; icons come from `GameIcon`, which reads the theme's icon set with a bundled fallback. Raw HTML from content or from the AI is never rendered: markdown goes through `lib/markdown.ts` (`html: false`).
- `experimental.asyncContext` is on, so `useRuntimeConfig`, `useRequestHeaders` and `useRequestEvent` still work after an `await` on the server. `request()` also captures the cookie, event and API URL once (`captureSsrContext`) and hands them to its refresh and retry calls; without that a guest opening a protected URL got a 503 from the auth middleware (`lib/__tests__/request.spec.ts`).
- A page file that has a same-named folder (`orders/[id].vue` next to `orders/[id]/pay.vue`) is a parent route and must render `<NuxtPage />`; otherwise the child never shows. Put the detail view in `[id]/index.vue` (`page-layouts.test.ts` enforces it).
- Every `useAsyncData` key names its dataset and its inputs (`learning-topic-${slug}`); two pages that fetch the same key with different options share one cache entry. Data that must be in the first HTML (article, class, creator, studio editors) uses `await useAsyncData` and returns a plain object for failures instead of throwing, so the error never crosses the payload as an `Error`.
- Reading, learning and checkout screens are single purpose: lesson, step, sub-topic and quiz pages use the `focus` layout (exit, XP and streak only, no sidebar); articles use `reader` (Source Serif 4, reading progress, paywall under a faded preview). Paid text never reaches the first HTML for a reader without access: the page asks `/marketplace/articles/:id/access` and falls back to the public preview.
- Horizontal lists use `PlayScroller` (snap, drag thumb, arrows, edge fade); the global scrollbar styling lives in `play.css` and only sets the standard `scrollbar-*` properties inside `@supports not selector(::-webkit-scrollbar)`, because Chromium ignores the pill thumb once they are set (`scrollbar-css.test.ts`).
- Money that can be zero (balances, earnings, payouts) uses `formatAmount`; `formatMoney` prints zero as "Gratis" and is only for prices.
- Pages that change data send what the API requires: `Idempotency-Key` on order writes comes from `ordersService`; do not call `request('/orders', 'POST', ...)` directly.

## API Architecture Rules

The Application API (`services/api`, NestJS at :3002) is the only authoritative business system. These rules apply to every controller, service, repository, and migration in `services/api`. Detailed findings live in `docs/audit/api-*.md`; this section is the operational summary.

### Decision authority

The API owns and is the only writer of:

- identity, authentication, authorization, tenant context
- users, roles, tenants, memberships
- payments, orders, intents, transactions, refunds
- wallet, payout, earning, ledger, gamification ledger
- entitlement, mastery, misconception
- learning event, episode, decision trace
- authorization, ownership, RBAC, signed internal contract

The AI service proposes, retrieves, reasons, and explains. It does not write authoritative business state.

### URL standard

- All routes under `/api/v1`. Mount point: `setGlobalPrefix('api/${APP_VERSION}')` in `main.ts:54`.
- Swagger at `/api/v1/docs`. Every route must be represented; the `route-access.spec.ts` ratchet fails CI if a route lacks an explicit access decision.
- Stable error envelope via `AppExceptionsFilter`: `{ success, message, code, meta: { requestId, timestamp, statusCode } }`. Do not leak stack traces in production.

### Request contract

- Identity comes from the authenticated context (JWT or signed internal contract). Never trust `userId` / `tenantId` / `role` from the request body or query.
- `Idempotency-Key` header required on every money-mutating POST/PATCH (orders create/cancel, refunds request/approve/process, payouts request/approve/mark-paid/reject, manual payment start-review/approve/reject, wallet top-up, AI credit reserve/settle/release). The `IdempotencyService.execute` deduplicates within 24 h; same key + different body returns `400 IDEMPOTENCY_CONFLICT`.
- All timestamps ISO-8601 UTC.

### DTO integrity

- All write DTOs use Zod with `.strict()`; never spread unvalidated objects into Prisma updates.
- Client DTOs never include derived state: `score`, `isCorrect`, `pointsEarned`, `status` (server-computed via `QuizEvaluationService`).
- Forbidden client-writable fields: `role`, `isActive`, `publishedAt`, `processedAt`, `tenantId` in non-tenant-scoped paths, system timestamps.

### Authorization

Seven decision decorators: `@Public()`, `@Roles(...)`, `@RequireOwnership(...)`, `@RequireParentOwnership(...)`, `@ScopeToUser()`, `@TenantScoped(...)`, `@InternalOnly()`. Every controller route has at least one; the ratchet in `src/common/authz/__tests__/route-access.spec.ts` enforces this.

### Authentication

- Email and password only (D-26); there is no third party sign-in. Passwords are 8 to 72 characters (bcrypt cost 12). Email addresses are trimmed and lower-cased at the DTO.
- Sign-in, password reset request and code resend answer identically whether or not the email is registered, and a login spends a password comparison even for an unknown email. `Unverified email` is only revealed after the right password.
- One-time codes (`otp.service.ts`) are six digits, stored only as an HMAC, valid 15 minutes, allow 5 wrong tries, work once and are keyed by identifier and type. Do not log, return or store a code in clear text outside the dev mock (`OTP_DEV_MODE`).
- The JWT guard checks the session row on every request, so logout, a password reset and a refresh rotation end access at once. A refresh token works once (the old session is deleted when a new pair is issued). Cookies are `HttpOnly`, `SameSite=Lax`, `Secure` in production.

### State machines

- Six explicit state tables: `order-state.ts`, `payment-state.ts`, `refund-state.ts`, `payout-state.ts`, `content-state.ts`, `theme-state.ts`.
- Sensitive transitions go through intent endpoints (`/cancel`, `/approve`, `/reject`, `/start-review`, `/mark-paid`, `/submit-review`, `/publish`), not `PATCH status`.

### Money and credits

- Money is `Prisma.Decimal` at 2-decimal half-up. `compute/money.ts:5-7`.
- Wallets carry `balance` and `reserved` with `CHECK (balance >= 0)` and `CHECK (reserved <= balance)` from the migration.
- AI credit reservations acquire `pg_advisory_xact_lock('aicredit-wallet:<userId>', 0)` at the top of the transaction (advisory-lock pattern; orders service already uses this).
- All money mutations are atomic in one `prisma.$transaction`. No partial application.

### Concurrency and idempotency

- Use `prisma.$transaction` for any read-then-write that crosses multiple rows.
- Use `pg_advisory_xact_lock` for cross-row invariants (orders, AI credits).
- Use unique constraints + P2002 catch for last-write-wins races (streak, gamification, user achievements).
- The `IdempotencyService` table (`idempotencyKey`) deduplicates within 24 h.

### Database

- Migrations are hand-written via `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script` and applied with `prisma migrate deploy`. Never edit an applied migration.
- Test only on scratch databases (`TEST_DATABASE_URL`); never on the dev `reducera` database.
- Append-only tables (`LedgerTransaction`, `AICreditLedgerEntry`, `GamificationLedger`, `DomainEvent`) are protected by `forbid_row_mutation` triggers.

### Learner state

- Concept ids come from `Concept` (stable text key, the golden graph id). `ConceptAlias` and `ConceptCurriculumLink` carry a review status and only `APPROVED` rows act; the mappings are reviewed in git (`prisma/seed-data/concept-aliases.json`, `concept-curriculum-links.json`) and seeded with `pnpm seed:concepts`. `ai-api` keeps no id table: it reads the registry through `GET /internal/concepts` (`v1/domain/adapter.py`).
- `LearningEvent` rows with a `streamSeq` are the append-only event store of one learner; `ConceptMastery` and `LearnerStream` are its projection. Only `LearnerEventsService` writes these three tables (one transaction: append, fold, head); `scripts/check-ownership-rules.sh` fails on any other writer. A stored stream event cannot be updated (trigger); corrections are new events.
- Mastery is the pure fold in `learner-model/mastery/mastery-v1.ts`. Changing the formula means a new `MASTERY_MODEL_VERSION` and a rebuild (`LearnerEventsService.rebuild`), never an edit of stored events or of a projection row. The formula is a proposal for D-08, not a decision.
- Quiz submission appends evidence inside the grading transaction, key `assessment:{attemptId}:{conceptId}`, and fails the submission when the event cannot be stored. A quiz with no approved link appends nothing.
- Learner decisions (next concept, teaching strategy) come from `LearnerPolicyService` with typed reason codes. `LearnerStateService` is the only reader that joins mastery with the registry for the routes, the tutor and `GET /internal/learner-state`.
- There is one mastery. The topic level EMA (`TopicMasteryRecord`) and `SkillNode` are retired: no code reads or writes them (`scripts/check-ownership-rules.sh` fails on `.topicMasteryRecord.` and `.skillNode.` outside specs) and the tables stay in the schema until the owner agrees to drop them. A topic level figure (creator eligibility, recommendations) is computed on read by `LearnerStateService.topicMastery` and `averageMastery` from `ConceptMastery`; skill node states are derived by `skillNodes`. Never derive mastery from step progress or completion.

### Rewards

- Every point is a `GamificationLedger` entry written by `RewardLedgerService` only (`scripts/check-ownership-rules.sh` fails on any other writer). An entry has a rule id, a rule version, a unique idempotency key derived from its cause, and is never updated (trigger); a correction is a reversal entry created through `POST /gamify/rewards/ledger/{id}/reverse` (ADMIN, audited, idempotent).
- Rules live in `gamify/rewards/reward-rules.ts` as versioned data plus pure functions. Changing a number or a condition means a new rule version, never an edit of the old one. The values are a proposal (D-22).
- An assessment is only worth points if its answer key stays private: question reads go through `forViewer` (`quiz/answer-key.ts`) and drop `correctAnswer` for everyone except ADMIN and TEACHER, and a quiz can only be read or started by the owner of the progress it belongs to or by a learner enrolled in the topic of a template quiz (`quiz-access.service.ts`). A new route that returns questions must use both.
- Points that depend on learning (`MASTERY_PROGRESS`, `CONCEPT_PASSED`) are granted only by `RewardEngineService.onAssessment`, inside the transaction that stored the learning event, so evidence and reward commit together. Do not grant points from a controller, from step completion, from a chat message or from the AI service.
- The ledger is projected onto `LeaderboardScore` (`g-{user}`, `t-{user}-{topic}`, `st-{user}-{subTopic}`) in the same transaction as the entry. Points granted before the ledger existed have no entry and stay as they are.
- Reward rules are rows (`RewardRule`, immutable except `active`); `reward-rules.ts` holds only the defaults used when no row exists. A streak day is credited only by `StreakEngineService` from a passed assessment, never by login, chat or step completion; freezes are earned (one per 7 days, at most 2) and never sold. Levels come from `LevelThreshold` rows over ledger XP; stars come from `NODE_MASTERED`. Boards are per topic and opt-in; there is no global board. Values are a proposal (D-25).
- Theme and icons are rows too: `reducera-play` is the seeded default (`pnpm seed:theme`), `GET /gamify/themes/default` is public, and the web falls back to the bundled copy of the same palette. The two JSON copies (`services/api/prisma/seed-data` and `apps/web/app/theme`) must stay byte identical (`infra/scripts/check-theme-sync.sh`).

### Internal contract with `ai-api`

- `InternalServiceGuard` enforces signed headers: `x-service-id`, `x-service-timestamp`, `x-service-signature`, `x-idempotency-key` (for non-GET), `x-acting-user-id`, `x-trace-id`.
- Signature is HMAC-SHA256 over `(timestamp, method, target, sha256(body), actingUserId)`; `actingUserId` is the empty string when the header is absent. `internal-signature.ts` and `services/ai-api/config/service_auth.py` share test vectors.
- Internal routes live under `/internal` and carry `@InternalOnly()` (service identity only, for platform-global data) or `@InternalActing()` (service identity plus an acting user). `ActingUserGuard` loads the user named in `x-acting-user-id` (400 without it, 403 when unknown or inactive) and applies `@InternalOwnership(...)` with no `ADMIN` bypass. The AI service does not gain privileges from internal calls.
- The opposite direction (`api` to `ai-api`) is signed with a different secret, `INTERNAL_API_SECRET`, listed for `api` and `ai-api` only, and the same canonical string. `ai-api` accepts only caller id `api` on its service routes (`users-steps/generate`, `learning/generate-material`, `resources/extract`, `resources/embedding/{id}`), verifies timestamp, HMAC and a Redis replay cache in `config/service_identity.py`, and ignores bearer tokens there; the browser routes (`learning/chat`, `users-steps/generate-question`, `agents/run`) keep the user's bearer token and ignore service headers. `QueueService` validates job payloads with strict schemas and rejects credential-like keys.
- Every `ai-api` call to `api` goes through `config/internal_client.py` (`InternalApiClient`); `scripts/check-ownership-rules.sh` fails when an `ai-api` module references `NEST_API` without it (exceptions: `v1/agents/`, `config/user_auth.py`, `config/envs.py`, the client and signing modules).
- Replay cache is in Redis (`internal:replay:*`, 120 s); when Redis is unreachable the guard logs a warning and lets the request through. The signature, the 60 s clock window and the idempotency key still apply.
- Retried writes are deduplicated per `(key, userId)` for 24 h by `IdempotentWriteInterceptor` on the internal write routes; the client derives one key per operation from the request key, method, path and body.

### Tests

- All controllers have `.security.spec.ts` covering role, ownership, and tenant scope.
- Idempotency on money routes is covered by `IdempotencyService.execute` unit spec and the route-level decorator reflection.
- Concurrency on `ai-credits.service.ts:reserve` is covered by the advisory-lock unit spec.
- Every route has an explicit access decision (route-access ratchet).
- The 18 integration suites in `__tests__/*.int.spec.ts` skip without `TEST_DATABASE_URL`; CI must run them in a Postgres service.

## Network Architecture

- Browser → Nginx (port 80/443).
- Nginx routes `/` → web:3000, `/api/` → api:3002, `/ai/` → ai-api:3003.
- All inter-service traffic uses Docker internal DNS (service names).
- Redis serves three roles: app cache, BullMQ broker, Celery broker.
- Qdrant stores embeddings for RAG pipeline.
- Celery worker is a separate service. Never spawn it as a subprocess inside ai-api container.
- nginx answers 404 for `/api/v1/internal/*`, blanks `x-service-id`, `x-service-timestamp`, `x-service-signature` and `x-acting-user-id` on `/api/` and `/ai/`, and re-resolves upstream addresses (`resolver`, `zone`, `resolve`), so a recreated container is found without a reload.

## Service Ownership & Cross-Service Boundaries

The ReduCera platform follows a strict service-ownership model. Each service has exactly one primary domain. Boundaries are not negotiable; if a feature appears to require breaking one, the correct response is to add a new endpoint on the owner service, not to bypass the boundary.

### Ownership table

| Service | Sole owner of | May call | Must NOT |
|---|---|---|---|
| `api` (NestJS :3002) | PostgreSQL via Prisma; Redis (BullMQ queues); SSE bus; auth + authorization | PostgreSQL; Redis; `ai-api` over HTTP | LLM provider APIs directly; Qdrant client directly; any database other than its own Prisma connection |
| `ai-api` (FastAPI :3003) | Qdrant collections (`reducera-embedding`, `reducera-memory`); LLM provider clients; Tavily client | Qdrant; LLM providers; Tavily; `api` over HTTP | Direct PostgreSQL/Prisma access; `DATABASE_URL` env var; any DB connection string |
| `celery-worker` | inherits `ai-api` rules | same as `ai-api` | Direct PostgreSQL/Prisma access |
| `web` (Nuxt :3000) | – | `api` and `ai-api` via Nginx | Anything else |
| `nginx` | – | All upstream services | – |

### Cross-service rules

1. **If `ai-api` needs DB data**, call an `/internal/...` route of `api` through `InternalApiClient`, which signs the request and names the acting user. Example: `InternalApiClient(session).get(f"/internal/user-steps/{id}")`.
2. **If `api` needs AI capabilities** (embedding, generation, RAG, agent pipeline, structured-output), call `ai-api` over HTTP through `AiServiceClient` (`services/api/src/common/ai-client/`), which signs the request as service `api` with `INTERNAL_API_SECRET` and names the acting user. Example: `POST /ai/v1/resources/extract?type=PDF&resource_id=...` from a queue processor. A job carries identifiers only, never a token (ADR-013).
3. **Never** inject `DATABASE_URL` into `ai-api`'s environment. If the AI service needs data, it asks the API.
4. **Never** inject `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `HF_TOKEN`, or any LLM or embedding credential into `api`'s environment. If the API needs AI, it asks the AI service.
5. Service-to-service calls authenticate with a signed service identity (`x-service-id` + HMAC signature) and carry the acting user, tenant, trace id and idempotency key as headers. `api` re-authorizes the acting user for every operation. User bearer tokens are not forwarded to internal routes.
6. **Read-only DB projections** that `ai-api` legitimately needs (lesson, step, topic, learning style, personality quiz) are exposed as `api` endpoints and consumed over HTTP — never bypassed via direct DB access.
7. **No shared Prisma client, no shared SQLAlchemy, no shared migration tool.** Each service owns its own data layer.

### Rationale

- **Single owner of truth**: state lives in exactly one place per concept. No split-brain across services writing to the same row.
- **DB migrations live in one place** (`api`). Adding a column does not require coordinating schema with `ai-api`.
- **LLM cost and rate-limit** live in one place (`ai-api`). Adding a direct LLM call in `api` would double the cost surface and bypass any rate-limiting we add later.
- **Ownership checks and authorization** live in one place (`api`). If `ai-api` could write to the DB directly, every authorization rule in `api` becomes advisory.
- **Replayability and audit** depend on one choke point per concern. A user-action trace must be reconstructible from one service's logs.
- **Failure isolation**: if `ai-api` is down, the user-facing API can degrade gracefully (return cached content, skip AI features). If `api` is down, AI work cannot write results back — a clear, recoverable failure.

### Migration of existing violations

If you find code that violates these rules, refactor in this order:

1. **Do not** delete the offending call site before adding the corresponding remote endpoint on the owner service.
2. Add the endpoint on the owner service (`ai-api` for LLM/embedding/Qdrant, `api` for DB).
3. Replace the offending call with an HTTP call to the new endpoint. Keep the synchronous-call shape: caller passes input, gets output back.
4. Verify the new path with a smoke test against the deployed stack.
5. Update tests and documentation.

**Open violations** (audit of 2026-10-09, `docs/01-audit/README.md`):

- `services/ai-api/v1/agents/` still sends the user's bearer token to user-facing `api` routes (the agent tools and the decision-trace write); it waits for the agent runtime design.

**Resolved 2026-10-09**: H-002. Jobs queued by `api` hold identifiers only and every call from a processor to `ai-api` is signed (`docs/architecture/api-to-ai-api-service-identity.md`, ADR-013); the four queue-only routes of `ai-api` no longer accept a user token. C-004. `env_file: .env` is removed from every compose service and each service has its own `environment` list (ADR-011); the running containers were recreated and checked: `api` no longer holds LLM credentials, `ai-api` and `celery-worker` no longer hold `DATABASE_URL` or the session secrets, `web` holds 8 variables instead of 78. C-001. The `ai-api` to `api` calls of `learning`, `users_steps`, `episodes` and `decision_traces` were unsigned and rejected; they now use `InternalApiClient` and the routes listed in `docs/architecture/AUTHORIZATION_MATRIX.md` ("Internal routes for `ai-api`"). Design: `docs/architecture/ai-api-service-identity.md`.

**Resolved 2026-09-30**: `services/api/src/common/lib/embeding.ts` (Gemini via `axios`) had no callers and was deleted together with the unused `@langchain/*`, `langchain` and `axios` dependencies of `api`. The unused `@google/generative-ai` dependency was removed from `apps/web`.

### AI providers

- LLM calls use one OpenAI-compatible endpoint (the project uses the Flaz gateway, `https://ai.flaz.id/v1`, with a single key) through `langchain-openai`: `OPENAI_API_KEY`, `OPENAI_BASE_URL`.
- The LLM has two modes. **Flash** (`OPENAI_MODEL_FLASH`, `OPENAI_MAX_TOKENS`, optional `OPENAI_FLASH_TEMPERATURE`) is the fast default, `pipeline.llm`: tutor streaming, summaries, chat replies, quiz generation. **Thinking** (`OPENAI_MODEL_THINKING`, `OPENAI_THINKING_MAX_TOKENS`) is a reasoning model, `pipeline.llm_thinking`: lesson content generation and learning-path planning; it never sends a temperature. `EmbeddingPipeline.llm_prompt` picks the mode from `enable_thinking`. Reasoning tokens count against the token budget, so the thinking budget is larger.
- Model choice is measured, not guessed: see the benchmark in `docs/plans/reducera-v1-execution-plan.md` (section 3.4) and the scripts in `infra/scripts/llm-bench/`. Re-run them before changing a model.
- Embeddings are computed remotely by Hugging Face Inference: `HF_TOKEN`, `HF_EMBEDDING_MODEL`, `HF_EMBEDDING_URL` (with a `{model}` placeholder), `EMBEDDING_DIM`. No embedding model runs inside a container.
- Only `ai-api` and `celery-worker` receive these variables. Gemini is not used anywhere.
- Changing `HF_EMBEDDING_MODEL` or `EMBEDDING_DIM` invalidates stored vectors. Point `QDRANT_COLLECTION` and `QDRANT_MEMORY_COLLECTION` at new names and re-embed; `ai-api` refuses to start when an existing collection has a different vector size.
- A developer's personal `HF_TOKEN` lives only in the git-ignored root `.env` and is removed when the work ends.

### Retrieval

- Every chunk written to the vector store carries the governance metadata of `config/retrieval_governance.py` (contract v1: status, domain, access scope, owner, tenant, concept ids, chunk id). `EmbeddingPipeline.upsert_document` refuses a write without a `Governance`, and a caller cannot override a governance key through the free metadata.
- Every retrieval passes a `RetrievalScope` (actor, domain, optional concept ids and tenant ids); there is no unfiltered mode. The filter is built only in `build_qdrant_filter`: published, the domain, and platform content or the actor's own or the caller's tenants. Do not build a Qdrant filter anywhere else and do not filter after retrieval.
- Concept ids are api `Concept` ids (ADR-009). Content that only one learner may see (`learner-summary`) is `OWNER` scope with that learner as owner. A chunk is cited only with the locators it carries.
- A retrieval failure is a `RetrievalError` and callers answer without materials; a write failure is not hidden.

### Detection

When reviewing code or CI, the following grep patterns indicate a violation that must be fixed before merge:

```
grep -rn "prisma\."            services/ai-api/   # direct DB access from ai-api
grep -rn "DATABASE_URL"        services/ai-api/   # DB env var leaking into ai-api
grep -rn "import.*prisma"      services/ai-api/   # shared ORM import
grep -rn "openai|anthropic|google" services/api/   # direct LLM provider call from api
grep -rn "qdrant_client|QdrantClient" services/api/ # direct Qdrant access from api
grep -rn "ChatOpenAI|ChatGoogleGenerativeAI|ChatAnthropic" services/api/
grep -rniE "GEMINI_API_KEY|generativelanguage|google.generativeai|langchain_google|GeminiEmbedding|ChatGoogleGenerativeAI" --exclude-dir=node_modules --exclude-dir=.venv --exclude-dir=__tests__ --exclude=*lock* services/ apps/ .env.example docker-compose.yml docker-compose.prod.yml
```

Any non-empty result is a violation and must be resolved before merge.

## Deployment Workflow

- Development: `docker compose up -d --build`.
- Production build: `docker compose -f docker-compose.yml -f docker-compose.build.yml build`.
- Production deploy: `docker compose -f docker-compose.prod.yml up -d`.
- Database migrations: `docker compose -f docker-compose.prod.yml --profile migrate up api-migrate`.
- Rollback: change `IMAGE_TAG` in `.env`, then `docker compose -f docker-compose.prod.yml up -d`.
- View logs: `docker compose -f docker-compose.prod.yml logs -f <service>`.
- Health verification: `curl http://localhost/nginx-health` (returns 200 if Nginx is up).

## Forbidden Actions

- Never run `docker compose down -v` in production without explicit confirmation.
- Never edit files inside a running container. Edit on host then rebuild.
- Never use `latest` tag for production images.
- Never bypass healthcheck with `condition: service_started` for critical dependencies.
- Never commit `.env`, `infra/nginx/certs/`, or `infra/qdrant/storage/`.
- Never expose Postgres, Redis, or Qdrant ports to the host in production.
- Never run containers as root in production.

## Required Verification Before Claiming Complete

- `docker compose config` returns valid YAML without errors.
- `docker compose -f docker-compose.prod.yml config` returns valid YAML.
- All services start and report healthy: `docker compose ps`.
- `curl http://localhost/nginx-health` returns 200.
- `curl http://localhost/api/v1/docs` returns Swagger UI.
- Frontend loads at `http://localhost/`.
- Web changes pass the Playwright matrix in "Web verification (Playwright MCP)".
- Structural claims (callers, boundaries, removed code) are backed by `codebase-memory-mcp` evidence, see "Code audit (codebase-memory-mcp)".

## Code audit (codebase-memory-mcp)

- Audit with the `codebase-memory-mcp` graph before claiming anything about structure, callers or service boundaries. The project is listed by `list_projects` (currently `home-misbahul45-code-reducera`, root `/home/misbahul45/code/reducera`).
- Order: `index_status` and `check_index_coverage` for every cited path, then `search_graph` to find symbols, `trace_path` (direction `inbound`) for callers, `get_code_snippet` for source, `search_code` for graph-ranked text search.
- Re-run `index_repository` with `repo_path` set to the repo root after moves, renames or large changes, and confirm freshness with `check_index_coverage` (`freshness: metadata_match`).
- The graph is best-effort. `parse_partial` files, dynamic imports and calls through instance attributes are blind spots: confirm every zero-caller or "does not exist" claim with `grep` and cite both.
- Record in the report which files were checked by graph, which by grep, and any coverage gaps.

## Web verification (Playwright MCP)

Any change under `apps/web`, or any change that alters what the web renders, is verified in a real browser through the `playwright` MCP. `pnpm build` alone is not enough.

1. Start the full stack with `docker compose up -d --build` (a web-only run floods the console with `ERR_CONNECTION_REFUSED` from the missing `api`) and confirm the URL answers.
2. Drive it with `browser_navigate`, `browser_snapshot` (prefer the accessibility snapshot for assertions), `browser_take_screenshot`, `browser_resize`, `browser_emulate_media` (`colorScheme`, `reducedMotion`), `browser_press_key`, `browser_console_messages` and `browser_network_requests`.
3. Minimum matrix for each changed page: viewports 375x812, 768x1024 and 1280x800; color scheme light and dark; `reducedMotion: reduce` once.
4. Pass criteria: zero console errors; no failed requests to `api` or `ai-api` apart from the expected 401 before login; no horizontal scroll; `<html lang>` set, a `main` landmark and a level-1 heading in the snapshot; every interactive control reachable with Tab and a visible focus ring; body text contrast at least 4.5:1 (3:1 for large text and UI boundaries), measured with `browser_evaluate` on computed styles; with reduced motion, decorative animation is off.
5. Pages behind login: sign in through the UI with a seeded test account. Never paste real credentials or store session data in the repo.
6. Always pass `filename` as `.playwright-mcp/<name>.png`. A bare filename lands in the repo root as an untracked file. The folder is git-ignored; never commit its contents.
7. A change that is meant to alter the look needs a before and after screenshot of the same page, viewport and color scheme, and the report states what visibly changed. "The build passes" is not evidence of a visual change.
8. Report page, viewport, color scheme and result for each check. A skipped check is reported as skipped.

## Git Operations

- The repository uses a **single root `.git`**. Never initialize or clone git inside service subdirectories (`services/api/`, `services/ai-api/`, `apps/web/`).
- **Never run `git add`.** Staging is the owner's responsibility.
- **Never run `git commit`.** Committing is the owner's responsibility.
- **Never run `git push`, `git pull --rebase`, `git merge`, `git rebase`, `git reset --hard`, or `git stash drop` without explicit instruction.**
- **Never amend commits** (`git commit --amend`).
- **Never skip hooks** (`--no-verify`, `--no-gpg-sign`).
- **Never force-push** (`--force`, `-f`, `--force-with-lease`).
- **Never update git config** (`git config user.name`, `user.email`, etc.).
- The agent may only read git state: `git status`, `git log`, `git diff`, `git show`, `git branch` (read-only).
- When work is complete, the agent reports the list of changed and untracked files. The owner performs staging and commits.