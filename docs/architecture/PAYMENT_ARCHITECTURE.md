# Payment architecture

> Manual payment is the V1 implementation. The provider abstraction is the architecture. Order, entitlement, creator earning and ledger never see a bank account, a proof image or a gateway payload.

## 1. Layers and who may know what

```
POST /orders ──► OrdersService ──► PaymentService ──► PaymentProviderRegistry ──► ManualPaymentProvider   (V1)
                                          │                                    └► <future gateway adapter>
                                          │ PaymentVerified (same transaction)
                                          ▼
                              CommerceFulfillmentService
                       order PAID → entitlement → creator earning → ledger → order FULFILLED
```

| Layer | Owns | Must not know |
|---|---|---|
| `orders/` | Order, OrderItem, order state machine, pricing snapshot | Which provider is active, proofs, bank accounts |
| `payments/` (generic) | `PaymentIntent`, `PaymentTransaction`, payment state machine, provider registry, domain events, reconciliation report | Manual review, proof files |
| `payments/providers/manual/` | `ManualPaymentSubmission`, admin review, instructions, proof validation | Orders, entitlements, earnings |
| `commerce/` | Fulfilment pipeline, creator earning, commerce ledger, fee policy | Payment provider internals |
| `entitlements/` | The one access authority | How the payment was made |

The rule that keeps this true: `orders/` and `commerce/` import `payment-events.ts` (constants and payload types) and `PaymentService`, and nothing from `providers/`.

## 2. Data model

| Table | Purpose | Notes |
|---|---|---|
| `Order`, `OrderItem` | Commercial lifecycle and price snapshot | `OrderItem.platformFee` is fixed when the order is created, so a later fee change never rewrites history |
| `PaymentIntent` | One payment attempt for an order | `provider`, `providerPaymentId` (nullable, unique per provider), `amount`, `currency`, `status`, `expiresAt`, `metadata`, `paidAt` |
| `PaymentTransaction` | Money movements | Types `AUTHORIZATION, CAPTURE, SETTLEMENT, REFUND, REVERSAL, ADJUSTMENT`. V1 writes one `CAPTURE` per verified payment. Append-only |
| `ManualPaymentSubmission` | A buyer's proof and the admin decision (manual provider only) | Linked to the intent. Reviewed rows are immutable |
| `DomainEvent` | Durable, append-only record of every published event | `dedupeKey` unique: publishing the same event twice is a no-op |
| `CreatorEarning`, `LedgerTransaction`, `Entitlement` | Downstream effects | Created only by the fulfilment pipeline |

Guarantees enforced by PostgreSQL, independent of application code (migration `20260930090100_payment_domain`):

| Guarantee | Mechanism |
|---|---|
| At most one live payment per order | Partial unique index on `PaymentIntent(orderId)` for non-terminal states |
| At most one successful capture per payment | Partial unique index on `PaymentTransaction(paymentIntentId)` where `CAPTURE` and `SUCCEEDED` |
| At most one open and one approved proof per payment | Two partial unique indexes on `ManualPaymentSubmission(paymentIntentId)` |
| Payment terms cannot change (`orderId`, `provider`, `amount`, `currency`); terminal payments cannot move; payments cannot be deleted | Trigger `protect_payment_intent` |
| Reviewed proofs and their evidence cannot change or be deleted | Trigger `protect_manual_payment_submission` |
| Transactions and events are append-only | `forbid_row_mutation` trigger |
| `paidAt` is set exactly when the payment is paid, refund pending or refunded | Check constraint |
| Fee never exceeds the line total | Check constraint on `OrderItem` |

## 3. State machines

Payment and order are different questions. Payment: has money been verified? Order: where is this purchase in its commercial life?

**Payment** (`payments/payment-state.ts`)

```
CREATED ─► PENDING ─► SUBMITTED ─► PAID ─► REFUND_PENDING ─► REFUNDED
   │          │  │        │  └────► FAILED       └─► PAID (refund refused)
   │          │  └► PROCESSING ─► PAID / FAILED
   │          └► EXPIRED / CANCELLED / FAILED        SUBMITTED ─► PENDING (proof rejected, may resubmit)
   └► EXPIRED / CANCELLED / FAILED
```

V1 uses `CREATED → PENDING → SUBMITTED → PAID | FAILED` (and back to `PENDING` on a rejected proof). A gateway uses `PENDING → PROCESSING → PAID` or `PENDING → PAID`. The same table serves both; no state is provider-specific.

**Order** (`orders/order-state.ts`)

```
PENDING ─► PAID ─► FULFILLED ─► REFUND_PENDING ─► REFUNDED
   │                    ▲              │
   ├► FAILED / CANCELLED / EXPIRED     └► FULFILLED (refund refused)
```

`PAID` exists only inside the fulfilment transaction. `PAYMENT_SUBMITTED` remains in the enum because PostgreSQL cannot drop enum values, but nothing transitions into it any more: submission is a payment concern, not an order concern. `PENDING` is the pending-payment state; renaming it would break existing rows and the web client for no gain.

## 4. Domain events

Published through `DomainEventBus` inside the same database transaction as the state change, and persisted in `DomainEvent`.

| Event | Emitted when | Consumers today |
|---|---|---|
| `PaymentCreated` | Intent created | none |
| `PaymentSubmitted` | Proof accepted (dedupe key includes the submission id) | none |
| `PaymentVerified` | Payment reached `PAID` | `commerce-fulfillment` |
| `PaymentFailed` | Payment reached `FAILED` | `order-lifecycle` → order `FAILED` |
| `PaymentExpired` | Unpaid payment expired | `order-lifecycle` → order `EXPIRED` |
| `PaymentCancelled` | Payment cancelled | `order-lifecycle` → order `CANCELLED` |
| `RefundRequested`, `RefundApproved`, `RefundCompleted` | Reserved in the catalog, not emitted yet | none |

`PaymentVerified` carries `paymentIntentId, orderId, provider, amount, currency, transactionId, verifiedAt, verifiedBy`. It carries nothing manual-specific, so V1 manual approval and a future gateway settlement produce the same event and the same downstream effects.

Consumers run synchronously inside the publisher's transaction. A consumer failure rolls back the whole approval: a payment can never be `PAID` while its entitlement, earning or ledger entry is missing (proved by `payment-flow.int.spec.ts`). Moving consumers to an asynchronous outbox later changes the bus, not the publishers or the consumers' logic.

## 5. What happens on approval

One transaction, locks taken in a fixed order (Order → PaymentIntent) so approve, reject, cancel and expiry cannot deadlock:

1. Admin `POST /admin/payments/manual/submissions/:id/approve` with a reason.
2. Lock order and payment. A repeated request finds the submission already approved and returns `changed: false`.
3. Manual submission → `APPROVED`. `PaymentService.markVerified` writes the `CAPTURE` transaction, moves the payment to `PAID`, publishes `PaymentVerified`.
4. Fulfilment: order `PENDING → PAID`; entitlements for every item (topic also keeps the legacy `UserTopic` row); one `CreatorEarning` per tenant item (`PENDING`); ledger entries `ORDER_PAYMENT`, and per earning `PLATFORM_FEE` and `CREATOR_EARNING`; order `PAID → FULFILLED`.
5. Audit entries for the submission, payment and order.

Ledger idempotency keys (`order-payment:<intent>`, `platform-fee:<item>`, `creator-earning:<item>`) and the unique `CreatorEarning.orderItemId` make steps 4 safe even if the event were replayed.

## 6. HTTP surface

| Method | Path | Who |
|---|---|---|
| `POST` | `/orders` | Signed-in user. Body `{ items: [{ type, id }], paymentMethod? }` or legacy `{ topicId }`. Prices always come from the database |
| `GET` | `/orders`, `/orders/:id` | Owner (ADMIN sees all). Detail includes `payment` with provider instructions |
| `POST` | `/orders/:id/cancel` | Owner or ADMIN, only before a proof is under review |
| `GET` | `/payments/methods` | Signed-in user |
| `GET` | `/payments/intents/:id` | Buyer or ADMIN |
| `GET`, `POST` | `/payments/manual/intents/:id/submissions` | Buyer (list, submit proof) |
| `GET` | `/admin/payments/manual/submissions[/:id]` | ADMIN, queue oldest first |
| `POST` | `/admin/payments/manual/submissions/:id/{start-review,approve,reject}` | ADMIN, reason required |
| `POST` | `/admin/payments/intents/:id/reconcile` | ADMIN, report only |
| `POST` | `/admin/payments/expire-due` | ADMIN, sweeps expired unpaid payments |
| `POST` | `/webhooks/payments/:provider` | Reserved. Always `501`, changes nothing |

Removed: `PATCH`/`DELETE /orders/:id`, `POST /orders/:id/approve-payment|reject-payment|refund`, `POST /webhooks/stripe`.

Reject takes `allowResubmit` (default `true`). A rejected proof returns the payment to `PENDING`; a final rejection, or exhausting `MANUAL_PAYMENT_MAX_SUBMISSIONS`, fails the payment and the order.

Payments awaiting review are never expired by the sweep: the buyer has already paid.

## 7. Configuration

| Variable | Default | Meaning |
|---|---|---|
| `PAYMENT_PROVIDER` | `manual` | Provider used for new payments. Existing payments keep resolving through their own provider |
| `PAYMENT_INTENT_TTL_MINUTES` | `1440` | Window to submit a proof (5 to 10080) |
| `PLATFORM_FEE_PERCENT` | `10` | Fee on tenant items, snapshotted per order item. Invalid values fall back to the default with a warning |
| `MANUAL_PAYMENT_MAX_SUBMISSIONS` | `5` | Proof attempts per payment |
| `MANUAL_PAYMENT_ACCOUNTS` | none | JSON array of `{ method, label, accountNumber, accountName }`. Empty or malformed makes the manual provider report `503` instead of showing wrong instructions |

Provider credentials for a future gateway belong in the same root `.env` and never reach the web app. Curriculum topics have no tenant, so a topic sale earns the platform 100% and creates no `CreatorEarning`.

## 8. Adding a gateway (Midtrans, Xendit, Stripe)

Nothing in `orders/`, `commerce/`, `entitlements/` changes.

1. Implement `PaymentProviderAdapter` (`payment.types.ts`): `createPaymentIntent`, `presentPayment`, `getPaymentStatus`, `cancelPayment`, `refundPayment`, `reconcilePayment`, `listMethods`, and declare `capabilities`.
2. Register it in `PaymentsModule` in the `PAYMENT_PROVIDER_ADAPTERS` factory and set `PAYMENT_PROVIDER`.
3. Build the webhook path behind `POST /webhooks/payments/:provider`: verify the provider signature, validate the payload, resolve the intent by `providerPaymentId`, then call `PaymentService.markVerified` or `markFailed` with `actor.kind = 'PROVIDER'`. The event dedupe key and the `providerTransactionId` unique index absorb duplicate deliveries.
4. Add out-of-order and delayed-settlement handling to the adapter's `reconcilePayment`, and a scheduled reconciliation job.

`payment-flow.int.spec.ts` proves steps 1, 2 and the `markVerified` half of step 3 with a fake `MIDTRANS` adapter: create order, gateway intent, webhook-style verification, replay, and the identical fulfilment (entitlement, one earning, three ledger entries).

## 9. Deliberately not built

| Item | Why | Where it lands |
|---|---|---|
| Refund flow (`RefundRequested → Approved → Completed`), earning reversal, entitlement revoke | Not in the V1 must-list. The old direct `refund` endpoint was removed because it revoked access but left earnings and ledger untouched | Next phase, with wallets |
| Wallet credit, earning `PENDING → AVAILABLE`, payouts | Needs a holding period decision | Next phase |
| Scheduler for the expiry sweep | The repo has no scheduler. The sweep is an admin endpoint plus lazy expiry when a buyer submits a proof | Phase with BullMQ repeatable jobs |
| Gateway SDKs, checkout, webhooks, automatic reconciliation | Out of scope for V1 by design | When a gateway is chosen |
| `ClassEnrollment` rows on class purchase | Belongs to the class service. The entitlement is the access authority | Article and class phase |
