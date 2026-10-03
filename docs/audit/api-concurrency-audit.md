> **Status**: `stable` · **Owner**: `architect` · **Last reviewed**: `2026-10-03`
>
> Concurrency audit of the Application API against master-prompt §44 (concurrency standard) and §74 (required concurrency tests). The route catalog is in [`api-route-catalog.md`](./api-route-catalog.md); this document focuses on read-modify-write hazards, locking, and the integration tests that exercise them.

# 1. Locking inventory

| Aggregate | Lock mechanism | Where | Evidence |
|---|---|---|---|
| Order | `pg_advisory_xact_lock` keyed on `order-create:<userId>` | `orders.service.ts:57` | orders |
| Payment intent | `paymentService.lockIntent(orderId)` (advisory lock) | `payment.service.ts` | payments |
| Manual payment proof | `PaymentService.cancelForOrder(orderId)` with order row lock | `payment.service.ts` | payments |
| Refund | `refunds.service.ts:request` (advisory) | refunds | refunds |
| Payout | `lifecycle.lock(tx, payoutId)` | payouts | payouts |
| Payout review/approve | `lifecycle.transition(tx, payoutId, ...)` row-locked update | payouts | payouts |
| Order cancel | `lifecycle.lock(tx, orderId)` | `orders.service.ts:193` | orders |
| Sandbox | none | `sandbox.controller.ts` (no DB write in `validate`) | sandbox |
| AI credit reservation | **none** | `ai-credits.service.ts:55-77` | F-03 |
| Gamification streak | no lock; unique constraint on `(userId, date)` | `streaks.repo.ts` | gamify |
| Quiz attempt | none | `quiz-attempts.service.ts` | quiz |
| Content (article, class) | none for read; update goes through PATCH | articles, classes | content |
| Mastery update | none at the row level; the upsert is `prisma.masteryScore.upsert` | `mastery.service.ts` | learner-model |

# 2. Read-modify-write hazards

| # | Hazard | Where | Pattern | Status |
|---|---|---|---|---|
| C-1 | Concurrent payment approval | `payment.service.ts:markVerified` (manually-triggered flow) | guarded by advisory lock on intent; double approval observed by `payment-flow.int.spec.ts` | mitigated (test skips) |
| C-2 | Concurrent refund request | `refunds.service.ts:request` | advisory lock on `orderId` | mitigated |
| C-3 | Concurrent payout approval | `payouts.service.ts:approve` | row lock via `lifecycle.transition` | mitigated |
| C-4 | Concurrent AI credit reservation | `ai-credits.service.ts:reserve` | **none** | open (F-03) |
| C-5 | Concurrent mastery update | `mastery.service.ts:updateFromAttempt` | upsert (last write wins) | open: two simultaneous correct answers can overwrite each other's EMA contribution. Severity LOW because EMA converges. |
| C-6 | Concurrent streak increment | `streaks.repo.ts:incrementOrReset` | unique constraint on `(userId, date)` + `try-catch P2002` | mitigated |
| C-7 | Concurrent badge issuance | `badge-issuance.service.ts:awardIfMissing` | `prisma.userAchievement.create` with P2002 race handled | mitigated |
| C-8 | Concurrent wallet credit | `ai-credits.service.ts:topUp` | `prisma.$transaction` with `increment` | mitigated within a single process; cross-process unsafe (multi-replica) |
| C-9 | Concurrent order creation by the same user | `orders.service.ts:57` | `pg_advisory_xact_lock(order-create:<userId>)` | mitigated |
| C-10 | Concurrent payout release | `withdrawals.service.ts:releaseDue` (no caller) | none | open: held payouts could double-release. Severity LOW because the scheduler is missing. |
| C-11 | Concurrent sandbox attempt | `sandbox.controller.ts` (no DB write yet) | n/a | n/a |
| C-12 | Concurrent sandbox scenario validation | `sandbox.controller.ts` | none (read-only) | n/a |

# 3. Findings

## CONC-01 — `ai-credits.service.ts:reserve` is not atomic

This is the same finding as F-03 in `api-business-logic-audit.md`; restated here for the concurrency lens.

- **Severity**: HIGH
- **Pattern**: SELECT, compute `available = balance - reserved`, then UPDATE — inside `prisma.$transaction` but without a row lock.
- **Race window**: Two concurrent reserves of `amount = floor(available / 2)` each can both pass the `available < amount` check before either increment lands. The wallet's `reserved` field exceeds `balance`. `getBalance` returns negative `available`.
- **Fix**: Acquire `pg_advisory_xact_lock(hashtextextended(${'aicredit-wallet:' || userId}, 0))` at the top of the transaction. Or use an optimistic-version update. Compare to `orders.service.ts:57` which already does the advisory-lock pattern.
- **Test required**: 5 concurrent reserves of `amount = floor(available / 5) + 1`. Expect exactly `floor(available / amount)` successes; the wallet's `reserved` ends at exactly `successes * amount`; the ledger has no duplicate `idempotencyKey`.

## CONC-02 — `commerce-fulfillment.service.ts` runs synchronous consumers inside the publisher's transaction

- **Severity**: MEDIUM
- **Source**: `services/api/src/v1/commerce/commerce-fulfillment.service.ts:34-72`
- **Pattern**: On `PaymentVerified`, the consumer writes order status, entitlement, earning, ledger, in one transaction. Correct (atomicity), but slow.
- **Race window**: The transaction holds row locks on `Order`, `PaymentIntent`, `PaymentTransaction`, `Entitlement`, `ClassEnrollment`, `CreatorEarning`, `LedgerTransaction`. Any concurrent read or write on these rows blocks until the fulfillment finishes. At high volume this is a contention hotspot.
- **Fix**: Outbox for non-critical consumers (notification, analytics); keep order/earning/ledger/entitlement synchronous. The architecture in `domain-event-bus.ts` already supports an outbox-like flow.
- **Test required**: 100 concurrent payment-approval events across 10 different orders complete within the budgeted p95 (target `<500ms`); no transaction is held for longer than the synchronous work.
- **Status**: open (the right fix is non-trivial; current behavior is correct, just slow)

## CONC-03 — `lockIntent` order is order, then intent — keep it

- **Severity**: INFO
- **Source**: `services/api/src/v1/payments/payment.service.ts:lockIntent`
- **Pattern**: `Order` row lock is taken first, then `PaymentIntent`. Reverse order would deadlock against `cancelOrder` which locks in the opposite order.
- **Required test**: kill an admin flow in the middle; restart; ensure no deadlock. The pattern is documented in `PAYMENT_ARCHITECTURE.md` §5.

## CONC-04 — `withdrawals.service.ts:releaseDue` is exported but has no caller

- **Severity**: LOW (becomes MEDIUM if a caller is added without serialization)
- **Source**: `services/api/src/v1/commerce/withdrawals/withdrawals.service.ts`
- **Fix**: When a BullMQ repeatable job is added (F-10), the job must be singleton per shard OR use a Redis lock to prevent two shards from releasing the same payout twice. The architecture's idempotency contract already requires a `dedupeKey` per release.

# 4. Required concurrency tests (master-prompt §74)

| Test | Implemented? | Evidence |
|---|---|---|
| Two simultaneous payment approvals → one effect | yes (skipped without DB) | `payment-flow.int.spec.ts` |
| Two simultaneous quiz submissions → one effect | no (depends on F-08) | F-08 fix |
| Two simultaneous credit reservations | **no** | F-03 fix |
| Two simultaneous payout requests | yes (skipped) | `payouts.int.spec.ts` |
| Two simultaneous refund approvals | yes (skipped) | `refunds.int.spec.ts` |
| Two simultaneous reward calculations | partial (badge issuance is idempotent on `awardIfMissing`) | `badge-issuance.service.spec.ts` |
| Two simultaneous publication requests | no (depends on SM-1 fix) | F-11 fix |

# 5. Locking recommendations

1. **AI credit reservation**: add `pg_advisory_xact_lock` keyed on the user id. The code change is small and the test is well-defined.
2. **Outbox for non-critical event consumers**: keep money and entitlement synchronous, move notification and analytics to a worker. Already supported by the existing `DomainEventBus` design.
3. **Sandbox attempt**: when F-04 lands, the create must be in a transaction with `unique (userId, scenarioId, status IN ACTIVE)` to prevent two open attempts for the same scenario.
4. **Mastery upsert**: optional optimistic version column. Not blocking — the EMA tolerates last-write-wins.

# 6. Cross-references

- Route catalog: [`api-route-catalog.md`](./api-route-catalog.md)
- Business logic: [`api-business-logic-audit.md`](./api-business-logic-audit.md)
- State machines: [`api-state-machine-audit.md`](./api-state-machine-audit.md)
- Security: [`api-security-audit.md`](./api-security-audit.md)
- Idempotency: [`api-idempotency-audit.md`](./api-idempotency-audit.md)
- Standards: [`api-standards-compliance.md`](./api-standards-compliance.md)
- Tests: [`api-test-gap.md`](./api-test-gap.md)
