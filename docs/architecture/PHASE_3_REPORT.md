# Phase 3 report: provider-agnostic payment, manual provider first

> Date: 2026-09-30. Scope: `services/api` (payments, orders, commerce, entitlements, events), migrations, compose and env templates, docs.
> Phase 2 (article and class services) was not started; orders can already sell articles and classes, but the tests create them with SQL.
> `AGENTS.md` was not modified. Nothing was staged or committed by me.
> Related: [PAYMENT_ARCHITECTURE](./PAYMENT_ARCHITECTURE.md), [ADR-008](../decisions/ADR-008-payment-provider-abstraction.md), [AUTHORIZATION_MATRIX](./AUTHORIZATION_MATRIX.md), [PHASE_1_REPORT](./PHASE_1_REPORT.md).

## 1. Result against the requirements

| Requirement | Status | Evidence |
|---|---|---|
| `PaymentIntent` (provider, providerPaymentId, amount, currency, status, expiresAt, metadata) | Done | Table, migration `20260930090100_payment_domain`, `PaymentService` |
| `PaymentTransaction` (types, references, raw reference) | Done, V1 writes `CAPTURE` | Append-only, one successful capture per payment |
| Provider interface with capabilities | Done | `PaymentProviderAdapter`; manual adapter implements all six operations |
| `ManualPaymentProvider` active, gateway providers possible | Done | Registry resolves by config and by the payment's own provider; fake `MIDTRANS` adapter test |
| Order is provider-agnostic | Done | No provider branch in `orders/`; `OrdersService` calls `PaymentService` only |
| Payment state machine independent of provider | Done | 10 states, table-driven; all 100 status pairs are asserted (19 allowed, 81 refused) |
| Order state machine at domain level | Done | `FULFILLED`, `REFUND_PENDING` added; payment sub-state removed from the flow |
| `PaymentVerified` drives entitlement, earning and ledger | Done | `CommerceFulfillmentService` subscribes to the event, not to manual approval |
| Manual flow: instructions, proof, queue, approve, reject | Done | Endpoints in section 4; 51 HTTP checks |
| Audit, idempotency, concurrency safety | Done | Row locks, dedupe keys, unique indexes; 8 and 10 concurrent approvals produce one effect |
| Canonical events | Partly | Payment events emitted and persisted; `RefundRequested/Approved/Completed` defined, not emitted |
| Refund architecture | Designed, not built | Adapter method, states and events exist; flow is next phase |
| Webhook architecture reserved, no fake behavior | Done | `POST /webhooks/payments/:provider` returns `501` |
| Reconciliation: admin-driven for manual | Done | `POST /admin/payments/intents/:id/reconcile` reports discrepancies and is audited; it does not auto-repair |
| Payment acceptance test | Passes | `payment-flow.int.spec.ts` and E2E |
| Future gateway acceptance test | Passes | Same file, fake gateway adapter, no change to order, entitlement, earning or ledger code |

Acceptance test, as the requirement states it: create order, `PaymentIntent(MANUAL)`, submit proof, admin approve → intent `PAID`, `PaymentVerified` published once, order `FULFILLED`, entitlement `ACTIVE`, one creator earning (90,000 of 100,000 at 10%), three ledger entries. Repeating the approval, or sending it 8 to 10 times at once, adds nothing.

## 2. Changes

**Payments** (`src/v1/payments/`): `payment.types.ts` (adapter contract), `payment-state.ts`, `payment-events.ts`, `payment.config.ts`, `payment-provider.registry.ts`, `payment.service.ts`, `payments.controller.ts`, `admin-payments.controller.ts`, `payment-webhook.controller.ts`, `providers/manual/*` (provider, service, DTOs, account config).

**Events** (`src/common/events/`): `DomainEventBus` and `EventsModule`. Events are persisted in `DomainEvent` and their consumers run in the publisher's transaction.

**Orders** (`src/v1/orders/`): rewritten service, controller, DTO, repo; new `order-lifecycle.service.ts` (locked transitions, reacts to payment failure, expiry and cancellation) and `order-catalog.service.ts` (prices topics, articles, classes from the database). Removed `orders.webhook.controller.ts`.

**Commerce** (`src/v1/commerce/`): `commerce-fulfillment.service.ts`, `creator-earnings.service.ts`, `commerce-ledger.service.ts`, `commerce.config.ts` (fee), `money.ts` (`Decimal`, half-up rounding). `entitlements/entitlements.service.ts` grants topic, article and class access.

**Ownership**: new resource type `payment-intent` in `ownership.registry.ts`. `UploadsModule` now exports `UploadsService` so proofs can be checked against the caller's own uploads.

**Config**: `PAYMENT_PROVIDER`, `PAYMENT_INTENT_TTL_MINUTES`, `PLATFORM_FEE_PERCENT`, `MANUAL_PAYMENT_MAX_SUBMISSIONS`, `MANUAL_PAYMENT_ACCOUNTS` in `.env.example` and both compose files.

**Tests and tooling**: `src/test-utils/commerce-harness.ts` (real services on a real database), product fixtures in `pg-fixtures.ts`.

## 3. Migrations

| Migration | Content |
|---|---|
| `20260930090000_order_status_fulfillment` | `OrderStatus` gains `FULFILLED`, `REFUND_PENDING`. Separate file because PostgreSQL cannot use a new enum value in the transaction that adds it |
| `20260930090100_payment_domain` | Enums, `PaymentIntent`, `PaymentTransaction`, `DomainEvent`, `OrderItem.platformFee`, `ManualPaymentSubmission.paymentIntentId` (required), the hand-written constraints, indexes and triggers listed in the architecture document. Begins with a guard that stops the migration if `ManualPaymentSubmission` already has rows, because nothing ever wrote to it before this phase |

Also in the second migration: `DROP INDEX "Order_userId_topicId_status_key"`. That legacy unique index allowed only one `CANCELLED` (or `FAILED`, `EXPIRED`) order per user and topic, so a second cancellation would have failed with a unique violation. Duplicate open orders are now prevented by a per-user advisory lock and a lookup inside the order-creation transaction.

Verified: 11 migrations on an empty database, `prisma migrate diff` empty. On the legacy-state database (baselined at the 5 original migrations, seeded with users, topics, orders in every state) the two new migrations apply, the 6 orders keep the same id, status and amount (same checksum before and after), no drift. Legacy `PAID` orders stay `PAID`.

## 4. API changes

Removed: `PATCH`/`DELETE /orders/:id`, `POST /orders/:id/approve-payment`, `reject-payment`, `refund`, `POST /webhooks/stripe`. Added: see the table in [PAYMENT_ARCHITECTURE](./PAYMENT_ARCHITECTURE.md#6-http-surface). The authorization matrix now lists 195 routes; the ratchet test still fails any route without an explicit decision.

Behavior changes an existing client can notice:

| Change | Impact |
|---|---|
| New orders are priced in IDR from the database. The old code converted to USD cents for Stripe and set `currency: 'usd'` | The web order page shows `Rp{amount}` and now receives the real rupiah amount |
| `Order.gateway` is no longer written | The web order page shows `-` for gateway. The provider is in `order.payment.provider` |
| A free topic order is created as `FULFILLED` (it was `PAID`) | Status label only |
| `POST /orders` accepts `{ items: [...] }` or the legacy `{ topicId }`; extra client fields are ignored | The existing web page keeps working for topics |

## 5. Findings during this phase

| Finding | Action |
|---|---|
| Zod 4 `z.string().url()` accepts `javascript:` and `data:` URLs, so the proof DTO let them through to the service | DTO now requires `https://`; the service re-checks scheme, that the URL contains the file id, and that the file id sits under the caller's own upload prefix. Tests cover `http:`, `javascript:` and `data:` |
| The Phase 1 order-level `approve-payment` coupled approval to the order and skipped earnings and ledger entirely | Replaced by payment review; the fulfilment pipeline writes earning and ledger |
| Legacy unique index on `Order(userId, topicId, status)` would break repeated cancellation | Dropped, see section 3 |
| Direct `refund` shortcut revoked access but left earnings and ledger untouched | Removed until the refund flow exists |
| Phase 1 database-invariant tests inserted submissions without a payment | Fixtures updated; all 21 pass |

## 6. Tests

| | Phase 1 end | Now |
|---|---|---|
| Jest suites / tests with database env | 24 / 371 | 30 / 607, all pass |
| Jest without database env | 345 pass, 26 skipped | 554 pass, 53 skipped |
| Payment flow on real PostgreSQL | none | 27 tests |
| HTTP checks against the built app | 37 | 51 (payment flow) |
| `tsc --noEmit` | 4 errors, all in `prisma/seed.ts` | same 4, none elsewhere |

What the payment tests cover: order creation and pricing from the database; duplicate and concurrent creation; already-owned and free-product refusals; the full acceptance path; repeated and concurrent approval; concurrent approve versus reject; rollback of the entire approval when a downstream step fails; proof validation; resubmission, final rejection and attempt exhaustion; cancellation (refused while under review); expiry sweep and lazy expiry; topic, class and multi-tenant orders with a balanced ledger; reconciliation including a tampered order; the database triggers and indexes; the fake gateway; provider switch and unavailable provider. HTTP contract tests cover authentication, role and ownership on every new route, DTO strictness and the removed routes.

Mutation check: removing the row locks makes both concurrency tests fail, so they do detect the defect they claim to.

Not run this phase: the Python test suite (no change in `services/ai-api`), the web UI, and the Docker stack (only `docker compose config` for dev and prod, both valid).

## 7. Known gaps

| Gap | Note |
|---|---|
| No web UI for checkout, proof upload or the admin queue | Backend only. The existing order page still renders |
| Refund, wallet credit, earning maturity, payout | Earnings stay `PENDING` and the ledger has no `WALLET_CREDIT` yet. Needs a holding-period and refund-window decision |
| Expiry sweep has no scheduler | Admin endpoint plus lazy expiry on proof submission. A rejected proof can return to `PENDING` after the window closed, and the buyer then cannot resubmit |
| Proof authenticity | The URL is client supplied and constrained, not fetched. The API does not confirm with Cloudinary that the file exists or is an image, and the admin compares amount and reference by eye |
| Consumers are synchronous | Correct and simple; a slow consumer lengthens the approval transaction |
| Reconciliation is report only | No auto-repair |
| A payment verified late for a dead order fails with `409` | Cannot happen in V1 (submitted payments are not expired, cancellation is refused while under review). A gateway will need an explicit policy |
| `ClassEnrollment` rows and class capacity are not handled on purchase | Belongs to the class service. The entitlement grants access |
| `Topic.isVerified` is not checked when ordering | Same as before this phase |
| `STRIPE_*` variables remain in `.env.example` and compose | Unused by the code now |
| Integration tests commit rows | Append-only tables cannot be cleaned, so use a disposable database |

## 8. Owner actions

1. Add to the root `.env`: `MANUAL_PAYMENT_ACCOUNTS` (JSON, real bank details), and optionally `PAYMENT_PROVIDER`, `PAYMENT_INTENT_TTL_MINUTES`, `PLATFORM_FEE_PERCENT`, `MANUAL_PAYMENT_MAX_SUBMISSIONS`. Without accounts, creating a paid order answers `503`.
2. Confirm the platform fee (default 10%) and the payment window (default 24 h).
3. Apply the two new migrations after baselining, as described in section 5 of the Phase 1 report.
4. Scratch databases in the local container: `reducera_phase3_clean` (all migrations, contains test rows), `reducera_phase1_legacy` (migrated to head), `reducera_phase1_clean` (holds a failed migration record from the guard firing on leftover test rows; safe to drop). Drop them when done.
5. Stage and commit the remaining files: `.env.example`, both compose files, `AUTHORIZATION_MATRIX.md`, `CLAUDE.md`, `CURRENT_STATE.md`, `PHASE_1_REPORT.md`, and the three new documents. The code of this phase is already in commit `edb5f42`.

## 9. Recommended next phase

The value chain is now complete in the middle (buy, verify, fulfil, earn) but has no start and no end: creators cannot yet publish an article or class, and earnings cannot yet be paid out.

1. **Article and class services (Phase 2).** Tenant-scoped create, versioning, publish flow, entitlement-gated reads, marketplace listing. Orders and payments already accept them.
2. **Web checkout and admin queue.** Payment method choice, instructions, proof upload, status page; admin queue with proof preview and approve or reject. All endpoints exist.
3. **Refund, wallet and payout (Phase 4).** `RefundRequested → Approved → Completed` with earning and ledger reversal and entitlement revoke; earning `PENDING → AVAILABLE` after a holding period into `Wallet`; payout requests with admin review. Decisions needed first: holding period, refund window, whether partial refunds exist.
4. **Scheduler.** BullMQ repeatable job for the expiry sweep and earning maturity.
