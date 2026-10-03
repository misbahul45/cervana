> **Status**: `stable` · **Owner**: `architect` · **Last reviewed**: `2026-10-03`
>
> Maps each declared business flow to the code that performs it, names the gaps that block flow completion, and flags route-level red flags from master prompt §52. The route catalog is in [`api-route-catalog.md`](./api-route-catalog.md); this document is the business-flow lens over the same data.

# 1. Status legend

```
NOT_IMPLEMENTED      no code path
SCAFFOLDED            entity exists, no real behavior
IMPLEMENTED_BUT_UNWIRED  service exists, no caller wires it
PARTIALLY_IMPLEMENTED    some states wired, others missing
IMPLEMENTED_BUT_INSECURE  has the API but not the right DTO
IMPLEMENTED_BUT_NOT_BUSINESS_COMPLETE  business invariant not enforced
IMPLEMENTED            end-to-end on the API
VERIFIED               + integration spec green
```

# 2. Business flow traceability (25 flows)

## BF-001 User learns accounting concept

| Step | Where | Status |
|---|---|---|
| Free-tier open lesson | `services/api/src/v1/curriculum/lessons/lessons.controller.ts:26` (GET `:id` with `@AuthenticatedOnly`) | `IMPLEMENTED` |
| Paid lesson requires entitlement | `lessons.controller.ts:26` + `entitlements.service.ts` lookup | `PARTIALLY_IMPLEMENTED` (entitlement check happens in the service but no `@RequireOwnership` on the route; gap G-7) |
| Start step + chat with tutor | `user-steps.controller.ts:30` (POST) | `IMPLEMENTED` |
| Submit attempt | `quiz-attempts.controller.ts:14` (POST) | `IMPLEMENTED` but **insecure** (see §3 F-01) |
| Server-side evaluation | `quiz-evaluation.service.ts` exists and has 11 specs; **not** wired to `quiz-attempts.service.ts` | `SCAFFOLDED` (gap G-8) |
| Learning event recorded | `event-log.service.ts` exists; only `QuizSubmitted` and `LessonCompleted` and a handful of other events are emitted | `PARTIALLY_IMPLEMENTED` |
| Mastery updated | `mastery.service.ts:updateFromAttempt` exists; called from `quiz-attempts.service.ts:48` | `IMPLEMENTED` |
| Misconception detection | `misconception.service.ts` exists; **no caller** in `quiz-attempts.service.ts` (the `@Optional` injection is unused) | `IMPLEMENTED_BUT_UNWIRED` (gap G-9) |
| Next activity | `adaptive-policy.controller.ts` exposes `GET /next`; policy module is registered in `v1.module.ts:21` | `IMPLEMENTED` |

**Result**: flow is open end-to-end but assessment integrity depends on a server-side evaluator that the route never calls.

## BF-002 User purchases a course (order → payment → entitlement)

| Step | Where | Status |
|---|---|---|
| Create order with `Idempotency-Key` | `orders.controller.ts:19` POST; service uses `pg_advisory_xact_lock` + `errorHandler`; **`Idempotency-Key` header is not enforced** in the controller (gap G-10) | `PARTIALLY_IMPLEMENTED` |
| Order total computed from database (no client price) | `orders.service.ts:90-94` (catalog `resolve` returns `unitPrice`) | `IMPLEMENTED` |
| Platform fee snapshotted per item | `orders.service.ts:89-93` (fee in tx) | `IMPLEMENTED` |
| `PaymentIntent` created in same tx | `orders.service.ts:123-132` (calls `payments.createIntent`) | `IMPLEMENTED` |
| Manual payment proof upload | `payments.controller.ts:53` POST `/manual/intents/:id/submissions` (`@RequireOwnership`) | `IMPLEMENTED` |
| Admin approval / rejection | `admin-payments.controller.ts:46` (approve) + `:57` (reject); both run as state-machine transactions with row locks | `IMPLEMENTED` |
| `PaymentVerified` event triggers fulfillment | `commerce-fulfillment.service.ts` subscribes; emits `EntitlementGranted`, `CreatorEarningCreated`, `OrderFulfilled` | `IMPLEMENTED` |
| Audit log row on every state change | `audit.service.ts:134,213,374` records ORDER_CREATED, ORDER_CANCELLED, MANUAL_PAYMENT_*, etc. | `IMPLEMENTED` |

**Result**: flow closes end-to-end. Idempotency is the only gap.

## BF-003 Creator receives revenue share

| Step | Where | Status |
|---|---|---|
| Earning created on `PaymentVerified` | `commerce-fulfillment.service.ts` | `IMPLEMENTED` |
| Earning matures after `CREATOR_EARNING_HOLD_DAYS` (default 0) | `commerce.config.ts:13-34` | `CONFIGURED`; no scheduler calls `releaseDue()`; `creator-earnings.service.ts:releaseDue()` exists but no caller (gap G-11) |
| Payout request | `payouts.controller.ts:27` POST | `IMPLEMENTED` |
| Admin review/approve/mark-paid | `payouts.controller.ts:66-87` (admin routes) | `IMPLEMENTED` |
| `WALLET_CREDIT` ledger entry | `commerce-fulfillment.service.ts:44-72` | `IMPLEMENTED` |
| `PAYOUT` ledger entry (holds funds) | `withdrawals.service.ts` | `IMPLEMENTED` |
| `Wallet.balance` mutation only via ledger | `ai-credits.service.ts` and `wallet.service.ts` use Prisma increments; cross-table ledger consistency tests in `__tests__/ledger-wallet.int.spec.ts` | `IMPLEMENTED` (test skips without DB) |

**Result**: flow closes end-to-end except for the hold-day scheduler. Earnings release on the next `releaseDue()` call which has no caller in code. `CREATOR_EARNING_HOLD_DAYS` defaults to 0, so a creator can withdraw before the refund window closes (gap G-12).

## BF-004 Learner earns and spends AI credits

| Step | Where | Status |
|---|---|---|
| `topUp()` writes `PURCHASE` / `EARN` ledger entry | `ai-credits.service.ts:163-203` | `IMPLEMENTED` |
| `reserve()` checks balance, increments `reserved`, writes `SPEND` row | `ai-credits.service.ts:52-86` | `IMPLEMENTED` but **race-prone** (see §3 F-03) |
| `settle()` decrements `balance` and `reserved`, writes refund row if underspent | `ai-credits.service.ts:88-139` | `IMPLEMENTED` |
| `release()` decrements `reserved` only | `ai-credits.service.ts:141-161` | `IMPLEMENTED` |
| `getBalance()` returns `available = balance - reserved` | `ai-credits.service.ts:36-50` | `IMPLEMENTED` |
| `GET /credits/me` and `/credits/me/ledger` routes exist | (controller exists in `commerce/credit-packages` for the list endpoint; `wallet.controller.ts` for me) | `IMPLEMENTED` |
| AI service calls reserve/settle/release via internal contract | `InternalServiceGuard` + `Idempotency-Key` are wired in `InternalOnly()`; `ai-credits.service.ts` is reachable via the internal routes but no `ai-api` client has been migrated yet | `IMPLEMENTED_BUT_UNWIRED` for the AI service (gap G-13) |

**Result**: API side closes end-to-end. AI side has the surface but no callers yet; reservation is race-prone.

## BF-005 Creator publishes article

| Step | Where | Status |
|---|---|---|
| Author `POST /articles` (DRAFT) | `articles/articles.controller.ts` (existence verified; route-access passes) | `IMPLEMENTED` |
| `POST /articles/:id/submit-review` (DRAFT → PENDING_REVIEW) | state table `articles/article-state.ts` | `IMPLEMENTED` |
| Reviewer/Admin approve | `admin-articles.controller.ts` (`@Roles(Role.ADMIN)`) | `IMPLEMENTED` (no reviewer capability yet, gap D-12) |
| Marketplace read | `marketplace-articles.controller.ts` | `IMPLEMENTED` |
| `If-Match` optimistic concurrency | (missing) | `NOT_IMPLEMENTED` (gap G-14) |

## BF-006 Creator hosts free class, BF-007 paid class

Same shape as BF-005. The `classes` module has 27 routes covering authoring, marketplace, and admin moderation. Capacity trigger is wired in `orders.service.ts:275-290` (CLASS_FULL). Missing: marketplace search filter by `level`, free vs paid; session attendance capture.

## BF-008 Learner receives next activity (adaptive policy)

| Step | Where | Status |
|---|---|---|
| `MasteryService.listByUser` | `mastery.service.ts` | `IMPLEMENTED` |
| `MisconceptionService.listActiveByUser` | `misconception.service.ts` | `IMPLEMENTED` |
| `AdaptivePolicyService.decideNext` | `adaptive-policy.service.ts` | `IMPLEMENTED` (4 spec cases pass) |
| `AdaptivePolicyController` `GET /next` | `adaptive-policy.controller.ts` | `IMPLEMENTED` |
| Golden graph provider (loads `golden-accounting-graph.json`) | `adaptive-policy.module.ts` | `IMPLEMENTED` |
| Golden graph seed | `prisma/seed-data/golden-accounting-graph.json` (4 levels × ~16 topics) + validator spec | `IMPLEMENTED` |

**Result**: closes.

## BF-009 Mock assessment

| Step | Where | Status |
|---|---|---|
| User fetches quiz with `ScopeToUser` | `quiz-attempts.controller.ts:14` | `IMPLEMENTED` |
| `submitAttempt()` evaluates with `QuizEvaluationService` | `quiz-attempts.service.ts:34-60` | `IMPLEMENTED_BUT_INSECURE` — service has an `Optional` dependency on `QuizEvaluationService` but the route only ever calls `quizAttempetsRepo.create`; the score path is `quiz-attempts.service.ts:38-48` and depends on the call site's score value, not the evaluator (see §3 F-01) |
| `Answer.isCorrect` and `pointsEarned` | `answers.service.ts:13-22` writes the values supplied by the client | `IMPLEMENTED_BUT_INSECURE` (see §3 F-02) |

## BF-010 System certifies readiness

Not implemented. The schema has `LearnerGoal` (scaffold), no `Readiness` model, no `/me/certifications` route. The D-03 decision in `docs/strategy/decision-register.md` defers this to V3. Status: `NOT_IMPLEMENTED`.

## BF-011 Tutor performance review (creator-side analytics)

| Step | Where | Status |
|---|---|---|
| `creator-analytics/creator-earnings.service.ts` aggregates sales by creator | `services/api/src/v1/creator-analytics/` | `IMPLEMENTED` (unit spec green) |
| Mean mastery gain on linked sub-topics | not implemented | `NOT_IMPLEMENTED` (gap G-15) |
| Refund rate per product | not implemented | `NOT_IMPLEMENTED` |

## BF-012 AI credit from learning event

| Step | Where | Status |
|---|---|---|
| `EventLogService.record` (action `LESSON_COMPLETED`, `SCENARIO_PASSED`, `QUIZ_SUBMITTED`, etc.) | `services/api/src/v1/analytics/events/event-log.service.ts` | `IMPLEMENTED` |
| Reward engine consuming events → `CREDIT` ledger entry via `AiCreditsService.topUp` | not implemented; `EventLogService` returns nothing to the credit service | `SCAFFOLDED` (gap G-16) |

## BF-013 AI credit purchase

`POST /v1/commerce/credit-packages/:slug/purchase` exists with idempotent reservation; manual payment follows. `AiCreditsService.topUp` writes `PURCHASE` ledger entry on `PaymentVerified`. **Result**: closes once BF-002 closes.

## BF-014 Refund (BF-008)

| Step | Where | Status |
|---|---|---|
| `POST /orders/:id/refund-requests` | `refunds.controller.ts:36` | `IMPLEMENTED` (within `REFUND_WINDOW_DAYS` default 7) |
| `POST /admin/refunds` (admin-initiated) | `:60` | `IMPLEMENTED` |
| Approval with creator earning reversal | `refunds.service.ts:approve` | `IMPLEMENTED` |
| Earning `REVERSED` + ledger reversal | `commerce-refund.service.ts:61` | `IMPLEMENTED` |
| Audit + `RefundCompleted` event | `refunds.service.ts` | `IMPLEMENTED` |

## BF-015 Payout (BF-003)

| Step | Where | Status |
|---|---|---|
| `POST /payouts` | `payouts.controller.ts:27` (`@Roles(Role.TEACHER)`) | `IMPLEMENTED` |
| `POST /admin/payouts/:id/{start-review,approve,mark-paid,reject}` | `payouts.controller.ts:66-87` | `IMPLEMENTED` |
| `markPaid` requires `MarkPaidDto` (file evidence) | `payouts.controller.ts:79-87` | `IMPLEMENTED` |
| Hold window default 0, configurable, no scheduler | gap | `PARTIALLY_IMPLEMENTED` |

## BF-016 Moderation

Admin moderation only (`@Roles(Role.ADMIN)`). No `REVIEWER` capability yet. Gap D-12. The route infrastructure (`/admin/moderation/{pending,articles/:id/approve,classes/:id/approve}`) is in place.

## BF-017 Creator payout (same as BF-015)

## BF-018 Refund (same as BF-014)

## BF-019 Accounting sandbox practice

| Step | Where | Status |
|---|---|---|
| `GET /sandbox/scenarios` | `sandbox.controller.ts` | `IMPLEMENTED` |
| `POST /sandbox/journal/validate` (no DB write, returns `isBalanced`) | `sandbox.controller.ts` | `IMPLEMENTED` |
| `POST /sandbox/attempts` + `entries` + `post` | gap (F-04 below) | `SCAFFOLDED` |
| `AccountingEngine` (deterministic) | `services/api/src/v1/sandbox/accounting-sandbox.service.ts` | `IMPLEMENTED` with golden spec |
| `Compound-entry` (multi-debit/multi-credit) handling | gap (F-04) | `PARTIALLY_IMPLEMENTED` |

## BF-020 Learner publishes knowledge, BF-021 Knowledge reuse

`Article` ↔ `ArticleVersion` exist; no `ContentSourceRef` (provenance) table. Reference-counting on versions is not implemented. Gap.

## BF-022 Earnings reinvestment

`Order` with `paymentMethod: 'WALLET'` is referenced in `orders.dto.ts` but no wallet-payment adapter exists. The intent is documented in `commerce/commerce.config.ts`; implementation is `SCAFFOLDED`.

## BF-023 Agent self-improvement

`PromptOptimizationService` exists as a scaffold (`src/v1/optimization/`); no frozen benchmark, no judge agreement measured, no acceptance gate. Gap D-10.

## BF-024 Human approval of prompt version

Same as BF-023. No admin endpoints for prompt approval. `SCAFFLED`.

## BF-025 Circularity measurement

`EventLog` exists; `EventAction` enum has the 5 mandatory actions; no aggregation job runs; `MasterySnapshot` / `EngagementMetric` / `CreatorOutcomeMetric` tables exist but `SnapshotService.runAll` is not on a schedule. `SCAFFOLDED` (gap G-17).

# 3. Findings (master prompt §90 format)

## F-01 CRITICAL — Client-writable `score` and `status` on quiz attempts

- **Severity**: CRITICAL
- **Category**: Data integrity, assessment integrity, mastery integrity
- **Business Flow**: BF-009 (mock assessment), BF-001 (learning)
- **Route**: `PATCH /api/v1/quiz/quiz-attempts/:id`
- **Source**: `services/api/src/v1/quiz/quiz-attempts/quiz-attempts.controller.ts:39-43`; DTO `services/api/src/v1/quiz/quiz-attempts/quizAttempets.dto.ts:10-15`
- **Current Behavior**: The DTO `UpdateQuizAttemptDto` includes `score: z.number().min(0).max(100).optional()` and `status: AttemptStatusEnum.default('IN_PROGRESS')` as client-writable fields. The `UpdateQuizAttemptDto` is `partialWithoutDefaults(baseQuizAttemptSchema)` (line 44-45 of the DTO file), so the client can PATCH `score: 100` and `status: 'COMPLETED'` directly.
- **Expected Behavior**: `score`, `status`, `attemptNumber` are server-authoritative derived values. The DTO must contain only `userAnswer` (or empty). The server computes score from the golden answer comparison via `QuizEvaluationService`; the DTO returns the score after evaluation, never accepts it.
- **Business Impact**: A learner can mark their own attempt as `COMPLETED` with `score: 100`, which then flows into `MasteryService.updateFromAttempt(input.score)` and inflates mastery without a real quiz submission. The Phase 2 audit (`docs/strategy/01-verification-delta.md` §VF-02) flagged the mastery formula; this is the upstream source of that.
- **Security Impact**: Assessment integrity, mastery integrity, leaderboard integrity (gamification can read mastery), and any future certification logic are all compromised.
- **Data Impact**: `QuizAttempt.score`, `QuizAttempt.status`, downstream `TopicMasteryRecord.score`, `StepMasteryRecord.score`.
- **Root Cause**: The DTO is `partialWithoutDefaults(baseQuizAttemptSchema)` over a schema that includes score and status. The route is `PATCH`; master prompt §52 flags this as a "Route Red Flag" ("PATCH score").
- **Required Change**:
  1. Define a `SubmitQuizAttemptDto` that accepts only `{ answers: Record<questionId, answer> }`.
  2. Add `POST /quiz-attempts/:id/submit` route that calls `QuizAttemptsService.submitAttempt`, which uses `QuizEvaluationService` to compute `isCorrect` per answer and `score` per attempt.
  3. Move the existing `update` / `remove` PATCH/DELETE routes behind an `AdminReviewerGuard` (assessment override path, distinct business case).
  4. Remove `score`, `status`, `attemptNumber` from the public update DTO entirely.
- **Test Required**:
  - `PATCH /quiz-attempts/:id { "score": 100 }` returns `400` with `VALIDATION_ERROR`.
  - `POST /quiz-attempts/:id/submit { "answers": {...} }` produces `isCorrect` on each answer and `score` on the attempt, persisted by the server.
  - `MasteryService.updateFromAttempt` is called exactly once with the server-computed score.
- **Status**: `OPEN`

## F-02 CRITICAL — Client-writable `isCorrect` and `pointsEarned` on answers

- **Severity**: CRITICAL
- **Category**: Data integrity, assessment integrity
- **Business Flow**: BF-009, BF-001
- **Route**: `POST /answers` and `PATCH /answers/:id`
- **Source**: `services/api/src/v1/quiz/answers/answers.controller.ts:13-39`; DTO `services/api/src/v1/quiz/answers/answers.dto.ts:6-12`
- **Current Behavior**: `baseAnswerSchema` includes `isCorrect: z.boolean()` and `pointsEarned: z.number().int().min(0).default(0)`. The create and update DTOs both inherit these. `AnswersService.create` writes the values supplied by the client without evaluating them.
- **Expected Behavior**: `isCorrect` and `pointsEarned` are server-computed during evaluation. The create DTO accepts only `{ attemptId, questionId, userAnswer }`. The server answers via the new `POST /quiz-attempts/:id/submit` route (F-01 fix).
- **Business Impact**: Same as F-01; an attacker can submit a perfect-score answer without taking the quiz.
- **Security Impact**: Identical to F-01.
- **Data Impact**: `Answer.isCorrect`, `Answer.pointsEarned`, downstream `QuizAttempt.score`, `TopicMasteryRecord.score`.
- **Root Cause**: Same DTO-includes-derived-state pattern as F-01.
- **Required Change**: Same as F-01; replace DTOs; route through the new submit endpoint.
- **Test Required**: `POST /answers { "isCorrect": true, "pointsEarned": 5 }` returns `400`.
- **Status**: `OPEN`

## F-03 HIGH — `ai-credits.service.ts:reserve` is not atomic under concurrency

- **Severity**: HIGH
- **Category**: Concurrency, money integrity
- **Business Flow**: BF-004
- **Source**: `services/api/src/v1/ai-credits/ai-credits.service.ts:55-77`
- **Current Behavior**: `reserve` does `findUnique(wallet)` → compute `available = balance - reserved` → `update(wallet, reserved: increment)` → `create(ledger entry)`. The two writes are inside `prisma.$transaction` but there is **no `SELECT ... FOR UPDATE` / `pg_advisory_xact_lock` on the wallet row**. Two concurrent reservations of `amount = available / 2` each can both pass the `available < amount` check before either increment lands. The wallet ends with `reserved > balance`. `getBalance` reads `available = balance - reserved`; the now-negative `available` is exposed to the client.
- **Expected Behavior**: Acquire a row lock on the wallet before computing `available`:
  ```ts
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`aicredit-wallet:${userId}`}, 0))`;
  ```
  Or set `AICreditWallet.version Int @default(0)` and use `updateMany({ where: { userId, version: currentVersion }, data: { version: { increment: 1 }, reserved: { increment: amount } } })`; assert `count === 1`.
- **Business Impact**: An over-reserved wallet silently enables credit-spend beyond `available` until a `release` or `settle` corrects it. The `getBalance` API will return negative `available` to the client; downstream credit-spend decisions based on that value are wrong.
- **Security Impact**: Credit-balance integrity; foundation for credit-spending decisions.
- **Data Impact**: `AICreditWallet.reserved`, `AICreditLedgerEntry.amount` and the implied `available`.
- **Root Cause**: Read-modify-write pattern without row lock. Compare to `orders.service.ts:57` which already uses `pg_advisory_xact_lock` for the same pattern — the orders code is correct; the credits code was not copied.
- **Required Change**: Add `pg_advisory_xact_lock` at the top of the `reserve` transaction. Add a concurrency test that fires N concurrent reserves and asserts `reserved` increased by exactly `min(N, floor(balance/amount)) * amount` and the ledger has no duplicates.
- **Test Required**:
  - `Promise.all([reserve(amount), reserve(amount), reserve(amount)])` against a wallet with `available = amount * 2` produces exactly two successful reservations and one `INSUFFICIENT_AI_CREDITS` rejection; the wallet's `reserved` ends at `amount * 2`; the ledger has exactly two `SPEND` rows in `HELD` state.
- **Status**: `OPEN`

## F-04 MEDIUM — Sandbox does not persist attempts

- **Severity**: MEDIUM
- **Category**: Business completion
- **Business Flow**: BF-019
- **Source**: `services/api/src/v1/sandbox/sandbox.controller.ts`
- **Current Behavior**: `GET /scenarios` and `POST /journal/validate` are wired. The validation returns `isBalanced` synchronously but does not create a `SandboxAttempt` row, so a learner cannot resume a scenario, cannot track which events they have completed, and there is no record to grade for partial credit.
- **Expected Behavior**: `POST /sandbox/attempts` creates an attempt; `POST /sandbox/attempts/:id/entries` saves draft lines; `POST /sandbox/attempts/:id/entries/:entryId/post` runs `AccountingSandboxService.post` inside a transaction that persists the entry and updates `SandboxAttempt`. `GET /sandbox/attempts/:id` returns the attempt with its lines.
- **Business Impact**: Without attempt persistence, the sandbox cannot be the basis of mastery updates, reward issuance, or progress dashboards. The Phase 1 audit gap G-P-01 in `01-verification-delta.md` flagged the missing route.
- **Required Change**: Add a `SandboxAttemptRepo`, register it in the sandbox module, add the three routes. Add a `SandboxAttemptPosted` event.
- **Test Required**: `POST /sandbox/attempts/{id}/entries/{id}/post` creates a `SandboxAttempt` row with the lines and a `SandboxTransaction` row, both inside one transaction.
- **Status**: `OPEN`

## F-05 MEDIUM — SSE controllers do not enforce ownership

- **Severity**: MEDIUM
- **Category**: Security, privacy
- **Source**: `services/api/src/v1/sse/**` (8 controllers)
- **Current Behavior**: All SSE controllers use `@JwtAuthGuard` (verified in `api-route-catalog.md` §5). None use `@RequireOwnership` or `@RequireParentOwnership`. The `ChatMessagesSseController` and `UserStepsSseController` stream per-user events, but the guard chain does not verify that the JWT subject owns the event source.
- **Expected Behavior**: SSE handlers that stream per-user events should derive the event source from the authenticated subject (the request JWT) and not accept a `userId` from query strings. The fix is a `requireUserFromReq` helper and removal of any `userId` query parameter.
- **Required Change**:
  1. Audit each SSE controller's `@SubscribeMessage` / `stream` handler; remove `userId` from `@Query`.
  2. Add a guard that asserts the SSE channel's identity is the JWT subject.
- **Test Required**: Two-user test: user A subscribes to `/chat-message-sse`; user B posts a chat message; A does not receive B's event.
- **Status**: `OPEN`

## F-06 MEDIUM — `Idempotency-Key` not enforced on `POST /orders`

- **Severity**: MEDIUM
- **Category**: Idempotency, commerce
- **Source**: `services/api/src/v1/orders/orders.controller.ts:19-27`
- **Current Behavior**: The controller's `POST` does not require an `Idempotency-Key` header. `IdempotencyService.execute` exists in `common/idempotency/` but is not wired into the orders service.
- **Expected Behavior**: A client that retries a `POST /orders` with the same `Idempotency-Key` and same body gets the same response without re-running the business mutation. With a different body, the server returns `IDEMPOTENCY_CONFLICT`.
- **Required Change**: Inject `IdempotencyService` into `OrdersService.create`; the service wraps the transaction with `idempotency.execute(ctx, () => prisma.$transaction(...))`. Same for `RefundsService.request`, `PayoutsService.request`, `CreditPackageService.purchase`. The `IdempotencyKey` is required by the standard; if a caller does not provide one, the service generates a UUID and uses it as the dedupe key.
- **Test Required**: `POST /orders` twice with the same key + body returns the same order id; same key + different body returns `400 IDEMPOTENCY_CONFLICT`.
- **Status**: `OPEN`

## F-07 MEDIUM — Paid lessons readable by any signed-in user

- **Severity**: MEDIUM
- **Category**: Authorization, revenue protection
- **Source**: `services/api/src/v1/curriculum/lessons/lessons.controller.ts:25-30`; `services/api/src/v1/curriculum/steps/steps.controller.ts`
- **Current Behavior**: `@AuthenticatedOnly()`. No entitlement check. Any signed-in user can read the body of a paid lesson.
- **Expected Behavior**: A `LessonGuard` checks `Lesson.requiresEntitlement` and the caller's `Entitlement` (or legacy `UserTopic` for topics). A free lesson (no entitlement) is public. A paid lesson returns `403 ENTITLEMENT_REQUIRED`. Same for `Step`.
- **Required Change**: Add `LessonGuard` and `StepGuard`; replace `@AuthenticatedOnly()` on the read routes. Keep the existing entitlement service.
- **Test Required**: `GET /lessons/<paid-lesson>` with a non-buyer JWT returns `403 ENTITLEMENT_REQUIRED`. With a buyer JWT, returns the lesson.
- **Status**: `OPEN`

## F-08 HIGH — `QuizAttemptsService.submitAttempt` exists but no route calls it

- **Severity**: HIGH
- **Category**: Business completion
- **Source**: `services/api/src/v1/quiz/quiz-attempts/quiz-attempts.service.ts:34-60`; the controller has only `POST` (create) and `PATCH` (update).
- **Current Behavior**: The service can compute mastery, fire the `QUIZ_SUBMITTED` event, and return the updated mastery. The only consumer is a unit spec. There is no `POST /quiz-attempts/:id/submit` route. The Phase 1 audit G-P-01 in `01-verification-delta.md` flagged this gap.
- **Expected Behavior**: A `POST /quiz-attempts/:id/submit { answers: Record<questionId, answer> }` route is the only legitimate path. It calls `QuizEvaluationService` to compute `isCorrect` per `Answer` row and `score` per `QuizAttempt`, persists via `quiz-attempts.service.ts.submitAttempt`, and emits `QUIZ_SUBMITTED`. The legacy `create` POST stays as a draft-create path.
- **Required Change**: Add the route, remove the `score`/`status` fields from `CreateQuizAttemptDto` (a draft attempt has no score), wire the existing service method.
- **Test Required**: `POST /quiz-attempts/<id>/submit` returns 200 with the attempt; `Answer.isCorrect` and `QuizAttempt.score` are server-set; `MasteryService.updateFromAttempt` is called exactly once.
- **Status**: `OPEN`

## F-09 MEDIUM — `MisconceptionService` is never called

- **Severity**: MEDIUM
- **Category**: Business completion
- **Source**: `services/api/src/v1/quiz/quiz-attempts/quiz-attempts.service.ts:13-21`
- **Current Behavior**: `@Optional() private readonly misconception?: MisconceptionService` is injected but never called. The Phase 2 spec for `MisconceptionService.recordFromAnswer` exists and is green; nothing wires it.
- **Expected Behavior**: The new `POST /quiz-attempts/:id/submit` route (F-08) calls `misconception.recordFromAnswer(...)` for every wrong answer before persisting the attempt.
- **Required Change**: After F-08, add the call.
- **Test Required**: A wrong answer produces a `MisconceptionPattern` row with the right `patternCode`.
- **Status**: `OPEN`

## F-10 MEDIUM — `releaseDue` has no caller, no scheduler

- **Severity**: MEDIUM
- **Category**: Business completion, money integrity
- **Source**: `services/api/src/v1/payouts/withdrawals/withdrawals.service.ts` (`releaseDue`, `releasePayout`)
- **Current Behavior**: `ReleaseEarning` matured-on-fulfilment path; `releaseDue` would sweep held payouts. Neither has a BullMQ repeatable schedule. `releaseDue` is exported but never called.
- **Expected Behavior**: A BullMQ repeatable schedule at `0 2 * * * Asia/Jakarta` (already present for snapshots) calls `releaseDue`. Payouts whose `HoldWindow.releaseAt` is in the past and have no open refund are released.
- **Required Change**: Register a `payout-release` processor in `queue/queues/`; bind to a `@nestjs/schedule` cron or a BullMQ repeatable.
- **Test Required**: A held payout past its `releaseAt` is released after the next schedule tick.
- **Status**: `OPEN`

## F-11 LOW — Authoring routes accept any `TEACHER` regardless of tenant ownership

- **Severity**: LOW
- **Category**: Authorization
- **Source**: `services/api/src/v1/articles/articles.controller.ts`, `services/api/src/v1/classes/classes.controller.ts`
- **Current Behavior**: `@Roles(Role.ADMIN, Role.TEACHER)` on authoring. Teacher A can edit teacher B's articles if both have the global role.
- **Expected Behavior**: Authoring routes also require `tenantId` on the resource matching one of the caller's tenant memberships, or `createdBy = caller.id`. (Already implemented for `moderation/queue`; not for the author routes.)
- **Required Change**: Add a `RequireAuthor` decorator that checks either tenant membership or ownership.
- **Test Required**: Teacher A in tenant 1 cannot PATCH teacher B's article in tenant 2.
- **Status**: `OPEN`

## F-12 LOW — Webhook contract for payments is a stub

- **Severity**: LOW
- **Category**: Boundary integrity
- **Source**: `services/api/src/v1/payments/payment-webhook.controller.ts:6-16`
- **Current Behavior**: `POST /webhooks/payments/:provider` returns `501` for all providers. No signature verification, no replay protection, no `dedupeKey` lookup. This is the architecture per `docs/architecture/PAYMENT_ARCHITECTURE.md` (webhook reserved until a provider exists).
- **Required Change**: When a provider is added, the webhook must (a) verify provider signature, (b) check `dedupeKey`, (c) call `PaymentService.markVerified` with `actor.kind = 'PROVIDER'`.
- **Test Required**: A forged webhook body returns `401`. A replay of a real one returns the stored result. A new event triggers fulfillment exactly once.
- **Status**: `OPEN` (deferred to provider integration)

## F-13 LOW — `IaCreditService` not migrated to `/internal` calls from `ai-api`

- **Severity**: LOW
- **Category**: Cross-service boundary
- **Source**: `services/ai-api/v1/learning/service.py` and related (per `docs/decisions/ADR-007`)
- **Current Behavior**: `ai-api` does not yet call `POST /v1/internal/credits/reservations`; tutor calls forward the user bearer token. The internal contract exists (`InternalServiceGuard` + `internal-signature.ts`).
- **Required Change**: Migrate the 4 routes in `services/api/src/v1/internal/` plus new `/internal/credits/reservations` routes. Update `ai-api` to call signed.
- **Test Required**: An unsigned call returns `401`. A signed reservation works without forwarding the user token.
- **Status**: `OPEN` (deferred to the AI-side migration)

## F-14 LOW — `If-Match` optimistic concurrency not implemented

- **Severity**: LOW
- **Category**: Concurrency, UX
- **Source**: Authoring controllers (`articles`, `classes`)
- **Current Behavior**: Authoring controllers do not require `If-Match`; lost-update race is possible.
- **Required Change**: Add `ArticleVersion` (already exists) as the ETag source; require `If-Match` on PATCH; return `412 VERSION_CONFLICT` on mismatch.
- **Test Required**: Two simultaneous PATCH with the same ETag: one succeeds, one returns `412`.
- **Status**: `OPEN`

## F-15 LOW — `Mean mastery gain on linked sub-topics` is not implemented (BF-011)

- **Severity**: LOW
- **Category**: Analytics
- **Source**: `services/api/src/v1/creator-analytics/`
- **Current Behavior**: Sales and earnings aggregates exist. Mean mastery gain requires `SubTopicMasteryRecord` snapshots that compare pre vs post enrollment.
- **Required Change**: Add a `creatorOutcomeSnapshot` rollup job that computes mean mastery gain per product per month.
- **Status**: `NOT_IMPLEMENTED` (deferred to V3)

# 4. Imperative gaps the API cannot close

| ID | Statement | Source |
|---|---|---|
| G-1 | The current `docs/architecture/AUTHORIZATION_MATRIX.md` is stale (195 routes vs 310 actual). | `api-route-catalog.md` §6 |
| G-2 | No public route catalog. The ratchet test enforces coverage but does not print it. | `api-route-catalog.md` §6 |
| G-3 | No integration between Swagger and the catalog. | `api-route-catalog.md` §6 |
| G-4 | SSE controllers do not enforce ownership or even derive the channel identity from the JWT. | F-05 |
| G-5 | The 9 client-writable PATCH routes in `quiz/` accept derived state. | F-01, F-02 |
| G-6 | Webhook contract is a stub. | F-12 |

# 5. Cross-references

- Route catalog: [`api-route-catalog.md`](./api-route-catalog.md)
- State machines: [`api-state-machine-audit.md`](./api-state-machine-audit.md)
- Security: [`api-security-audit.md`](./api-security-audit.md)
- Concurrency: [`api-concurrency-audit.md`](./api-concurrency-audit.md)
- Idempotency: [`api-idempotency-audit.md`](./api-idempotency-audit.md)
- Standards: [`api-standards-compliance.md`](./api-standards-compliance.md)
- Tests: [`api-test-gap.md`](./api-test-gap.md)
