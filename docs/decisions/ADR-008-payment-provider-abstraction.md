# ADR-008: Provider-agnostic payments, manual provider first

- Status: accepted and implemented (Phase 3)
- Date: 2026-09-30
- Related: [PAYMENT_ARCHITECTURE](../architecture/PAYMENT_ARCHITECTURE.md), [ADR-007](./ADR-007-ai-api-service-boundary.md)

## Context

V1 payment is manual: the buyer transfers money, uploads a proof, an administrator approves. Phase 1 modelled this directly on the order (`approve-payment` moved the order to `PAID` and granted access). That couples the commercial lifecycle to one way of paying. Adding a payment gateway would mean rewriting the order service and everything that reacts to a paid order (entitlement, creator earning, ledger).

## Decision

1. **Separate the payment from the order.** `PaymentIntent` (one attempt to pay an order) and `PaymentTransaction` (money movements) are provider-independent. The order state machine has no payment sub-states.
2. **One interface, many providers.** `PaymentProviderAdapter` (`createPaymentIntent`, `presentPayment`, `getPaymentStatus`, `cancelPayment`, `refundPayment`, `reconcilePayment`, `listMethods`, `capabilities`). `PaymentProviderRegistry` selects the adapter for new payments from `PAYMENT_PROVIDER` and resolves an existing payment through its own `provider`, so switching the configuration never orphans old payments.
3. **Manual review stays inside the manual provider.** `ManualPaymentSubmission`, proof validation and the admin queue live in `payments/providers/manual/`. Nothing outside that directory imports them.
4. **Downstream effects react to `PaymentVerified`,** not to a manual approval. Order, entitlement, creator earning and ledger are driven by one canonical event that a future gateway settlement produces identically.
5. **Events are transactional.** `DomainEventBus` persists each event in `DomainEvent` and runs its consumers inside the publisher's database transaction. A consumer failure rolls the whole payment back. Publishing the same `dedupeKey` twice is a no-op.
6. **The database enforces the invariants** that must never break: one live payment per order, one successful capture per payment, one open and one approved proof per payment, immutable payment terms, immutable reviewed proofs, append-only transactions and events.
7. **Webhooks are reserved, not faked.** `POST /webhooks/payments/:provider` answers `501` and touches nothing until a real provider implements signature verification and reconciliation.

## Alternatives considered

| Option | Why not |
|---|---|
| Keep approval on the order and add `if (provider === ...)` branches | Exactly the coupling this ADR removes |
| Asynchronous outbox from day one | Adds a worker and eventual consistency to a flow where the buyer is waiting on an admin click. A payment marked paid with missing access is worse than a slightly heavier transaction. The bus interface allows moving consumers to an outbox later without touching publishers |
| Rename order `PENDING` to `PENDING_PAYMENT` and add `DRAFT` | Breaks existing rows and the web client. `PENDING` already means pending payment and there is no draft step |
| Remove the unused `PAYMENT_SUBMITTED` order status | PostgreSQL cannot drop an enum value. It stays, unreachable |

## Consequences

- A gateway is one adapter, one registration line and a webhook route; the fulfilment pipeline is untouched (demonstrated by a fake `MIDTRANS` adapter in `payment-flow.int.spec.ts`).
- Approval is heavier: one transaction writes to about ten tables. In the integration tests a full order-to-approval cycle takes 150 to 250 ms, and correctness matters more than latency here.
- Refunds are designed (events, states, adapter method) but not built. The direct `POST /orders/:id/refund` shortcut was removed because it revoked access without reversing earnings or ledger entries.
- The platform fee is snapshotted per order item when the order is created.
- The expiry sweep has no scheduler yet: it is an admin endpoint plus lazy expiry when a buyer submits a proof.
