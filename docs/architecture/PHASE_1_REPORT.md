# Phase 1 report: security, authorization, tenant and domain foundation

> Date: 2026-09-30. Scope: `cervana-api`, `ai-api-cervana` (auth and resource flow only), compose and env templates, docs.
> Nothing was staged or committed. `AGENTS.md` was not modified (see [ADR-007](../decisions/ADR-007-ai-api-service-boundary.md) for the proposed change).
> Related: [CURRENT_STATE](./CURRENT_STATE.md), [TARGET_STATE](./TARGET_STATE.md), [AUTHORIZATION_MATRIX](./AUTHORIZATION_MATRIX.md), [ADR-001](../decisions/ADR-001-multi-tenancy-model.md).

## 1. Result against the exit criteria

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1 | Test runner works | Met | Jest alias mapping fixed; 24 suites / 371 tests pass with DB env, 345 pass and 26 skip without it |
| 2 | Critical privilege escalation closed | Met | `PATCH /users/:id` accepts only `name` and `image` (strict schema); role changes only through `POST /users/:id/role` (ADMIN, reason required, audited, never on self). Verified by unit tests and by HTTP against the running app |
| 3 | Order tampering closed | Met | `PATCH`/`DELETE /orders/:id` removed. Financial state moves only through `approve-payment`, `reject-payment`, `refund` (ADMIN) and `cancel` (owner while pending), under a row lock, through a state table |
| 4 | Order ownership enforced | Met | List is scoped to the caller; other users get 404 on read and cancel |
| 5 | Role enforcement centralized | Met | `PolicyService` + global `JwtAuthGuard` → `RolesGuard` → `OwnershipGuard`; a ratchet test fails if any route lacks an explicit decision (187/187 decided) |
| 6 | Tenant context exists | Met | `TenantContextService`, `TenantGuard`, `@TenantScoped`, `@CurrentTenant`, `tenantWhere` |
| 7 | Tenant ownership enforced | Met for tenant endpoints | Forged `x-tenant-id`, suspended tenants and role limits tested. No tenant-owned content tables have services yet |
| 8 | Service-to-service auth exists | Partly met | HMAC-signed internal routes for resource read and callback. Other `ai-api` calls still forward the user token (section 6) |
| 9 | Stripe webhook fixed or deprecated | Met | The controller was never registered; it is now registered as `410 Gone` and mutates nothing |
| 10 | Migrations run on a clean DB | Met | 9 migrations applied to an empty database, `prisma migrate diff` empty |
| 11 | Migrations run against existing data | Met on a rehearsal | Legacy-state database seeded with users, topics, orders in every state and user-topics; row counts and order rows identical after migrating. The real dev database is empty and has no migration history (section 6) |
| 12 | Relevant security tests pass | Met | Section 4 |
| 13 | Build passes | Met | `pnpm build` (prisma generate, nest build, tsc-alias) succeeds and the built app boots. `tsc --noEmit` still reports 4 old errors in `prisma/seed.ts`, which `nest build` does not compile |

## 2. Security fixes

| Finding | Fix |
|---|---|
| S1 Any signed-in user could set any user's `role` | Narrow profile schema; dedicated admin endpoint with reason and audit |
| S2 Any user could mark any order PAID; `GET /orders` listed everyone's orders | See criteria 3 and 4 |
| S3 Teacher applications: anyone could create, edit or approve any application, and could set `status` in the body | Submit-for-self only, `PENDING` forced, edit only while pending, approve/reject ADMIN-only and never on own application, approval upgrades role and provisions a tenant in one transaction, all audited |
| S4 About 30 CRUD controllers had no ownership check | Table-driven ownership registry (21 resource types) + `@RequireOwnership` / `@RequireParentOwnership` + `@ScopeToUser` interceptor. `OwnershipGuard` is now global; before it ran only where a controller opted in |
| S5 Stripe webhook | See criterion 9 |
| New: `POST /learning/user-topics` let a learner grant themselves any paid topic (`accessType`, `expiredAt` came from the body) | Learners can enroll only in free topics, always as `FREE`; updates limited to `status` and `progressPercent` |
| New: `PATCH` on 14 DTOs silently reset fields (zod 4 keeps `.default()` inside `.partial()`), e.g. `isVerified`, progress, attempt status, `isGlobal` | `partialWithoutDefaults` helper; a test fails if any `Update*Dto` injects a value from `{}` |
| New: SSE streams broadcast every user's events to every client; the SSE guard verified tokens with an undefined `JWT_SECRET` and replaced `req.user` with the raw payload | Per-user event filtering (chat events by chat ownership), guard trusts the authenticated user, `?token=` in URLs removed |
| New: any user could delete any Cloudinary file | Allowed for ADMIN or when the file id sits under the caller's own prefix or is their avatar |
| New: `PrismaService` logged every query with parameters (password hashes, tokens) | Query logging is opt-in (`PRISMA_LOG_QUERIES=true`) and never logs parameters |
| New: `ai-api` printed raw JWTs and queued them in Celery arguments | Removed; tasks now carry the acting user id only |
| New: `ai-api` URL allow-list let every private and link-local address through when `allow_local` was on (including cloud metadata `169.254.169.254`) | Only loopback can be allowed; an existing failing test now passes and a test covers the metadata range |
| New: prompt-injection detector missed "ignore all previous instructions" and lacked the required phrases | Broader patterns plus positive and negative tests. Note it is still not called from any production path (section 6) |

## 3. Changes

**Authorization** (`src/common/authz/`): `PolicyService`, `AuditService`, `access.ts` (`@AuthenticatedOnly`, `@ScopeToUser`, `UserScopeInterceptor`), `internal-signature.ts`, `internal-service.guard.ts` (`@InternalOnly`), `trace-id.decorator.ts`; `v1/common/guards/ownership.{guard,registry,decorator}.ts`; `common/lib/zod-partial.ts`.

**Tenancy**: `src/common/tenancy/*` and `src/v1/tenants/*` (`GET /tenants/mine`, `GET|PATCH /tenants/current`, `GET /admin/tenants`, `POST /admin/tenants/:id/suspend|activate`, provisioning service).

**Orders**: `order-state.ts` (transition table), rewritten repo, service, controller; approval and refund dual-write `Entitlement` next to the legacy `UserTopic`.

**Entitlements**: `TopicEntitlementBackfillService` and `POST /admin/entitlements/backfill/topic` (ADMIN, audited).

**Internal routes**: `v1/internal/*` (`GET /internal/resources/:id`, `POST /internal/resources/callback`); the token-based `POST /material/resources/callback` was removed.

**AI service**: `config/service_auth.py`, `config/user_auth.py`; resource router, service and workers use them.

**Config**: `INTERNAL_AI_API_SECRET` in `.env.example` and both compose files; `main.ts` uses Nest's `rawBody` parser (the duplicate `json()` registration hid the raw body and broke signature checks on POST).

**Tests and tooling**: `src/test-utils/http-harness.ts` (real guards and filters over HTTP), `pg-fixtures.ts`.

## 4. Tests

| | Before | After |
|---|---|---|
| Jest suites | 8: 1 pass, 7 fail | 24 pass (2 need DB env) |
| Jest tests | 18: 17 pass, 1 fail | 371 pass with DB env; 345 pass, 26 skipped without |
| Route access decisions | none | 187/187, enforced by test |
| Python (`config/__tests__`, light deps only) | not runnable | 51 pass, 8 fail (section 6) |
| End-to-end over HTTP against built app and Postgres | none | 37/37 |

Why the old suites failed: four for the missing `@/` alias in Jest, `contents.controller.spec` for mock typing, `idempotency.service.spec` for a matcher Jest 29 lacks plus a fixture that could never match its own hash, one quiz assertion whose fixture used single-letter tokens the service deliberately ignores, and the backfill spec for a wrong provider token. Fixing the tests exposed real bugs in the code behind them (the zod defaults above). Nothing was deleted or skipped.

Mutation check: removing `@Roles(ADMIN)` and `assertAdmin` from `approve-payment` made three tests fail.

Covered: unauthenticated rejection; role escalation (STUDENT and TEACHER cannot promote; only ADMIN, never self); order tampering, ownership, idempotent and concurrent approval; refund; teacher approval with tenant provisioning; user-topic self-grant; tenant isolation (forged header, several memberships, suspension, role limits, admin cross-tenant); service authentication (missing, unknown, wrong secret, tampered body and path, stale and future timestamps, replay, missing idempotency key, user JWT on internal routes, fail closed without secret, Node and Python signatures agree).

Database invariants proven against real Postgres, including races: one APPROVED payment per order under 4 concurrent inserts; 3 concurrent wallet debits cannot overdraw; 4 concurrent AI credit spends leave a valid balance; append-only ledgers and audit log; published article versions immutable; one entitlement per user and product; earnings must add up.

Run them:

```bash
cd cervana-api
pnpm test                                                        # unit and HTTP tests
export TEST_DATABASE_URL=postgresql://<user>:<pw>@localhost:5433/cervana_phase1_clean
export TEST_LEGACY_DATABASE_URL=postgresql://<user>:<pw>@localhost:5433/cervana_phase1_legacy
pnpm test                                                        # adds DB and legacy-data suites
cd ../ai-api-cervana
uv run --no-project --with pytest --with requests --with fastapi --with python-dotenv --with pydantic --with httpx pytest -q config/__tests__
```

## 5. Migrations

| Migration | Content |
|---|---|
| `20260930001600_reconcile_domain_model_constraints` | Existing drift only: foreign keys now carry `ON UPDATE CASCADE` as the schema says, plus one index. No data change |
| `20260930001645_security_foundation_audit_log` | `OrderStatus.CANCELLED`, `AuditLog` |
| `20260930035916_tenant_foundation` | `Tenant`, `TenantMembership`, `TenantSettings` |
| `20260930040500_domain_foundation` | `Article`, `ArticleVersion`, `ClassProduct`, `ClassSession`, `ClassEnrollment`, `OrderItem`, `Entitlement`, `ManualPaymentSubmission`, `CreatorEarning`, `Wallet`, `LedgerTransaction`, `PayoutRequest`, `Refund`, `AICreditPackage`, `AICreditWallet`, `AICreditLedgerEntry`; extra columns on `LearningEvent` (`tenantId`, `entityType`, `entityId`, `occurredAt`, `idempotencyKey`, unique per user) and `Order` (`subtotal`, `platformFee`, `total`); `OrderStatus` gains `PAYMENT_SUBMITTED` and `EXPIRED`; `Order.topicId` becomes nullable |

The last migration also hand-writes database rules Prisma cannot express: one product per order item and entitlement, positive amounts, earnings that add up, paid products need a price, non-negative wallets, no AI credit overdraft or over-reservation, one APPROVED payment per order, append-only commerce ledger, AI credit ledger and audit log, immutable published article versions.

All changes are additive except `Order.topicId` losing `NOT NULL`. No `DROP` of data. Money is `Decimal`.

`prisma format` rewrites the whole schema file; it was reverted once here. Do not run it on this repo without reviewing the diff.

Applying to the existing dev database (empty, 58 tables, no `_prisma_migrations`):

```bash
cd cervana-api
export DATABASE_URL=<dev database url>
for m in 20251202032210_final_db 20251202230940_final_db 20260115090000_idempotency_key 20260115100000_domain_model 20260115110000_content_job_fields; do
  npx prisma migrate resolve --applied $m
done
npx prisma migrate deploy
```

This exact sequence was rehearsed on `cervana_phase1_legacy`. Back up first if the database ever holds data.

## 6. Known gaps and risks

1. **The web app was not exercised.** All checks ran at the API. Endpoints the UI uses were tightened (orders, user-topics, quizzes, SSE, uploads). In particular: template quizzes (not linked to a learner's progress) are now readable only by ADMIN, and quiz writes need ADMIN or TEACHER; global notifications can be read but not marked read by a learner; paid topics now stay `PENDING` until an admin approves (the previous "payment" path was a fake token); quiz question responses still include `correctAnswer` for the quiz owner. Run the learner flows before deploying.
2. **`INTERNAL_AI_API_SECRET` is missing from the local `.env`.** Add a value (`openssl rand -base64 48`) to `.env` before starting the stack, otherwise AI resource extraction callbacks are rejected (fail closed).
3. **Service authentication covers only two routes.** Other `ai-api` calls still send the user's token to user-facing endpoints (now ownership-checked). Contents, personality quiz and gamification events still need `/internal` equivalents. See ADR-007.
4. **`AGENTS.md` rule 5 contradicts the target model** and is unchanged. The proposed text is in ADR-007.
5. **Replay cache is per process.** Move it to Redis before running more than one API replica.
6. **Client-writable fields remain**: quiz attempt `score`/`status`, answer `isCorrect`/`pointsEarned`, user-step `isDone`/`isUnlocked`, progress rows. Ownership is enforced, but a learner can still write their own results. They need server-side evaluation (learner-model phase).
7. **Curriculum and resources are not tenant-owned.** Any TEACHER can edit any topic, lesson, step, quiz or resource, and delete resources.
8. **Financial deletion risk**: `Order.userId` and related foreign keys cascade on user deletion, so `DELETE /users/:id` (ADMIN) can erase a user's orders. New financial tables use `RESTRICT`; the legacy ones were left alone.
9. **Refund revokes topic access in two places** (`Entitlement.status = REVOKED` and `UserTopic.expiredAt = now`). Confirm that every access check in the app honours one of them; the UI still reads `UserTopic`. Article and class entitlements do not exist yet.
10. **Topic purchases without a paid order** are given an entitlement by the backfill (existing access is preserved) and counted in `withoutPaidOrder` for review. They may be results of the old self-grant hole.
11. **Domain tables are schema only.** No services or endpoints yet for articles, classes, manual payments, earnings, wallets, payouts, AI credits; no `LearningEvent` writers; `recordLearningEvent` in the streak service still has no callers; streak and daily-log writes are ADMIN-only until the event-driven engine replaces them.
12. **Rate limiter** starts each bucket full (`capacity`), so `burst` does not bound the initial allowance and existing tests for it fail (4). Relevant to LLM cost control; needs a design decision.
13. **Pre-existing test failures in `ai-api`** (4 `embedding_pipeline` need `llama_index`, absent from my throwaway environment; 4 `rate_limit` above). `pytest` is not installed in the repo environment (`uv sync --group dev` was not run).
14. **The injection detector and the memory tables have no production callers.** The detector is not applied to memory writes or retrieved chunks; nothing writes learner memory, episodes or decision traces yet.
15. **Other**: `PUT /learning/user-topics/:id` is called by the web app but the API defines `PATCH` (update never worked); non-production error responses include stack traces; the request logger prints full URLs; row-level security is not implemented; tenant `EDITOR` and invitation flows are not built.
16. **Scratch databases** `cervana_phase1_clean` and `cervana_phase1_legacy` exist in the local Postgres container for the integration tests. Drop them with `DROP DATABASE` when no longer needed. The dev database `cervana` was only read.

## 7. Recommended next phase

Phase 2 and 3 together, in this order, because commerce needs products:

1. **Verify the learner flows in the UI** against the tightened API and fix anything legitimate that broke (risk 1). This is the one piece of Phase 1 that is not proven.
2. **Article and class services** on the new tables: tenant-scoped repositories using `tenantWhere`, versioning, publish flow (`DRAFT → PENDING_REVIEW → PUBLISHED`), entitlement-gated reads that never send premium content without an entitlement, public marketplace read limited to `PUBLISHED` products of `ACTIVE` tenants.
3. **Manual payment**: `POST /orders/:id/payment-submissions`, admin review queue, approval that creates entitlement, creator earning, ledger rows and wallet credit in one transaction using the unique-approval and ledger idempotency constraints already in the database.
4. Then wallets, payouts and refunds (Phase 4), keeping the financial invariants as database checks.

Defer the UI role shell to Phase 9, but add the Nuxt route middleware for `/admin` and `/teacher` as soon as those pages exist.
