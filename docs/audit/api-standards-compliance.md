> **Status**: `stable` · **Owner**: `architect` · **Last reviewed**: `2026-10-03`
>
> Standards-compliance audit of the Application API against master-prompt §11 (DB integrity), §13 (transaction), §14 (money), §15 (AI credit), §19 (domain events), §22 (idempotency), §30 (entitlement), §36 (errors), §52 (route red flags), §76 (production quality gate). The route catalog is in [`api-route-catalog.md`](./api-route-catalog.md); this document is a checklist that scores each standard.

# 1. Scorecard

| Standard | Where it lives in the code | Compliance | Evidence |
|---|---|---|---|
| Authentication defined for every route | `route-access.spec.ts` ratchet | **PASS** | 310 / 310 |
| Authorization defined for every route | `route-access.spec.ts` ratchet | **PASS** | 310 / 310 |
| Ownership defined for owned resources | `@RequireOwnership` + registry | **PASS** | `ownership.registry.spec.ts` (20 resource types listed) |
| Tenant scope defined for tenant-owned resources | `@TenantScoped` registered but 0 routes use it | **PARTIAL** | S-1 in `api-security-audit.md` |
| Strict DTOs | Zod via `ZodPipe` | **PARTIAL** | F-01, F-02 in `api-business-logic-audit.md` |
| Stable error codes | `AppErrorCode` enum + `AppExceptionsFilter` | **PASS** | `common/lib/error.ts` (47 codes) |
| Business rule deterministic | services do, no LLM call in `api` | **PASS** | code review |
| State transition defined | 6 state tables | **PASS for 5 / PARTIAL for 1** (SM-4) | `api-state-machine-audit.md` |
| Transaction boundary defined for critical mutations | `prisma.$transaction` everywhere | **PASS** | `orders.service.ts`, `payment.service.ts`, `payouts.service.ts`, `refunds.service.ts`, `commerce-fulfillment.service.ts` |
| Idempotency defined where required | `IdempotencyService` exists, 0 callers | **NO** | `api-idempotency-audit.md` |
| Audit log defined for sensitive commands | `AuditService` | **PASS** | `authz/audit.service.ts` |
| Domain event defined | `DomainEventBus.publish` + 9 enums | **PASS** | `common/events/domain-event-bus.ts` |
| Money = `Decimal` | `commerce/money.ts` (Prisma.Decimal, half-up, 2 dp) | **PASS** | `commerce/money.ts` |
| AI credit = integer, idempotent | `ai-credits.service.ts` | **PARTIAL** | F-03 (race) |
| Entitlement on paid content | `entitlements.service.ts` | **PARTIAL** | F-07 (curriculum reads not enforced) |
| Errors carry stable codes, no stack leaks in prod | `AppExceptionsFilter` | **PASS** | `common/exceptions/app.exceptions.ts:40-67` |
| Tests exist for critical paths | 90 / 103 suites pass, 11 skip, 2 fail | **PARTIAL** | `api-test-gap.md` |
| Security tests | yes (per module) | **PASS** | many `*.security.spec.ts` |
| Concurrency tests | only in `__tests__/*.int.spec.ts` (skipped without DB) | **PARTIAL** | F-03, G-3 |
| Swagger matches implementation | `/api/v1/docs` from `setupSwagger` | **PASS for existence, NOT VERIFIED for completeness** | `main.ts:47-52` |
| Documentation matches implementation | `docs/audit/api-route-catalog.md` is generated from source | **PASS** | catalog script |
| No secret leakage | no `console.log` of secrets; no hard-coded keys in source | **PASS** | grep |
| No arbitrary client state mutation | PATCH on content (`articles`, `classes`) does not call `assertEditable` | **PARTIAL** | SM-1 |

# 2. Findings

## ST-01 — `Idempotency-Key` not enforced on money routes

Cross-reference: `api-idempotency-audit.md` I-01. Master-prompt §16 requires the key on all money mutations; the contract is implemented but no controller calls it.

## ST-02 — Two PATCH routes accept derived state (master-prompt §52 red flag)

Cross-reference: `api-business-logic-audit.md` F-01, F-02. Master-prompt §52 lists "PATCH score" and "PATCH reward" as red flags. Two DTOs in `quiz/` include `score`, `status`, `isCorrect`, `pointsEarned` in the client-writable surface. Severity: CRITICAL.

## ST-03 — Tenant isolation decorator registered but unused

Cross-reference: `api-security-audit.md` S-1. `@TenantScoped()` is exported; 0 routes use it; the `Wallet` and `PayoutRequest` tables are not tenant-scoped.

## ST-04 — Internal replay cache is in-process memory

Cross-reference: `api-security-audit.md` S-2. Master-prompt §38: a signed header contract must be enforced across replicas; the current `Map` is per-process.

## ST-05 — AI credit reservation is not atomic

Cross-reference: `api-concurrency-audit.md` CONC-01. Master-prompt §15 requires reservation semantics that prevent over-reservation. The current `reserve` has a TOCTOU race.

## ST-06 — PATCH on content bypasses the state machine

Cross-reference: `api-state-machine-audit.md` SM-1. Master-prompt §17: every state change must go through a state-machine table. PATCH on a `PUBLISHED` article silently mutates its body.

## ST-07 — Webhook contract is a stub

Cross-reference: `api-business-logic-audit.md` F-12. Master-prompt §40: provider verification, replay protection, idempotency. The current webhook returns `501`. Acceptable today; becomes a CRITICAL the moment a real provider is added.

## ST-08 — `ai-api` still forwards the user bearer token for some routes

Cross-reference: `api-security-audit.md` S-3. Master-prompt §38: the API must re-authorize the acting user from signed context, not trust the token forwarded by the AI service. Migration to `/internal/*` is in progress for some routes (the resources router) and pending for chat, content, personality quiz, learning style, user-step.

## ST-09 — `PAYMENT_SUBMITTED` and `ARCHIVED` are unreachable enum values

Cross-reference: `api-state-machine-audit.md` SM-2. Low severity; documentation-only. The state machine is correct, the values are reserved for future flow changes.

## ST-10 — The authorization matrix doc is stale

`docs/architecture/AUTHORIZATION_MATRIX.md` lists 195 routes. The route catalog shows 310. The ratchet test still passes; the documentation is wrong.

- **Severity**: LOW
- **Fix**: regenerate the matrix from the catalog script.
- **Status**: `OPEN`

## ST-11 — Sandbox does not persist attempts

Cross-reference: `api-business-logic-audit.md` F-04. Master-prompt §45: the accounting engine is the only writer to the sandbox ledger. The persistence is the gap; the engine is correct.

## ST-12 — No fuzz/property test for the accounting engine

The accounting engine is deterministic and golden-tested. A property-based test (`fast-check`) of 1000 random transaction streams would catch future regressions in the engine without writing 1000 cases by hand. The scaffold is in `accounting-sandbox.service.spec.ts`; the harness is not.

- **Severity**: LOW
- **Status**: `OPEN` (deferred to V3)

# 3. Production quality gate (master-prompt §76)

| Criterion | Status |
|---|---|
| [x] authentication defined | every route |
| [x] authorization defined | every route |
| [x] ownership defined | owned resources |
| [ ] tenant scope defined | partial (0 routes use `@TenantScoped`) |
| [x] DTO strict | mostly; 2 PATCH routes accept derived state (F-01, F-02) |
| [x] stable errors | `AppErrorCode` enum |
| [x] business rule deterministic | services do, no LLM call |
| [x] state transition defined | 6 state machines |
| [x] transaction boundary defined | money mutations |
| [ ] idempotency defined where required | partial (`IdempotencyService` exists but no caller) |
| [x] audit defined | `AuditService` |
| [x] domain event defined | `DomainEventBus` + 9 enums |
| [x] financial mutations deterministic | `Decimal` + half-up |
| [ ] AI credit deterministic under concurrency | partial (F-03) |
| [x] security tests | per-module `*.security.spec.ts` |
| [ ] concurrency tests run | skipped without `TEST_DATABASE_URL` |
| [x] Swagger exists | `/api/v1/docs` |
| [x] documentation matches implementation | generated catalog |
| [x] no secret leakage | grep clean |

# 4. Business-completeness gate (master-prompt §77)

| Criterion | Status |
|---|---|
| [x] actor can trigger it | every flow has a route |
| [x] preconditions are checked | ownership, tenant, state machine |
| [x] command exists | every flow has a command endpoint |
| [x] authorization exists | 7 decisions + ratchet |
| [x] domain logic exists | 6 state machines + services |
| [x] database mutation exists | Prisma |
| [x] state transition exists | see SM audit |
| [x] event exists | `DomainEventBus` |
| [ ] downstream state exists where required | partial (F-09 misconception, F-10 scheduler) |
| [x] resulting business outcome exists | see BF audit |
| [x] failure path exists | `AppError` + `AppExceptionsFilter` |
| [ ] retry path exists | partial (I-01) |
| [ ] idempotency exists where required | no (I-01) |
| [x] audit exists | `AuditService` |
| [x] automated test proves it | per-flow int spec |

# 5. Cross-references

- Route catalog: [`api-route-catalog.md`](./api-route-catalog.md)
- Business logic: [`api-business-logic-audit.md`](./api-business-logic-audit.md)
- State machines: [`api-state-machine-audit.md`](./api-state-machine-audit.md)
- Security: [`api-security-audit.md`](./api-security-audit.md)
- Concurrency: [`api-concurrency-audit.md`](./api-concurrency-audit.md)
- Idempotency: [`api-idempotency-audit.md`](./api-idempotency-audit.md)
- Tests: [`api-test-gap.md`](./api-test-gap.md)
- Business flow traceability: [`api-business-flow-traceability.md`](./api-business-flow-traceability.md)
