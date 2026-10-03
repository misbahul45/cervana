> **Status**: `stable` · **Owner**: `architect` · **Last reviewed**: `2026-10-03`
>
> Inventory and analysis of every business aggregate with a state machine. The Application API has six explicit state-machine modules; this document records the tables, transitions, and the gaps where the machine is incomplete or where a sensitive state is reached via an ad-hoc `PATCH status` call.

# 1. State machines (6)

## 1.1 Order

Source: `services/api/src/v1/orders/order-state.ts` and `schema.prisma:OrderStatus` enum.

| From | Allowed to |
|---|---|
| `PENDING` | `PAID`, `FAILED`, `CANCELLED`, `EXPIRED` |
| `PAYMENT_SUBMITTED` | `PENDING`, `PAID`, `FAILED`, `CANCELLED` |
| `PAID` | `FULFILLED`, `REFUND_PENDING`, `REFUNDED` |
| `FULFILLED` | `REFUND_PENDING`, `REFUNDED` |
| `REFUND_PENDING` | `REFUNDED`, `FULFILLED` |
| `FAILED` | (terminal) |
| `CANCELLED` | (terminal) |
| `EXPIRED` | (terminal) |
| `REFUNDED` | (terminal) |

`ORDER_OPEN_STATES = [PENDING]`. `assertTransition()` throws `409 INVALID_STATE_TRANSITION`.

Where used:
- `orders.service.ts:199` (`cancelOrder`) calls `assertTransition(order.status, OrderStatus.CANCELLED)`.
- `commerce-fulfillment.service.ts:74` (consumer of `PaymentVerified`) flips `PAID → FULFILLED` inside the publisher's transaction.

Gap: `PAYMENT_SUBMITTED` is declared in the enum but is never reached. The manual payment flow keeps the intent in `SUBMITTED`, then admin moves it to `PAID`. There is no codepath that puts an order into `PAYMENT_SUBMITTED`. Severity LOW. Status: `OPEN`.

## 1.2 Payment intent

Source: `services/api/src/v1/payments/payment-state.ts` and `schema.prisma:PaymentIntentStatus` enum.

| From | Allowed to |
|---|---|
| `CREATED` | `PENDING`, `FAILED`, `EXPIRED`, `CANCELLED` |
| `PENDING` | `SUBMITTED`, `PROCESSING`, `PAID`, `FAILED`, `EXPIRED`, `CANCELLED` |
| `SUBMITTED` | `PAID`, `FAILED`, `PENDING` |
| `PROCESSING` | `PAID`, `FAILED`, `PENDING` |
| `PAID` | `REFUND_PENDING` |
| `REFUND_PENDING` | `REFUNDED`, `PAID` |
| `FAILED` | (terminal) |
| `EXPIRED` | (terminal) |
| `CANCELLED` | (terminal) |
| `REFUNDED` | (terminal) |

`PAYMENT_TERMINAL_STATES` is exposed (the codebase has multiple terminal states).

Where used:
- `payment.service.ts` `markVerified` (provider success) → `PAID`.
- `manual-payment.service.ts:approve` → `PAID`, `reject` → `FAILED` or `PENDING` (rejection returns to `PENDING` for resubmit).
- `refunds.service.ts:process` → `REFUND_PENDING → REFUNDED`.
- The architecture states `PAID → REFUND_PENDING` is the only path; the table includes it. Verified by `payment-flow.int.spec.ts` (skipped without DB).

## 1.3 Refund

Source: `services/api/src/v1/refunds/refund-state.ts` and `schema.prisma:RefundStatus` enum.

| From | Allowed to |
|---|---|
| `REQUESTED` | `APPROVED`, `REJECTED` |
| `APPROVED` | `PROCESSED`, `REJECTED` |
| `PROCESSED` | (terminal) |
| `REJECTED` | (terminal) |

`REFUND_OPEN_STATES = [REQUESTED, APPROVED]`. `assertRefundTransition()` throws `409 INVALID_STATE_TRANSITION`.

Where used:
- `refunds.service.ts:request` (within the refund window) → `REQUESTED`.
- `refunds.service.ts:approve` (admin) → `APPROVED`.
- `refunds.service.ts:process` (admin, requires evidence) → `PROCESSED`, also writes earning reversal + entitlement revoke.
- `refunds.service.ts:reject` → `REJECTED`.

`PROCESSED` and `REJECTED` are terminal. `refunds/refund-state.ts:25` matches the architecture doc. Severity: stable.

## 1.4 Payout

Source: `services/api/src/v1/payouts/payout-state.ts` and `schema.prisma:PayoutStatus` enum.

| From | Allowed to |
|---|---|
| `REQUESTED` | `UNDER_REVIEW`, `APPROVED`, `REJECTED`, `CANCELLED` |
| `UNDER_REVIEW` | `APPROVED`, `REJECTED` |
| `APPROVED` | `PAID`, `REJECTED` |
| `PAID` | (terminal) |
| `REJECTED` | (terminal) |
| `CANCELLED` | (terminal) |

`PAYOUT_OPEN_STATES = [REQUESTED, UNDER_REVIEW, APPROVED]`. `assertPayoutTransition()` throws `409 INVALID_STATE_TRANSITION`.

Where used:
- `payouts.service.ts:request` (teacher) → `REQUESTED`.
- `payouts.service.ts:startReview` (admin) → `UNDER_REVIEW`.
- `payouts.service.ts:approve` (admin) → `APPROVED`, with row lock.
- `payouts.service.ts:markPaid` (admin) → `PAID`, requires evidence file owned by the admin.
- `payouts.service.ts:reject` → `REJECTED`, with reversal of the hold ledger entry.
- `payouts.service.ts:cancel` (teacher) → `CANCELLED`.

The hold-and-release rule (`releaseDue` is not called) is F-10 in `api-business-logic-audit.md`. The state machine is correct; the scheduler is missing.

## 1.5 Content (Article / ClassProduct)

Source: `services/api/src/v1/marketplace/content-state.ts` and `schema.prisma:ContentStatus` enum.

| From | Allowed to |
|---|---|
| `DRAFT` | `PENDING_REVIEW`, `ARCHIVED` |
| `PENDING_REVIEW` | `PUBLISHED`, `REJECTED`, `DRAFT` |
| `REJECTED` | `PENDING_REVIEW`, `ARCHIVED` |
| `PUBLISHED` | `SUSPENDED`, `ARCHIVED` |
| `SUSPENDED` | `PUBLISHED`, `ARCHIVED` |
| `ARCHIVED` | (terminal) |

`EDITABLE_CONTENT_STATES = [DRAFT, REJECTED]`. `READABLE_BY_BUYERS = [PUBLISHED, ARCHIVED]`. `assertContentTransition()` and `assertEditable()` throw `409`.

Where used:
- `articles.controller.ts` and `classes.controller.ts` use the content state machine via the `content-state.ts` helpers.
- `marketplace-articles.controller.ts` and `marketplace-classes.controller.ts` filter by `READABLE_BY_BUYERS`.

Gap: this is the only state machine that has both `EDITABLE` and `READABLE` helper predicates. The PATCH routes on articles and classes do not call `assertEditable()` consistently. Severity MEDIUM. See finding SM-2 below.

## 1.6 Theme

Source: `services/api/src/v1/gamify/themes/theme-state.ts` and the `themeProposer` consumer. Note: the `theme` Prisma model uses an `enum String` field, not a Prisma enum (per `schema.prisma:Theme.status`). The state machine in `theme-state.ts` is a pure function over a string union.

| From | Allowed to |
|---|---|
| `DRAFT` | `REVIEW`, `ARCHIVED` |
| `REVIEW` | `DRAFT`, `PUBLISHED`, `ARCHIVED` |
| `PUBLISHED` | `SUSPENDED`, `ARCHIVED` |
| `SUSPENDED` | `PUBLISHED`, `ARCHIVED` |
| `ARCHIVED` | (terminal) |

Where used: `themes.controller.ts:114-157` (intent endpoints: `submitReview`, `publish`, `suspend`, `reinstate`, `archive`).

Gap: the `ARCHIVED` state allows `DRAFT → ARCHIVED` and `REVIEW → ARCHIVED`. There is no `delete` endpoint; `canDelete` exists in `theme-state.ts:55-58` but no controller action wires it. Severity LOW.

# 2. Cross-state-machine invariants

| Invariant | Where enforced | Status |
|---|---|---|
| One live payment intent per order | partial unique index `PaymentIntent_one_live_per_payment` (from `prisma/migrations/20260930090000_payment_domain`) | enforced at DB level |
| One open proof per payment | partial unique index `ManualPaymentSubmission_one_open_per_payment` | enforced at DB level |
| One open refund per payment | partial unique index `Refund_one_open_per_payment` | enforced at DB level |
| One hold window per payout | `@unique` `HoldWindow.payoutId` | enforced at DB level |
| Wallet non-negative | `CHECK (balance >= 0)` and `CHECK (reserved <= balance)` (from migration `20260930100000_financial_hardening`) | enforced at DB level |
| Append-only ledgers | `forbid_row_mutation` trigger on `LedgerTransaction` and `AICreditLedgerEntry` | enforced at DB level |

The DB-level invariants are correctly set up; the application-level state machines cooperate with them.

# 3. Findings

## SM-1 — PATCH routes bypass the state machine for content

- **Severity**: HIGH
- **Source**: `services/api/src/v1/articles/articles.controller.ts`, `services/api/src/v1/classes/classes.controller.ts`
- **Current Behavior**: PATCH routes on articles and classes do not always call `assertContentTransition()` or `assertEditable()`. The intent endpoints (`POST /:id/submit-review`, `POST /:id/publish`) do. A PATCH on a `PUBLISHED` article silently mutates its body without rejecting the operation. The `EDITABLE_CONTENT_STATES` constant is defined but only enforced in some controllers.
- **Expected Behavior**: Every PATCH path on a content resource must call `assertEditable()` (if a body field) and `assertContentTransition()` (if a state field). The architecture says "no generic PATCH status" — that rule is not enforced on content.
- **Required Change**: Wrap every PATCH in the article and class controllers with `assertEditable(currentStatus)`. If the DTO has a `status` field, call `assertContentTransition()`.
- **Test Required**: PATCH `/articles/<published-id>` with any body returns `409 CONTENT_LOCKED`. PATCH `/articles/<rejected-id>` then immediately submit returns `409 INVALID_STATE_TRANSITION`.
- **Status**: `OPEN`

## SM-2 — `PAYMENT_SUBMITTED` is unreachable

- **Severity**: LOW
- **Source**: `schema.prisma:OrderStatus`, `order-state.ts:18-23`
- **Current Behavior**: The enum has `PAYMENT_SUBMITTED` and the transition table permits it. No code path writes that value.
- **Expected Behavior**: Either remove the enum value (PostgreSQL cannot drop enum values, so this requires care) or write the manual payment flow to leave the order in `PENDING` and have the intent in `SUBMITTED` while the proof is under review. The current behaviour is closer to the latter: the order is `PENDING` while the proof is under review, and the order flips to `PAID` on intent approval.
- **Required Change**: Document the intent in `order-state.ts`; the value can stay for future gateway integrations. Severity LOW.
- **Status**: `OPEN` (intentional, document-only)

## SM-3 — `qdrant → SETTLED → RELEASED` for AI credit reservation has no machine

- **Severity**: LOW
- **Source**: `services/api/src/v1/ai-credits/ai-credits.service.ts:65,135,151`
- **Current Behavior**: A reservation is created as a `SPEND` row with metadata `state: 'RESERVED'`. Settle updates the row's metadata to `'SETTLED'` and may create a `'REFUND'` row. Release updates metadata to `'RELEASED'`. There is no state-machine module analogous to the others; the metadata is free-form `Prisma.InputJsonValue`.
- **Expected Behavior**: Add a `Reservation` enum and a `RESERVATION_TRANSITIONS` table to `services/api/src/v1/ai-credits/reservation-state.ts`. The ledger row's `state` becomes a typed field (not JSON metadata).
- **Required Change**: Migration to add `ReservationStatus` enum; backfill from `metadata.state`; reject illegal transitions.
- **Status**: `OPEN`

## SM-4 — `Article` and `ClassProduct` have `status: String` (not enum)

- **Severity**: LOW
- **Source**: `schema.prisma` for `Article.status`, `ClassProduct.status` (both are `String`, not `ContentStatus`)
- **Current Behavior**: The state machine is a TypeScript union in `content-state.ts`, but the column is free-form text. A migration could write any value.
- **Expected Behavior**: Promote the column to a Prisma enum so DB-level enforcement matches the state machine. This is the only major state machine that lacks DB-level enforcement.
- **Required Change**: Migration to add `ContentStatus` enum and ALTER the two columns.
- **Status**: `OPEN`

# 4. Imperative gaps the state machine section exposes

| ID | Statement |
|---|---|
| G-1 | `PAYMENT_SUBMITTED` and `ARCHIVED` states are declared but only `ARCHIVED` is reachable. |
| G-2 | The credit reservation lifecycle is implemented as `metadata` instead of as a typed state machine. |
| G-3 | `Content.status` is `String`, not an enum, so DB-level invariants do not match the TS state machine. |
| G-4 | No PATCH path on a content resource calls `assertEditable()`; a `PUBLISHED` article can be PATCHed silently. |

# 5. Cross-references

- Route catalog: [`api-route-catalog.md`](./api-route-catalog.md)
- Business flows: [`api-business-logic-audit.md`](./api-business-logic-audit.md)
- Security: [`api-security-audit.md`](./api-security-audit.md)
- Concurrency: [`api-concurrency-audit.md`](./api-concurrency-audit.md)
- Idempotency: [`api-idempotency-audit.md`](./api-idempotency-audit.md)
- Tests: [`api-test-gap.md`](./api-test-gap.md)
- Standards: [`api-standards-compliance.md`](./api-standards-compliance.md)
