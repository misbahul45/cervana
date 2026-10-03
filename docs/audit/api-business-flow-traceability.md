> **Status**: `stable` · **Owner**: `architect` · **Last reviewed**: `2026-10-03`
>
> One-page traceability between the 25 business flows in master-prompt §49 and the code in `services/api`. Each row shows: the route, the service method, the state-machine transition (if any), the events emitted, and the audit record. Use this to verify whether a flow is closable from the API alone.

# 1. Reading guide

| Symbol | Meaning |
|---|---|
| Route | the HTTP method + path; `services/api/.../<controller>:<line>` |
| Service | the service method and file:line that performs the business mutation |
| Tx | transaction boundary — `prisma.$transaction` |
| State | transition through the matching state table (e.g. `order-state.ts`) |
| Events | events written to `DomainEvent` |
| Audit | entry written to `AuditLog` via `AuditService.record` |
| Idempotency | `Idempotency-Key` enforced on this route? |
| Status | `IMPLEMENTED`, `IMPLEMENTED_BUT_INSECURE`, `IMPLEMENTED_BUT_UNWIRED`, `SCAFFOLDED`, `NOT_IMPLEMENTED`, `PARTIALLY_IMPLEMENTED` |
| Open | tracking ID in `api-business-logic-audit.md` |

# 2. Flow × route × state × event × audit × status

| Flow | Route | Service | Tx | State | Events | Audit | Idemp. | Status | Open |
|---|---|---|---|---|---|---|---|---|---|
| BF-001 learn (free lesson) | `GET /curriculum/lessons/:id` (`lessons.controller.ts:25`) | `LessonsService.findById` | no | – | – | – | n/a | `IMPLEMENTED` (free) | F-07 |
| BF-001 learn (paid lesson) | `GET /curriculum/lessons/:id` | `LessonsService.findById` | no | – | – | – | n/a | `IMPLEMENTED_BUT_INSECURE` (entitlement not enforced) | F-07 |
| BF-001 start step + chat | `POST /learning/user-steps` (`user-steps.controller.ts:30`) | `UserStepsService.create` | no | – | `TutorAnswered` (queued) | – | no | `IMPLEMENTED` | – |
| BF-001 submit attempt (legacy) | `POST /quiz/quiz-attempts` (`quiz-attempts.controller.ts:14`) | `QuizAttemptsService.create` | no | – | – | – | no | `IMPLEMENTED_BUT_INSECURE` (F-01) | F-01 |
| BF-001 submit attempt (server-evaluated) | `POST /quiz-attempts/:id/submit` | `QuizAttemptsService.submitAttempt` | yes | – | `QUIZ_SUBMITTED` | – | no | `NOT_IMPLEMENTED` (F-08) | F-08 |
| BF-001 mastery update | internal | `MasteryService.updateFromAttempt` | no | – | – | – | no | `IMPLEMENTED_BUT_UNSECURED` (F-01 + F-08) | F-01, F-08 |
| BF-001 misconception record | internal | `MisconceptionService.recordFromAnswer` | yes | – | `MisconceptionDetected` | – | no | `SCAFFOLDED` (no caller) | F-09 |
| BF-001 next activity | `GET /personalization/policy/next` (`adaptive-policy.controller.ts`) | `AdaptivePolicyService.decideNext` | no | – | – | – | n/a | `IMPLEMENTED` | – |
| BF-002 create order | `POST /orders` (`orders.controller.ts:19`) | `OrdersService.create` | yes (advisory lock + tx) | `– → PENDING` (intent `CREATED`) | `PaymentCreated` | `ORDER_CREATED` | no (F-06) | `IMPLEMENTED_BUT_INSECURE` | F-06 |
| BF-002 submit proof | `POST /payments/manual/intents/:id/submissions` (`payments.controller.ts:53`) | `ManualPaymentService.submit` | yes | `– → SUBMITTED` | `PaymentSubmitted` | `MANUAL_PAYMENT_SUBMITTED` | no | `IMPLEMENTED` | – |
| BF-002 admin approve | `POST /admin/payments/manual/submissions/:id/approve` | `ManualPaymentService.approve` | yes (intent + state lock) | `SUBMITTED → PAID` | `PaymentVerified` | `MANUAL_PAYMENT_APPROVED`, `PAYMENT_INTENT_VERIFIED` | no | `IMPLEMENTED` | – |
| BF-002 admin reject | `POST /admin/payments/manual/submissions/:id/reject` | `ManualPaymentService.reject` | yes | `SUBMITTED → PENDING` (resubmit) | `PaymentFailed` | `MANUAL_PAYMENT_REJECTED` | no | `IMPLEMENTED` | – |
| BF-002 fulfillment | (consumer) | `CommerceFulfillmentService` | yes (one tx) | `PENDING → PAID → FULFILLED` | `EntitlementGranted`, `CreatorEarningCreated`, `OrderFulfilled` | `ORDER_FULFILLMENT_COMPLETED` | – | `IMPLEMENTED` | – |
| BF-003 earning created | (consumer) | same as above | yes | – | `CreatorEarningCreated` | – | – | `IMPLEMENTED` | – |
| BF-003 release due | – | `CommerceCreatorEarningsService.releaseDue` (no caller) | yes | `PENDING → AVAILABLE` | `CreatorEarningReleased` | – | – | `NOT_IMPLEMENTED` (F-10) | F-10 |
| BF-003 payout request | `POST /payouts` (`payouts.controller.ts:27`) | `PayoutsService.request` | yes | `– → REQUESTED` | `PayoutRequested` | `PAYOUT_REQUESTED` | no (F-06) | `IMPLEMENTED` | F-06 |
| BF-003 payout approve | `POST /admin/payouts/:id/approve` | `PayoutsService.approve` | yes | `UNDER_REVIEW → APPROVED` | `PayoutApproved` | `PAYOUT_APPROVED` | no (F-06) | `IMPLEMENTED` | F-06 |
| BF-003 payout mark paid | `POST /admin/payouts/:id/mark-paid` | `PayoutsService.markPaid` | yes | `APPROVED → PAID` | `PayoutPaid` | `PAYOUT_PAID` | no (F-06) | `IMPLEMENTED` | F-06 |
| BF-003 wallet credit | (consumer) | `WalletService` | yes (uses `prisma.wallet.update` increments) | – | – | – | – | `IMPLEMENTED` | – |
| BF-004 credit topUp | `POST /commerce/credit-packages/:slug/purchase` (path inferred) | `CreditPackageService.purchase` | yes | – | – | – | yes (F-06) | `IMPLEMENTED` | F-06 |
| BF-004 credit earn | (consumer) | `AiCreditsService.topUp(EARN)` | yes | – | – | – | – | `SCAFFOLDED` (no caller) | G-16 |
| BF-004 credit reserve | `POST /internal/credits/reservations` (planned) | `AiCreditsService.reserve` | yes (advisory lock missing) | – | – | – | yes | `IMPLEMENTED_BUT_INSECURE` (F-03) | F-03 |
| BF-004 credit settle | `POST /internal/credits/reservations/:id/settle` | `AiCreditsService.settle` | yes | – | – | – | yes | `IMPLEMENTED` | – |
| BF-004 credit release | `POST /internal/credits/reservations/:id/release` | `AiCreditsService.release` | yes | – | – | – | yes | `IMPLEMENTED` | – |
| BF-005 author draft | `POST /articles` | `ArticlesService.createDraft` | yes | `– → DRAFT` | – | – | no | `IMPLEMENTED` | – |
| BF-005 submit review | `POST /articles/:id/submit-review` | `ArticlesService.submitReview` | yes | `DRAFT → PENDING_REVIEW` | – | – | no | `IMPLEMENTED` | – |
| BF-005 review approve | `POST /admin/articles/:id/approve` | `AdminArticlesService.approve` | yes | `PENDING_REVIEW → PUBLISHED` | `ArticlePublished` | `ARTICLE_APPROVED` | no | `IMPLEMENTED` (D-12 gap: no `REVIEWER` capability) | – |
| BF-005 PATCH bypass | `PATCH /articles/:id` (current) | `ArticlesService.update` | no (no `assertEditable`) | bypasses state machine | – | – | – | `IMPLEMENTED_BUT_INSECURE` (SM-1) | SM-1 |
| BF-005 marketplace read | `GET /articles/marketplace` | `MarketplaceArticlesService.list` | no | – | – | – | – | `IMPLEMENTED` | – |
| BF-006 author class | `POST /classes` | `ClassesService.create` | yes | `– → DRAFT` | – | – | no | `IMPLEMENTED` | – |
| BF-006 free class enrollment | (free) | `OrdersService.createFreeTopicOrder` (path for class not implemented) | – | – | – | – | – | `NOT_IMPLEMENTED for class` | – |
| BF-006 paid class enrollment | `POST /orders` with `kind: 'CLASS'` | `OrdersService.create` | yes | – | – | – | no | `IMPLEMENTED` | – |
| BF-006 class capacity | `OrdersService.assertSeat` | – | – | – | – | – | `IMPLEMENTED` (CLASS_FULL) | – |
| BF-006 attendance | (consumer) | – | – | – | – | – | – | `SCAFFOLDED` (G-15) | G-15 |
| BF-007 paid class | (covered above) | – | – | – | – | – | – | `IMPLEMENTED` | – |
| BF-008 mastery aggregated | (consumer) | `MasteryService.listByUser` | no | – | – | – | n/a | `IMPLEMENTED` | – |
| BF-008 next activity | `GET /personalization/policy/next` | `AdaptivePolicyService.decideNext` | no | – | – | – | n/a | `IMPLEMENTED` | – |
| BF-009 mock assessment (correct) | `POST /quiz-attempts/:id/submit` | `QuizEvaluationService` + `QuizAttemptsService.submitAttempt` | yes | `IN_PROGRESS → COMPLETED`, `score` set | `QUIZ_SUBMITTED` | – | no | `NOT_IMPLEMENTED` (F-08) | F-08 |
| BF-009 mock assessment (wrong) | same | same | yes | same; `MisconceptionDetected` per wrong answer | – | – | no | `NOT_IMPLEMENTED` (F-08, F-09) | F-08, F-09 |
| BF-010 readiness certification | – | – | – | – | – | – | – | `NOT_IMPLEMENTED` (D-03) | – |
| BF-011 creator analytics | `GET /creator-analytics/:id/earnings` | `CreatorEarningsService.summary` | no | – | – | – | n/a | `IMPLEMENTED` | – |
| BF-011 mastery gain on products | – | – | – | – | – | – | – | `NOT_IMPLEMENTED` (G-15) | G-15 |
| BF-012 credit earn on event | – | – | – | – | – | – | – | `SCAFFOLDED` (G-16) | G-16 |
| BF-013 credit purchase | (same as BF-004 topUp) | – | – | – | – | – | – | `IMPLEMENTED` | – |
| BF-014 refund request | `POST /orders/:id/refund-requests` | `RefundsService.request` | yes (advisory) | `– → REQUESTED` | `RefundRequested` | `REFUND_REQUESTED` | no (F-06) | `IMPLEMENTED` | F-06 |
| BF-014 admin refund | `POST /admin/refunds` | `RefundsService.request` | yes | `– → REQUESTED` | – | – | no | `IMPLEMENTED` | – |
| BF-014 refund approve | `POST /admin/refunds/:id/approve` | `RefundsService.approve` | yes | `REQUESTED → APPROVED` | `RefundApproved` | `REFUND_APPROVED` | no (F-06) | `IMPLEMENTED` | F-06 |
| BF-014 refund process | `POST /admin/refunds/:id/process` | `RefundsService.process` | yes | `APPROVED → PROCESSED` | `RefundCompleted` | `REFUND_PROCESSED`, `REFUND_EFFECTS_APPLIED` | no (F-06) | `IMPLEMENTED` | F-06 |
| BF-014 refund reject | `POST /admin/refunds/:id/reject` | `RefundsService.reject` | yes | `* → REJECTED` | – | – | no (F-06) | `IMPLEMENTED` | F-06 |
| BF-015 payout (covered above) | – | – | – | – | – | – | – | `IMPLEMENTED` | – |
| BF-016 moderation (admin only) | `POST /admin/moderation/queue` | `ModerationService` | yes | – | – | – | no | `IMPLEMENTED` (D-12 gap) | – |
| BF-017 payout (same as BF-015) | – | – | – | – | – | – | – | – | – |
| BF-018 refund (same as BF-014) | – | – | – | – | – | – | – | – | – |
| BF-019 sandbox validate | `POST /sandbox/journal/validate` | `AccountingSandboxService.validateJournal` | no (read-only) | – | – | – | n/a | `IMPLEMENTED` | – |
| BF-019 sandbox persist | `POST /sandbox/attempts/:id/entries/:entryId/post` | – | – | – | – | – | – | `NOT_IMPLEMENTED` (F-04) | F-04 |
| BF-020 learner publish | (content creation flow, same as BF-005) | – | – | – | – | – | – | – | – |
| BF-021 reuse | (analytics, same as BF-011) | – | – | – | – | – | – | – | – |
| BF-022 wallet payment | (planned) | – | – | – | – | – | – | `SCAFFOLDED` | – |
| BF-023 prompt optimization | – | – | – | – | – | – | – | `SCAFFOLDED` (D-10) | – |
| BF-024 prompt approval | – | – | – | – | – | – | – | `SCAFFOLDED` (D-10) | – |
| BF-025 circularity metrics | (analytics) | – | – | – | – | – | – | `SCAFFOLDED` (G-17) | G-17 |

# 3. Status counts

| Status | Flows |
|---|---|
| `IMPLEMENTED` end-to-end | BF-002, BF-014 (request/approve/process/reject), BF-003 (payout request/approve/mark-paid), BF-004 topUp/settle/release, BF-005 draft/submit/approve/marketplace, BF-006 paid, BF-008, BF-011 earnings, BF-013, BF-015, BF-016, BF-017, BF-018, BF-019 validate, BF-020 (BF-005), BF-021 (BF-011) |
| `IMPLEMENTED_BUT_INSECURE` | BF-001 (paid lesson), BF-001 submit attempt, BF-004 reserve (race), BF-005 PATCH bypass |
| `SCAFFOLDED` | BF-004 credit earn, BF-022 wallet payment, BF-023, BF-024, BF-025 |
| `NOT_IMPLEMENTED` | BF-001 server-evaluated submit, BF-010 readiness, BF-011 mastery gain, BF-019 sandbox persist |
| `PARTIALLY_IMPLEMENTED` | (covered in other docs) |

# 4. Closing summary

Of 25 flows, ~12 are fully end-to-end. Three flows have critical defects (F-01, F-02, F-03) that must be fixed before any user-facing pilot. Two flows have gaps that block creator and learner outcomes (F-04 sandbox, F-10 release). One flow (BF-010) is intentionally deferred to V3 per the decision register.

The API is the only place any of these can close. The AI service does not write, does not approve, and does not issue.

# 5. Cross-references

- Route catalog: [`api-route-catalog.md`](./api-route-catalog.md)
- Business logic and findings: [`api-business-logic-audit.md`](./api-business-logic-audit.md)
- State machines: [`api-state-machine-audit.md`](./api-state-machine-audit.md)
- Security: [`api-security-audit.md`](./api-security-audit.md)
- Concurrency: [`api-concurrency-audit.md`](./api-concurrency-audit.md)
- Idempotency: [`api-idempotency-audit.md`](./api-idempotency-audit.md)
- Standards: [`api-standards-compliance.md`](./api-standards-compliance.md)
- Tests: [`api-test-gap.md`](./api-test-gap.md)
