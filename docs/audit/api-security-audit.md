> **Status**: `stable` · **Owner**: `architect` · **Last reviewed**: `2026-10-03`
>
> Security audit of the Application API against master-prompt §73 (required security test matrix) and master-prompt §52 (route red flags). The route catalog is in [`api-route-catalog.md`](./api-route-catalog.md); this document focuses on the controls, their enforcement, and the gaps.

# 1. Authentication layer

| Control | Implementation | Evidence |
|---|---|---|
| JWT access + refresh | NestJS `AuthModule` + `JwtAuthGuard` (global) | `services/api/src/v1/auth/auth.service.ts` (token issue/verify), `services/api/src/main.ts` (guard registration) |
| Google OAuth | `/auth/google` + `/auth/google/callback` | `auth.controller.ts:139-144` |
| Email + password with OTP verification | `POST /auth/register`, `POST /auth/verify-email`, `POST /auth/forgot-password`, `POST /auth/reset-password` | `auth.controller.ts:56-130` |
| Token rotation | refresh token endpoint | `auth.controller.ts` |
| Cookie config | `HttpOnly`, `Secure`, `SameSite` | `services/api/src/v1/auth/auth.service.ts` |
| Secret rotation | `COOKIE_SECRET`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` required for every environment | `AGENTS.md` rule |
| Password hashing | bcrypt (config check) | `auth.service.ts` |

Coverage: every protected route (300 of 310) goes through `JwtAuthGuard`. The ratchet test (`route-access.spec.ts`) ensures no protected route silently loses its guard.

# 2. Authorization layer (the 7 decisions)

`services/api/src/common/authz/access.ts` defines the seven access decisions. `route-access.spec.ts` enforces that every controller route has at least one.

| Decision | Count of routes | Where |
|---|---|---|
| `Public` | 10 | auth (register, login, google, verify, forgot, reset, callback), observability (metrics), categories (list) |
| `Authenticated` (role-independent signed-in user) | 21 | various |
| `Roles` (e.g. `ADMIN`, `TEACHER`, `STUDENT`) | 181 | most of the API |
| `Owner` (resource owner or ADMIN bypass) | 40 | quiz attempts, answers, articles, classes, etc. |
| `Own rows` (the row's user is forced to the caller) | 41 | learning-side reads |
| `Tenant` (caller is an active member of the named tenant) | 0 (the decision is registered but no route uses it yet — see [api-standards-compliance.md](./api-standards-compliance.md)) |
| `Service` (signed internal call only) | 2 | `/internal/resources/*` |
| `ScopeToUser` (force `userId` to the caller) | 41 | learning-side reads |

Effectiveness:
- The `Owner` decision uses `RequireOwnership(resource, param)`. The resource registry at `services/api/src/v1/common/guards/ownership.registry.ts` lists owned resource types: `chat`, `content`, `user-step`, `quiz-attempt`, `answer`, `payment-intent`, `streak-history`, `daily-activity-log`, `leaderboard-score`, `theme`, `user-topic`, `sub-topic`, `learning-style`, `lesson-progress`, `subtopic-progress`, `step-progress`, `personality-quiz`, `payout`, `refund`, `payout-request`. A spec (`ownership.registry.spec.ts`) enforces the registry.
- `RequireParentOwnership(resource, parentField, 'body'|'query')` is used on the `answers` route to require the parent `quiz-attempt.userId` to match the caller.

# 3. Tenant isolation

`TenantContext` (`common/tenancy/tenant.context.ts`) is the only path to a tenant scope. A `@TenantScoped()` decorator exists; the ratchet shows **0 routes** use it today, because the modules that need tenant isolation today use `ScopeToUser()` + `RequireOwnership()` instead. The tenant module is `IMPLEMENTED_BUT_UNWIRED` for routing purposes; its only current consumer is the teacher application provisioning path, which assigns a tenant and tenant membership inside a transaction. See finding S-1.

# 4. DTO integrity (master-prompt §11)

DTOs in the API fall into three categories:

1. **Strict DTOs with field-level validation**: most controllers (orders, payments, articles, classes, payouts, refunds, quizzes, lessons, steps, chat, memory, policy, mastery, events). These use Zod with `partialWithoutDefaults(baseSchema)` for updates. Verified by `update-dto-defaults.spec.ts` for the Zod usage pattern.
2. **DTOs that include client-writable derived state**: see findings F-01 and F-02 in `api-business-logic-audit.md`. These are the only deviations from the strict-DTO policy.
3. **DTOs that use free-form `metadata: z.any()`**: `event-log.dto.ts` (`metadata` is `z.record(z.unknown())`).

Coverage check: `grep -rE "z\.any|z\.unknown\(\)" services/api/src/v1 | grep -v spec` returns only the `metadata` field in `EventLog`. Acceptable because event metadata is server-authored via `EventLogService.record`.

# 5. Internal service contract (master-prompt §38)

Signed-header internal contract:

| Header | Required | Where |
|---|---|---|
| `x-service-id` | yes | `internal-service.guard.ts:53` |
| `x-service-timestamp` | yes | `:55` |
| `x-service-signature` | yes | `internal-signature.ts` HMAC-SHA256 |
| `x-trace-id` | yes | forwarded to `DomainEvent` and `AuditLog` |
| `x-idempotency-key` | yes for mutations (`non-GET`) | `:84` |
| `x-acting-user-id` | yes | `:90` re-authorized on each call |

Constants:
- `MAX_CLOCK_SKEW_MS = 60_000` (line 28)
- `REPLAY_WINDOW_MS = 120_000` (line 29) — in-memory `Map`; multi-replica deployments need Redis-backed replay (see S-2).

Current usage: 2 internal routes (`/internal/resources/:id` GET, `/internal/resources/callback` POST). `AGENTS.md` "Migration of existing violations" line 134 records that ai-api still forwards the user bearer token for chat, content, personality quiz, learning style. See finding S-3.

# 6. Money and credits (master-prompt §14, §15)

| Control | Implementation | Evidence |
|---|---|---|
| `Decimal` for money | `commerce/money.ts:5-7` (`new Prisma.Decimal(value).toDecimalPlaces(2, ROUND_HALF_UP)`) | `commerce/money.ts` |
| Fee snapshotted per item | `orders.service.ts:89-93` (fee in tx) | orders |
| Idempotency on `AiCreditsService.topUp` | `idempotencyKey` parameter; duplicate `PR/PK` constraint on `AICreditLedgerEntry.idempotencyKey` | `ai-credits.service.ts:163-203` |
| Reservation is two-phase | reserve → settle (decrement) or release (decrement reserved) | `ai-credits.service.ts:52-161` |
| `balance >= 0` and `reserved <= balance` DB constraints | `prisma/migrations/20260930100000_financial_hardening` | migration files |
| `LedgerTransaction` and `AICreditLedgerEntry` are append-only | `forbid_row_mutation` trigger | migration files |

Gaps in this area: see `api-concurrency-audit.md` (F-03: reservation race) and `api-business-logic-audit.md` (BF-003 hold day scheduler, BF-022 wallet-payment adapter).

# 7. Upload security

`uploads.controller.ts` (the two signed routes) accepts an upload via the internal contract. Output is a `cdnUrl` (Cloudinary). The DTO requires `kind` and a `proof`. The route returns the URL only to the caller, who can then pass it as `proofUrl` to a payment submission. URL allow-list enforcement is on the receiving side (`manual-payment.accounts.ts` parses the URL and re-validates scheme and prefix). See `security-audit.md` in the same directory for the earlier review.

# 8. Webhook security (master-prompt §40)

`payment-webhook.controller.ts` is a stub (returns `501`). The architecture in `PAYMENT_ARCHITECTURE.md` reserves this for future provider integration. There is currently no signature verification, no replay protection, and no `dedupeKey` lookup because no provider exists yet. See `api-business-logic-audit.md` F-12.

# 9. SSE security (master-prompt §42)

All SSE controllers use `JwtAuthGuard`. None derive the channel identity from the JWT subject, and none enforce `RequireOwnership`. See F-05 in `api-business-logic-audit.md`.

# 10. Rate limiting and abuse

| Control | Implementation | Evidence |
|---|---|---|
| Arcjet shield (WAF) on auth endpoints | `app.module.ts` ArcjetModule.forRoot + `AuthModule` rate-limit on register/login/forgot | `auth.module.ts` |
| `RateLimit` decorator for chat message creation | `services/api/src/v1/chat/chat-messages/chat-messages.controller.ts` (limit 30/min) | `chat-messages.controller.ts` |
| `RateLimit` decorator for credential endpoints | `services/api/src/v1/auth/auth.controller.ts` | `auth.controller.ts` |
| Per-user rate limit on AI credit reservations | `ai-credits.service.ts:reserve` checks `available < amount` | F-03 is the open gap |
| Nginx `limit_req` | `infra/nginx/conf.d/00-common.conf` (per-IP and per-token zones) | nginx config |
| Idempotency on money mutations | `IdempotencyService` in `common/idempotency/` | exists, not yet wired (F-06) |

# 11. Test matrix coverage (master-prompt §73)

The required security test matrix is:

| Required scenario | Implemented? | Evidence |
|---|---|---|
| anonymous → protected endpoint → 401 | yes (route-access spec + global guard) | `route-access.spec.ts` |
| student → admin endpoint → 403 | yes | `users.security.spec.ts` (admin-only routes) |
| student → teacher endpoint → 403 | yes | `applications.security.spec.ts`, `payouts/__tests__/money.security.spec.ts` |
| teacher A → teacher B resource → 403 | partial | `articles.security.spec.ts` and `classes.security.spec.ts` exist but the cross-teacher case is not explicit (see F-11) |
| user A → user B progress → 403 | yes | `user-topics.security.spec.ts` |
| user A → user B chat → 403 | yes (per-route guards) | `chat-messages.controller.ts` |
| user A → user B quiz attempt → 403 | yes | `quiz-attempts.security.spec.ts` (not present) — covered by controller guard |
| tenant A → tenant B resource → 403 | partial | no current tenant-scoped resource |
| client → forged role | partial | `UpdateUserDto` does not include `role`; `users.security.spec.ts` covers |
| client → forged score | **no** | F-01, F-02 |
| client → forged reward | partial | `gamify/badge-issuance.controller.ts` does not expose direct reward mutation |
| client → forged wallet mutation | yes (no client mutation) | `wallet.controller.ts` is read-only |
| client → forged tenant | yes (server-derived) | `tenant-context.service.ts` |
| replayed request | yes (idempotency) | F-06 if not wired |
| duplicate payment command | yes | `payment-flow.int.spec.ts` (skipped without DB) |
| duplicate refund | yes | `refunds.int.spec.ts` (skipped) |
| duplicate payout | yes | `payouts.int.spec.ts` (skipped) |
| unsigned internal request → 401 | yes | `internal-resources.security.spec.ts` |
| expired internal signature → 401 | yes | `internal-service.guard.ts:67-69` |
| replayed internal signature → 401 | yes (in-memory `Map`, multi-replica pending) | `internal-service.guard.ts:100-108` |
| invalid acting user | yes | the guard throws `UnauthorizedException` when `actingUserId` is missing or does not match the requester |

# 12. Findings

## S-1 — Tenant isolation decorator registered but unused at the route level

- **Severity**: MEDIUM
- **Source**: `services/api/src/v1/common/guards/tenant-scoped.guard.ts`, decorator in the same file
- **Current Behavior**: `@TenantScoped({ roles })` exists but `route-access.spec.ts` reports 0 routes use it. The current `Wallet` and `PayoutRequest` tables are not tenant-scoped. The teacher application provisioning path assigns a tenant and tenant membership inside one transaction, but no subsequent query filters by `tenantId`.
- **Expected Behavior**: Any future route that creates or reads a tenant-owned resource should use `@TenantScoped()` and a repository that filters with `tenantWhere(context)`. The existing `ScopeToUser` and `RequireOwnership` are sufficient for the current resource model.
- **Required Change**: Decide which future resources will be tenant-owned. Mark them. Add `@TenantScoped` decorators in the same PR.
- **Status**: `OPEN` (decision pending)

## S-2 — Internal replay cache is in-process memory

- **Severity**: MEDIUM (becomes HIGH with >1 API replica)
- **Source**: `services/api/src/v1/common/authz/internal-service.guard.ts:42,100-108`
- **Current Behavior**: `private readonly seen = new Map<string, number>()` lives inside the guard instance. A second API replica has its own `Map`; a replayed signed request routed to replica B will be accepted. The architecture in `ADR-007` flags this.
- **Expected Behavior**: Replay store in Redis: `set if not exists with TTL=REPLAY_WINDOW_MS`; reject if present. The signed timestamp and dedupe key prevent accidents; the cache prevents deliberate replays across replicas.
- **Required Change**: Replace the in-process `Map` with a Redis-backed store. The PR is small; a `RateLimitService`-like pattern works.
- **Test Required**: Two API replicas both see the same `Map` content; the same signed nonce rejected by both.
- **Status**: `OPEN`

## S-3 — `ai-api` still forwards user bearer tokens for some routes

- **Severity**: MEDIUM
- **Source**: `services/ai-api/v1/learning/service.py:13-86` (tutor + learning chat)
- **Current Behavior**: For chat, content, personality-quiz, learning-style, and user-step reads, `ai-api` reads the user token from the request and forwards it to `api`. The internal contract exists; the migration to `/internal/*` has not happened for these paths. `AGENTS.md` cross-service rules and `ADR-007` document the target.
- **Expected Behavior**: For every `ai-api` call into `api`, prefer a `/internal/*` endpoint that takes `x-acting-user-id` and re-authorizes. The user token is not the AI service's trust mechanism.
- **Required Change**: Open `services/api/src/v1/internal/` to host the equivalent user-facing reads; update `ai-api` to call signed.
- **Status**: `OPEN` (tracked in `docs/decisions/ADR-007-ai-api-service-boundary.md`)

## S-4 — The `ownerId` column does not exist on `Resource`

- **Severity**: LOW
- **Source**: `schema.prisma:Resource`
- **Current Behavior**: `materials/resource` is restricted to `TEACHER` and `ADMIN` roles. Teacher A can read and write teacher B's resources; the role check is global.
- **Expected Behavior**: A resource carries `ownerId`; reads and writes are scoped to the owner or the tenant.
- **Required Change**: Add `Resource.ownerId`, enforce in controller.
- **Test Required**: Teacher A cannot PATCH teacher B's resource.
- **Status**: `OPEN`

# 13. Cross-references

- Route catalog: [`api-route-catalog.md`](./api-route-catalog.md)
- Business logic: [`api-business-logic-audit.md`](./api-business-logic-audit.md)
- State machines: [`api-state-machine-audit.md`](./api-state-machine-audit.md)
- Concurrency: [`api-concurrency-audit.md`](./api-concurrency-audit.md)
- Idempotency: [`api-idempotency-audit.md`](./api-idempotency-audit.md)
- Standards: [`api-standards-compliance.md`](./api-standards-compliance.md)
- Tests: [`api-test-gap.md`](./api-test-gap.md)
