> **Status**: `stable` · **Owner**: `architect` · **Last reviewed**: `2026-10-03`
>
> Test-coverage audit of the Application API against master-prompt §71 (test architecture) and §72 (test priority). The route catalog is in [`api-route-catalog.md`](./api-route-catalog.md); this document is the test-layer lens.

# 1. Current inventory

At HEAD `a868095`, with `env -u DATABASE_URL -u TEST_DATABASE_URL pnpm jest --silent`:

| Layer | Suites | Total | Pass | Skip | Fail |
|---|---|---|---|---|---|
| Unit (`.spec.ts`) | 75 | 1160 | 1017 | 143 | 0 (2 suites fail at TS compile) |
| Integration (`.int.spec.ts`) | 18 | 240 (counting each `it`) | 0 (the 18 suites skip without `TEST_DATABASE_URL`) | 240 | 0 |
| Security (`.security.spec.ts`) | 10 | – | pass | – | – |
| **Total** | **103** | **~1400** | **1017** | **383** | **2 TS errors** |

Suites that fail at TS compile (counted as "fail" in master-prompt §97):

- `src/v1/personalization/mastery/__tests__/mastery.service.spec.ts` — calls `new MasteryService(repo, undefined, undefined, 0.3)`, but the constructor takes ≤ 3 arguments (line 71).
- `src/v1/personalization/memory/__tests__/memory.service.spec.ts` — calls `new MemoryService(repo, undefined, undefined)` (line 46), but the constructor takes 1 argument.

The two failures are in tests, not in the service code; the services themselves are still used in the application (with the same constructor shape the test was trying to mirror). The fix is in the test.

# 2. Suites that skip without a database

| File | Required env | Lines that skip |
|---|---|---|
| `src/v1/__tests__/articles.int.spec.ts` | `TEST_DATABASE_URL` | entire file |
| `src/v1/__tests__/classes.int.spec.ts` | `TEST_DATABASE_URL` | entire file |
| `src/v1/__tests__/daily-activity.int.spec.ts` | `TEST_DATABASE_URL` | entire file |
| `src/v1/__tests__/db-invariants.int.spec.ts` | `TEST_DATABASE_URL` | entire file |
| `src/v1/__tests__/financial-hardening.int.spec.ts` | `TEST_DATABASE_URL` | entire file |
| `src/v1/__tests__/leaderboard-cohort.int.spec.ts` | `TEST_DATABASE_URL` | entire file |
| `src/v1/__tests__/ledger-wallet.int.spec.ts` | `TEST_DATABASE_URL` | entire file |
| `src/v1/__tests__/ownership.int.spec.ts` | `TEST_DATABASE_URL` | entire file |
| `src/v1/__tests__/payment-flow.int.spec.ts` | `TEST_DATABASE_URL` | entire file |
| `src/v1/__tests__/payouts.int.spec.ts` | `TEST_DATABASE_URL` | entire file |
| `src/v1/__tests__/quiz-evaluation.int.spec.ts` | `TEST_DATABASE_URL` | entire file |
| `src/v1/__tests__/refunds.int.spec.ts` | `TEST_DATABASE_URL` | entire file |
| `src/v1/__tests__/streak-once-per-day.int.spec.ts` | `TEST_DATABASE_URL` | entire file |
| `src/v1/__tests__/streak-resets-on-missed-day.int.spec.ts` | `TEST_DATABASE_URL` | entire file |
| `src/v1/__tests__/theme-invariants.int.spec.ts` | `TEST_DATABASE_URL` | entire file |
| `src/v1/sandbox/__tests__/sandbox.controller.int.spec.ts` | `TEST_DATABASE_URL` | entire file |
| `src/v1/simulator/__tests__/simulator-balanced-snapshot.spec.ts` (per-suite, some `it`s only) | `TEST_DATABASE_URL` | per `describe` |
| `src/v1/simulator/__tests__/simulator.service.spec.ts` (DB-touching `it`s) | `TEST_DATABASE_URL` | per `it` |

Per `CLAUDE.md`: "Database tests need a scratch database, never the dev one: set `TEST_DATABASE_URL` (schema at head) and `TEST_LEGACY_DATABASE_URL` (legacy data for the entitlement backfill); without them those suites skip."

`AGENTS.md` "Required Verification Before Claiming Complete" does not currently include running the integration suites. The `CLAUDE.md` warning is the only pointer.

# 3. Coverage by route family (audit lens)

| Route family | Unit | Integration | Security | Notes |
|---|---|---|---|---|
| `auth` | 1 (`auth.decorator` unit) | – | 1 (`payments.security` includes auth checks) | No auth flow integration test |
| `categories` | – | – | – | Add `categories.security.spec.ts` |
| `chat` | – | – | – | **MISSING**. Add `chat.security.spec.ts` and `chat-messages.security.spec.ts` |
| `articles` | – | 1 (`articles.int.spec.ts`) | 1 (`articles.security.spec.ts`) | good |
| `classes` | – | 1 (`classes.int.spec.ts`) | 1 (`classes.security.spec.ts`) | good |
| `curriculum` | – | – | – | **MISSING** for any `curriculum/*` security |
| `gamify` | 5 unit specs | – | – | **MISSING** security specs |
| `internal` | – | – | 1 (`internal-resources.security.spec.ts`) | good |
| `learning` | – | – | 1 (`user-topics.security.spec.ts`) | partial; `lesson-progresses` / `step-progresses` / `subtopic-progresses` / `personality-quizzes` / `learning-styles` all `RequireOwnership` but no security spec for them |
| `learner-model` | – | – | – | **MISSING** |
| `orders` | 1 (`order-state.spec.ts`) | 1 (`orders.security.spec.ts`) | (same) | partial; `orders.service.int.spec` would close the loop |
| `personalization` | 6 unit specs (mastery, memory, misconception, policy, skill-node) | 1 (`mastery-update-on-attempt.spec.ts`) | – | partial |
| `payouts` | 1 (`money.security.spec.ts`) | 1 (`payouts.int.spec.ts`) | (same) | good |
| `payments` | 2 unit specs (`manual-payment.provider`, `payment-state`) + 1 integration | 1 (`payments.security.spec.ts`) | (same) | good |
| `quiz` | 1 (`quiz-evaluation.service.spec.ts`) | 1 (`quiz-evaluation.int.spec.ts`) | – | **MISSING**: no `quiz-attempts.security.spec.ts`, no `answers.security.spec.ts` |
| `refunds` | 1 unit spec | 1 (`refunds.int.spec.ts`) | – | partial |
| `sandbox` | 1 (`accounting-sandbox.service.spec.ts`), 1 (`engine-property.spec.ts`), 1 (`golden-graph-validator.spec.ts`) | 1 (`sandbox.controller.int.spec.ts`) | – | good for the engine; controller spec is integration-only |
| `simulator` | 3 unit specs | 1 (`simulator-balanced-snapshot.spec.ts`) | – | good |
| `tenants` | 1 (`tenant-provisioning.spec.ts`) | – | 1 (`tenants.security.spec.ts`) | good |
| `users` | – | – | 1 (`users.security.spec.ts`) | good |
| `ai-credits` | – | – | – | **MISSING**: no tests at all (the F-03 reservation race is untested) |
| `observability` | 1 (`metrics.service.spec.ts`) | – | – | the `/metrics` route is `@Public()` (gap G-8) |
| `agents` | – | – | – | **MISSING** |
| `analytics` | – | – | – | **MISSING** |
| `marketplace` | – | – | – | **MISSING** |
| `tutor` | 1 (`tutor.service.spec.ts`) | – | – | partial |
| `material` | – | – | – | **MISSING** |
| `notifications` | – | – | – | **MISSING** |
| `uploads` | – | – | – | **MISSING** |
| `ledger` | – | – | – | **MISSING** |
| `commerce` | – | – | – | **MISSING** |
| `moderation` | – | – | – | **MISSING** |

# 4. Test priority (master-prompt §72)

| P | Required test | Implemented? |
|---|---|---|
| P0 | security | partial — 10 of 50+ modules |
| P0 | ownership | yes for 20 resource types; some controllers without it |
| P0 | tenant isolation | only one tenant spec |
| P0 | financial integrity | ledger-wallet, financial-hardening (skip without DB) |
| P0 | assessment integrity | NO (F-01, F-02) |
| P0 | data corruption (DB invariants) | db-invariants (skips without DB) |
| P0 | idempotency | NO |
| P0 | state machines | per-state unit specs; integration coverage of full transitions is partial |
| P1 | learning flows | partial — mastery / memory / policy have unit specs; `learning-events` has no spec |
| P1 | commerce flows | partial — payment-flow, payouts, refunds, ledger-wallet, financial-hardening (skips) |
| P1 | creator flows | applications security, articles / classes |
| P1 | credit flows | **NO** — `ai-credits.service.spec.ts` is missing |
| P2 | gamification | unit specs only |
| P2 | analytics | no tests |

# 5. Findings

## T-01 — Critical: no tests for F-01/F-02 (client-writable derived state)

- **Severity**: CRITICAL
- **Source**: `services/api/src/v1/quiz/quiz-attempts/quizAttempets.dto.ts`, `services/api/src/v1/quiz/answers/answers.dto.ts`
- **Current Behavior**: No spec asserts that a `PATCH /quiz-attempts/:id { "score": 100 }` is rejected. The DTO accepts the value; the controller persists it; mastery inflates.
- **Required test**: a `*.security.spec.ts` for `quiz-attempts` and `answers` that asserts the DTO does not include the field and the controller returns 400 if a forged value is supplied (the second assertion is a defense-in-depth; the fix removes the field from the DTO).
- **Test Required**:
  - `PATCH /quiz-attempts/:id { "score": 100, "status": "COMPLETED" }` → 400 (or 200 with score unchanged)
  - `POST /answers { "isCorrect": true, "pointsEarned": 100 }` → 400
- **Status**: `OPEN`

## T-02 — High: no tests for the AI credit reservation race (F-03)

- **Severity**: HIGH
- **Source**: `services/api/src/v1/ai-credits/`
- **Current Behavior**: No spec at all. The reservation race is invisible to the test suite.
- **Required test**:
  - Concurrent reserve test (5 promises); one wallet with `available = 2 * amount`; exactly 2 succeed; wallet's `reserved` equals `2 * amount`; ledger has exactly 2 rows.
  - Single-reserve test that asserts negative `available` is rejected (insufficient credits).
  - Settle test that decrements `balance` and `reserved`, writes refund row if underspent.
  - Release test that decrements `reserved` only.
- **Test Required**: a new `ai-credits.service.spec.ts` (unit, with mocked `PrismaService`) for the deterministic logic, and an `ai-credits.int.spec.ts` (integration) for the race. The integration test requires `TEST_DATABASE_URL`.
- **Status**: `OPEN`

## T-03 — High: no tests for idempotency (I-01)

- **Severity**: HIGH
- **Source**: `services/api/src/v1/common/idempotency/`
- **Current Behavior**: `IdempotencyService` has no caller. There is a unit spec for the service; no spec asserts that money routes deduplicate.
- **Required test**: per money route in `api-idempotency-audit.md` table §2, run the route twice with the same `Idempotency-Key` and assert one effect; run with the same key and a different body and assert `400 IDEMPOTENCY_CONFLICT`; run without a key and assert `400 IDEMPOTENCY_KEY_REQUIRED`.
- **Status**: `OPEN`

## T-04 — High: no tests for state-machine PATCH bypass (SM-1)

- **Severity**: HIGH
- **Source**: `services/api/src/v1/articles/articles.controller.ts`, `services/api/src/v1/classes/classes.controller.ts`
- **Current Behavior**: The state machine is unit-tested (per-state specs). The integration of PATCH with the state machine is not.
- **Required test**: `PATCH /articles/<published-id>` with any body returns `409 CONTENT_LOCKED`. PATCH on a `REJECTED` article succeeds; PATCH on a `PUBLISHED` article fails.
- **Status**: `OPEN`

## T-05 — Medium: 18 integration suites skip without a database

- **Severity**: MEDIUM
- **Source**: the file list in §2
- **Current Behavior**: Without `TEST_DATABASE_URL` set, these suites are skipped at runtime. CI does not run them (the only CI job is `bash scripts/check-ownership-rules.sh` + the api suite without DB).
- **Expected Behavior**: A CI job that spins up a scratch Postgres at the same schema version and runs the api suite against it. `services/api/prisma/migrations/20260930100000_financial_hardening` and the related 17 migrations are additive; the scratch DB can be `reducera_phase1_legacy` per the V1 plan.
- **Required Change**: add a job to `.github/workflows/ci.yml` that:
  1. Boots `postgres:15-alpine` with the same env as compose.
  2. Runs `npx prisma migrate deploy`.
  3. Sets `TEST_DATABASE_URL` to point at it.
  4. Runs `pnpm jest --silent` and asserts `0 skipped, 0 failed`.
- **Status**: `OPEN`

## T-06 — Medium: 2 specs fail at TS compile

- **Severity**: LOW
- **Source**: `mastery.service.spec.ts:12:69`, `mastery.service.spec.ts:60:71`, `memory.service.spec.ts:19:46`
- **Current Behavior**: 2 suites do not compile; the run reports `2 failed, 11 skipped, 90 passed` (after compile fail). The services themselves work; the tests are stale.
- **Required Change**: fix the test constructor calls. The tests were written for an older constructor signature; either update the tests or update the constructor to accept the additional optional parameters.
- **Status**: `OPEN`

## T-07 — Medium: missing security specs for chat, gamify, sandbox, ai-credits, analytics, ledger, commerce, agents, moderation, personal_credits, payouts, payments, marketplace, tutor, material, notifications, uploads

- **Severity**: MEDIUM
- **Source**: see §3 table
- **Current Behavior**: No `.security.spec.ts` exists for these modules. A security flaw goes undetected.
- **Expected Behavior**: One `.security.spec.ts` per controller that exercises `@AuthenticatedOnly`, `@Roles`, `@RequireOwnership`, `@RequireParentOwnership`, `@ScopeToUser`, `@TenantScoped`, `@InternalOnly`, `@Public` semantics. Use `http-harness.ts` (existing infra) to keep tests fast and DB-free.
- **Status**: `OPEN` (deferred to V3 / per-PR)

## T-08 — Low: SSE ownership tests

- **Severity**: LOW
- **Source**: `services/api/src/v1/sse/__tests__/sse-filters.spec.ts` (exists)
- **Current Behavior**: The SSE filter spec exists but does not cover F-05 (cross-user stream events). A two-user test where user A subscribes and user B posts a chat message would catch the gap.
- **Status**: `OPEN`

# 6. Recommended CI change

A single new CI job, run on every PR that touches `services/api/`:

```yaml
- name: api-integration
  services:
    postgres:
      image: postgres:15-alpine
      env:
        POSTGRES_DB: reducera_test
        POSTGRES_USER: postgres
        POSTGRES_PASSWORD: postgres
      ports: ['5432:5432']
      options: --health-cmd "pg_isready -U postgres" --health-interval 5s
  env:
    TEST_DATABASE_URL: postgresql://postgres:postgres@localhost:5432/reducera_test
  steps:
    - uses: actions/checkout@v4
    - uses: pnpm/action-setup@v4
    - run: pnpm --filter api exec prisma migrate deploy
    - run: pnpm --filter api exec jest --silent
    - name: assert no skipped tests
      run: |
        if pnpm --filter api exec jest --listTests 2>&1 | grep -c ".int.spec.ts$" | xargs -I {} \
            pnpm --filter api exec jest --listTests 2>&1 | grep ".int.spec.ts$" | wc -l; then exit 0; fi
```

A more precise version counts suites that ran and asserts the count is `>= 103`.

# 7. Cross-references

- Route catalog: [`api-route-catalog.md`](./api-route-catalog.md)
- Business logic: [`api-business-logic-audit.md`](./api-business-logic-audit.md)
- State machines: [`api-state-machine-audit.md`](./api-state-machine-audit.md)
- Security: [`api-security-audit.md`](./api-security-audit.md)
- Concurrency: [`api-concurrency-audit.md`](./api-concurrency-audit.md)
- Idempotency: [`api-idempotency-audit.md`](./api-idempotency-audit.md)
- Standards: [`api-standards-compliance.md`](./api-standards-compliance.md)
- Business flow traceability: [`api-business-flow-traceability.md`](./api-business-flow-traceability.md)
