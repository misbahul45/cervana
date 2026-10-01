# API System Plan

> **Status**: `planned` · **Owner**: `api-architect` · **Last reviewed**: `2026-10-02`
>
> A buildable endpoint catalog for `services/api` aligned with the existing access-decision system, the conventions every new route follows, the removal list, the error-code catalog, and the contract of every `ai-api` route.

Facts: [`01-verification-delta.md`](./01-verification-delta.md) (VD). Paths are relative to `/api/v1` as served by `api`; behind nginx they only resolve once the prefix defect (VD HC-14) is fixed; several modules mount under a router prefix (`curriculum`, `chat`, `teacher`, `quiz`, `material`, `gamify`, `learning`) [VERIFIED: `grep RouterModule.register`, `main.ts:54`]. Status values: `exists`, `new`, `change`, `remove`. Decision kinds are the matrix kinds: Public, Service, Role, Tenant (with membership roles), Owner, Own rows, Authenticated; the new `Capability` check (reviewer) is registered as a Role-family decision so `route-access.spec.ts` keeps failing any route without one.

---

## 1. Conventions

| ID | Convention | Today |
|---|---|---|
| C-1 | Prefix `/api/v1`; Swagger is the contract; every new route passes the ratchet test | exists |
| C-2 | State changes only through intent endpoints (`POST .../submit-review`, `.../approve`); no generic `PATCH status` | partial: `PATCH` routes on progress, unlock, score and correctness fields remain client-writable (§8) |
| C-3 | One access decision per route | exists (273 of 273) |
| C-4 | Strict Zod DTOs; URL fields must be `https://` and, for uploads, owned by the caller (`assertOwnedUploadedFile`); Zod `url()` alone accepts `javascript:` and `data:` | exists for proofs, evidence; apply everywhere |
| C-5 | Money is `Decimal`, serialized as a string with explicit `currency` `IDR`; credits are integers | exists for commerce |
| C-6 | `Idempotency-Key` required on every money, credit, event-ingest and AI-run endpoint; implemented as an interceptor over the existing `IdempotencyService` (24 h window, request-hash check, keyed by key and user) | not enforced anywhere (VD G-T-06) |
| C-7 | Authoring uses optimistic concurrency: `ETag: "<version>"` on `GET`, `If-Match` required on `PATCH`; mismatch gives `412 VERSION_CONFLICT` | none |
| C-8 | New list routes use cursor pagination (`cursor`, `limit`, response `nextCursor`); timestamps ISO-8601 UTC; existing page and limit routes stay | page and limit only |
| C-9 | Errors carry a stable `code` from §9; the envelope is `{ success: false, message, code, meta: { requestId, timestamp } }` | exists (`app.exceptions.ts`) |
| C-10 | Every state change publishes a `DomainEvent` with a `dedupeKey`. Money and entitlement consumers stay synchronous in the publisher's transaction (ADR-008); reward, analytics and notification consumers move to an outbox worker at trigger `L_appr` | synchronous only |
| C-11 | SSE: one naming scheme `GET /streams/<name>` with the event type `Aggregate.EventType`; the user is taken from the JWT, never from a parameter (Phase 1 fixed broadcast leaks; keep it) | 8 streams with 8 naming styles |
| C-12 | Internal routes live under `/internal`, are `@InternalOnly()`, signed, and carry `x-acting-user-id` | 2 routes |

---

## 2. Curriculum and authoring (S-18)

| Method | Path | Decision | Request | Response | Transition | Events | Idempotency | Status |
|---|---|---|---|---|---|---|---|---|
| POST, PATCH | `/curriculum/lessons`, `/curriculum/lessons/:id` | Role `ADMIN`, `TEACHER` plus Owner (author of the parent topic or tenant `EDITOR` and above) | lesson fields; `createdBy` ignored, taken from the caller | lesson | none | none | DB unique sort order | change |
| POST, PATCH | `/curriculum/steps`, `/curriculum/steps/:id` | same | step fields | step | none | none | DB | change |
| POST, PATCH | `/curriculum/subtopics`, `/curriculum/subtopics/:id` | same | subtopic fields | subtopic | none | none | DB | change |
| POST, PATCH | `/quiz/quizs`, `/quiz/quizs/:id`, `/quiz/questions`, `/quiz/questions/:id` | same | quiz or question fields | row | none | none | DB | change |
| POST | `/material/resources` and `DELETE /material/resources/:id` | Role `TEACHER` plus Owner (uploader) | resource | resource | `UPLOADED` to `QUARANTINED` | `ResourceQuarantined` | `Idempotency-Key` | change |
| GET | `/curriculum/lessons/:id`, `/curriculum/steps/:id` | Authenticated plus free-or-entitlement gate | n/a | lesson or step | none | none | n/a | change (VD VF-14) |
| GET | `/curriculum/topics/:id/graph` | Authenticated | n/a | nodes, edges, level per node | none | none | n/a | new |
| GET | `/curriculum/subtopics/:id/prerequisites` | Authenticated | n/a | list | none | none | n/a | new |
| POST | `/curriculum/subtopics/:id/prerequisites` | Role `ADMIN`, `TEACHER` plus Owner | `{ requiresId }` | edge | adds the edge after a check that `:id` is not reachable from `requiresId` through existing edges (VD VF-21), backed by a database trigger | `PrerequisiteAdded` | DB unique pair | new |
| DELETE | `/curriculum/subtopics/:id/prerequisites/:requiresId` | same | n/a | 204 | removes edge | `PrerequisiteRemoved` | n/a | new |
| POST | `/categories/:categoryId/topics/topicId` and `DELETE` | Role `TEACHER` | n/a | n/a | n/a | none | n/a | change: path ends with the literal `topicId` (`categories.controller.ts:58,68`); make it `:topicId` |

Ownership rule: a `TEACHER` writes only below topics whose `Topic.createdBy` is the caller, or in a tenant where the caller holds `EDITOR` or above; `ADMIN` writes anywhere. The registry gets resource types `lesson`, `step`, `subtopic`, `quiz-author`, `question-author` (`v1/common/guards/ownership.registry.ts`).

---

## 3. Content products and review

Existing studio routes keep their paths (`/articles`, `/classes`, tenant scoped); the web `/studio/*` pages map to them. The draft's `publish` and `unpublish` intents are rejected: publication is the reviewer's `approve`; withdrawal is `withdraw`; retirement is `archive`.

| Method | Path | Decision | Request | Response | Transition | Events | Idempotency | Status |
|---|---|---|---|---|---|---|---|---|
| POST, GET, PATCH | `/articles`, `/articles/:id` | Tenant `OWNER`, `MANAGER`, `TEACHER`, `EDITOR` | draft fields; `PATCH` needs `If-Match` | article with `ETag` | `DRAFT` or `REJECTED` edit only | none | `If-Match` | change (PATCH) |
| GET | `/articles/:id/versions` | Tenant | cursor | version list | none | none | n/a | new |
| POST | `/articles/:id/submit-review`, `/withdraw`, `/archive` | Tenant | none | article | `DRAFT` to `PENDING_REVIEW`; `PENDING_REVIEW` to `DRAFT`; any to `ARCHIVED` | none | state table | exists |
| Same set | `/classes`, `/classes/:id`, `/classes/:id/submit-review`, `/withdraw`, `/archive`, `/sessions`, `/sessions/:sessionId`, `/sessions/:sessionId/cancel`, `/classes/:id/enrollments` | Tenant | as articles | class | as articles | none | state table | exists (11 routes), PATCH change |
| GET | `/review/queue` | Role family: capability `REVIEWER` or `ADMIN` | filters, cursor | items by age | none | none | n/a | new |
| GET | `/review/items/:id` | same | n/a | item with version, sandbox results, history | none | none | n/a | new |
| POST | `/review/items/:id/claim` | same | none | item | unclaimed to claimed | `ReviewClaimed` | state table | new |
| POST | `/review/items/:id/approve` | same; not the author | `{ note, rubric }` | item | `PENDING_REVIEW` to `PUBLISHED` | `ArticlePublished` or `ClassPublished`, `ReviewDecided` | `Idempotency-Key` | new |
| POST | `/review/items/:id/reject`, `/request-changes` | same | `{ note }` | item | to `REJECTED` or `DRAFT` | `ReviewDecided` | `Idempotency-Key` | new |
| POST | `/admin/articles/:id/{approve,reject,suspend,reinstate,archive}` and the class twins | Role `ADMIN` | `{ reason }` | content | state table | existing events | state table | exists (override path) |
| POST, PATCH | `/scenarios`, `/scenarios/:id`; `POST /scenarios/:id/validate`, `/submit-review` | Tenant (stage 5); `POST /admin/scenarios` Role `ADMIN` (stage 1, D-18) | scenario document (`06-accounting-domain.md` §4) | scenario | draft to review | `ScenarioSubmitted` | `If-Match` | new |

---

## 4. Marketplace read and content access

| Method | Path | Decision | Request | Response | Transition | Events | Idempotency | Status |
|---|---|---|---|---|---|---|---|---|
| GET | `/marketplace/articles`, `/marketplace/classes`, `/:id` | Public | filters | published, active tenants only | none | none | n/a | exists |
| GET | `/marketplace/products` | Public | `type`, `topicId`, `level`, `price`, `sort`, cursor | unified list | none | none | n/a | new |
| GET | `/creators/:handle` | Public | n/a | profile, published products | none | none | n/a | new (needs `handle`, `13-data-model-delta.md`) |
| GET | `/marketplace/agents`, `/marketplace/agents/:slug` | Public | filters | agent cards | none | none | n/a | new (stage 7) |
| GET | `/marketplace/articles/:id/access`, `/content`; `/marketplace/classes/:id/access`, `/materials` | Authenticated plus entitlement | n/a | content or `ENTITLEMENT_REQUIRED` | none | none | n/a | exists |
| POST | `/marketplace/classes/:id/enroll`, `/cancel-enrollment`, `/sessions/:sessionId/attend`, `/complete` | Authenticated | none | enrollment | enroll with capacity trigger; cancel; attend; complete | `ClassEnrolled`, `ClassAttended`, `ClassCompleted` | DB unique per user and class | exists (draft `POST /classes/:id/enroll` rejected: same function) |
| GET | `/marketplace-discovery/recommendations` | Authenticated | `limit` | recommendations | none | none | n/a | exists (web URL bug VF-15) |

---

## 5. Orders, payments, creator finance

| Method | Path | Decision | Request | Response | Transition | Events | Idempotency | Status |
|---|---|---|---|---|---|---|---|---|
| POST | `/orders` | Authenticated | `{ items: [{ type, id }] }`, type adds `AI_CREDIT_PACKAGE`; legacy `{ topicId }` | order, payment | `PENDING` | `PaymentCreated` | `Idempotency-Key` plus advisory lock | change |
| GET, POST | `/orders`, `/orders/:id`, `/orders/:id/cancel` | Authenticated, owner rows | n/a | order | `PENDING` to `CANCELLED` | none | state table | exists |
| GET, POST | `/payments/methods`, `/payments/intents/:id`, `/payments/manual/intents/:id/submissions` | Authenticated, buyer | proof `https://` owned upload | submission | `PENDING` to `SUBMITTED` | `PaymentSubmitted` | one open proof | exists |
| GET, POST | `/admin/payments/manual/submissions[/:id]`, `/start-review`, `/approve`, `/reject`, `/admin/payments/intents/:id/reconcile`, `/admin/payments/expire-due` | Role `ADMIN` | `{ reason }` | submission | to `PAID` or back to `PENDING` | `PaymentVerified`, `PaymentFailed` | one approved proof | exists (7 routes) |
| POST | `/webhooks/payments/:provider` | Public (signature verified once a provider exists) | provider payload | `501` today | none | none | provider id | exists |
| GET | `/wallets/mine`, `/wallets/:id`, `/wallets/:id/ledger` | Authenticated, owner rows | cursor | wallet, ledger | none | none | n/a | exists |
| GET | `/earnings` | Role `TEACHER` (own rows) | status, cursor | earnings with status and release date | none | none | n/a | new (replaces `/creator-analytics/:creatorId/earnings` for self use) |
| GET | `/creator-analytics/:creatorId/diagnostics`, `/earnings` | Role `TEACHER`, `ADMIN` | n/a | analytics | none | none | n/a | change: enforce `creatorId` equals the caller unless `ADMIN` |
| PUT | `/tenants/current/settings/payout` | Tenant `OWNER`, `MANAGER` | destination fields | settings | none | `TenantSettingsChanged` | `Idempotency-Key` | new |
| POST, GET | `/payouts`, `/payouts`, `/payouts/:id`, `/payouts/:id/cancel` | Role `TEACHER` | amount; destination from settings | payout | `REQUESTED` to `CANCELLED`; ledger hold | `PayoutRequested`, `PayoutCancelled` | `Idempotency-Key`, `payout:<id>` | change (POST) |
| GET, POST | `/admin/payouts[/:id]`, `/start-review`, `/approve`, `/mark-paid`, `/reject` | Role `ADMIN`, distinct approver from payment approver (D-20) | `{ reason }` or evidence | payout | state table | `PayoutApproved`, `PayoutPaid`, `PayoutRejected` | state table | exists, change (separation of duties) |
| POST | `/orders/:id/refund-requests` | Authenticated, owner | `{ reason }` | refund | to `REFUND_PENDING` | `RefundRequested` | one open refund per payment | exists |
| GET, POST | `/refunds/mine`, `/admin/refunds[/:id]`, `/approve`, `/reject`, `/process` | Authenticated or Role `ADMIN` | `{ reason }` or evidence | refund | state table | `RefundApproved`, `RefundCompleted` | state table | exists |
| GET | `/admin/finance/overview` | Role `ADMIN` | period | totals by ledger category, open payouts, open refunds | none | none | n/a | new |
| POST | `/admin/ledger/reconcile` | Role `ADMIN` | period | report only | none | `LedgerReconciled` | `recon:<period>` | new |

---

## 6. AI credits, tutor, agents

| Method | Path | Decision | Request | Response | Transition | Events | Idempotency | Status |
|---|---|---|---|---|---|---|---|---|
| GET | `/credits/packages` | Authenticated | n/a | active packages | none | none | n/a | new |
| GET | `/credits/me`, `/credits/me/ledger` | Own rows | cursor | balance, reserved, available; ledger | none | none | n/a | new |
| POST, PATCH | `/admin/credits/packages`, `/admin/credits/packages/:id` | Role `ADMIN` | package fields | package | active or inactive | `CreditPackageChanged` | `Idempotency-Key` | new |
| POST | `/admin/credits/adjustments` | Role `ADMIN` | `{ userId, amount, reason }` | ledger entry | `ADJUSTMENT` | `CreditAdjusted` | `Idempotency-Key` | new |
| POST | `/internal/credits/reservations`, `/:id/settle`, `/:id/release` | Service (called by `api` code paths) | `{ userId, amount, key }` | reservation | `HELD`, `SETTLED`, `RELEASED` | `CreditReserved`, `CreditSettled`, `CreditReleased` | key | new |
| POST | `/tutor/sessions` | Authenticated | `{ topicId?, mode }` | session | created | none | `Idempotency-Key` | new |
| POST | `/tutor/sessions/:id/messages` | Own rows | `{ text }` | answer, citations (chunk ids resolved), cost | reserve, run, settle | `CreditReserved`, `CreditSettled`, `TutorAnswered` | `Idempotency-Key` | new |
| GET | `/tutor/sessions/:id` | Owner | cursor | messages | none | none | n/a | new |
| POST | `/tutor/message` | Authenticated | `{ text, domain, ... }` | template answer | none | none | none | remove after the session routes ship |
| POST, PATCH | `/agents`, `/agents/:id` | Tenant (stage 7) | `AgentSpec` | agent | `DRAFT` | `AgentCreated` | `If-Match` | new |
| POST | `/agents/:id/sandbox-run` | Tenant | benchmark id | `AgentTestReport` | `DRAFT` to `SANDBOX` to `VALIDATING` | `AgentSandboxPassed` | `agent-test:<id>:<version>` | new |
| POST | `/admin/agents/:id/{publish,suspend,reinstate}` | Role `ADMIN` or reviewer capability | `{ reason }` | agent | `REVIEW` to `PUBLISHED`; to `SUSPENDED` | `AgentPublished`, `AgentIncidentRaised` | state table | new |

---

## 7. Learning, sandbox, gamification, themes, privacy, admin, internal

| Method | Path | Decision | Request | Response | Transition | Events | Idempotency | Status |
|---|---|---|---|---|---|---|---|---|
| POST | `/learning-events` | Authenticated | `{ type, entityType, entityId, payload }`, only client-trust types that never earn rewards or mastery | accepted | none | `LearningEventRecorded` | `Idempotency-Key` | new |
| POST | `/internal/learning-events` | Service | event | accepted | none | same | `x-idempotency-key` | new |
| POST | `/diagnostics`, `/diagnostics/:id/submit` | Authenticated, owner | answers | placement | attempt scored server side | `DiagnosticCompleted` | `Idempotency-Key` | new |
| GET | `/me/learner-model`, `/me/skill-tree`, `/me/next-activity`, `/me/misconceptions` | Own rows | n/a | mastery, nodes with state, policy decision plus rationale, tags | none | none | n/a | new |
| GET | `/sandbox/scenarios`, `/sandbox/attempts/:id`, `/trial-balance`, `/statements` | Authenticated, owner for attempts | n/a | scenario or attempt data | none | none | n/a | new |
| POST | `/sandbox/scenarios/:id/attempts` | Authenticated | `{ mode }` | attempt | created | `SandboxAttemptStarted` | `Idempotency-Key` | new |
| POST | `/sandbox/attempts/:id/entries`, `/entries/:entryId/validate`, `/post`, `/reverse`, `/periods/:periodId/close`, `/complete` | Owner | draft lines; `Decimal` strings | entry or result | draft, validated, posted, reversed; attempt completed | `JournalEntryPosted`, `ScenarioCompleted`, `MisconceptionDetected` | `Idempotency-Key` on `post`, `reverse`, `complete` | new |
| GET | `/gamification/me`, `/gamification/leaderboards?scope=` | Own rows | n/a | projection; opted-in board | none | none | n/a | new |
| POST | `/gamification/leaderboards/:id/join`, `/leave` | Own rows | none | membership | opt in or out | none | DB unique | new |
| POST, PATCH, DELETE | `/gamify/daily-logs`, `/gamify/daily-logs/:id`, streak and leaderboard writers | Role `ADMIN` | n/a | n/a | n/a | none | n/a | remove after the reward engine |
| GET | `/gamify/themes/default` | Public | `If-None-Match` | normalized theme, `ETag`, `Cache-Control` | none | none | n/a | change (headers) |
| GET | `/gamify/themes/resolved?topicId=&level=` | Public | n/a | resolved theme | none | none | n/a | new |
| PUT | `/me/theme-preference` | Own rows | `{ themeId }` | preference | validated against published themes | none | DB unique | new (stage 5) |
| GET, POST | `/me/data-export`, `/me/deletion-request` | Own rows | none | job id | request created | `DataExportRequested`, `DeletionRequested` | `Idempotency-Key` | new |
| GET, DELETE | `/me/memories`, `/me/memories/:id` | Own rows | cursor | memories | row deleted | `MemoryDeleted` | n/a | new |
| GET, POST | `/me/consents` | Own rows | `{ document, version }` | record | none | `ConsentRecorded` | DB unique per document version | new |
| GET | `/admin/audit` | Role `ADMIN` | actor, entity, range, cursor | audit rows | none | none | n/a | new |
| GET, POST | `/admin/agents/incidents`, `/admin/optimization/runs`, `/admin/optimization/runs/:id/{approve,reject}` | Role `ADMIN` | `{ reason }` | run | gate result to approved or rejected | `PromptPromoted` | state table | new (stage 6) |
| GET | `/internal/learners/:id/context` | Service | n/a | context | none | none | n/a | new |
| POST | `/internal/episodes`, `/internal/decision-traces`, `/internal/memories/candidates`, `/internal/tools/validate` | Service | payloads | accepted | none | none | `x-idempotency-key` | new |
| GET | `/internal/rag/published-resources` | Service | cursor | resources with scope | none | none | n/a | new |
| GET | `/metrics` | Role family: internal network only | n/a | Prometheus text | none | none | n/a | change (VD VF-08, D-17) |

---

## 8. Deprecation and removal list

| Item | Why | Replacement | Stage |
|---|---|---|---|
| `{ topicId }` order shape, `Order.topicId`, `OrderItem.topicId`, topic entitlement (D-16) | Topic is an accidental second product | Class or article products; dual read then drop | 2 to 3 |
| `Order.amount Float`, `snapToken`, `gateway` | Float money and gateway-era fields | `total`, `PaymentIntent.provider` | 3 |
| `STRIPE_*` in `.env.example` and both compose files | Unused | none | 0 |
| `PATCH /learning/user-topics/:id`, `/lesson-progresses/:id`, `/step-progresses/:id`, `/subtopic-progresses/:id`, `/user-steps/:id` (client-writable progress and unlock fields) | Forgeable progress | `POST /learning/lessons/:id/complete`, server-computed progress from events | 1 |
| `PATCH /quiz/quiz-attempts/:id` (`score`, `status`), `PATCH /quiz/answers/:id` (`isCorrect`, `pointsEarned`), `POST` twins | Forgeable scores (VD G-A-02) | `POST /quiz/quiz-attempts/:id/submit` scored by `QuizEvaluationService` | 1 |
| `POST /tutor/message` | Template reply | `/tutor/sessions/:id/messages` | 4 |
| `/gamify/daily-logs`, streak and leaderboard writers | Request-driven engine | Reward engine | 4 |
| Eight SSE paths with eight naming styles | Inconsistent | `/streams/<name>` aliases, then drop | 2 |
| `?token=` and `userId` query parameters on `ai-api` `generate-question` | Token and identity in URLs | Header auth; acting user from the validated token | 0 |

---

## 9. Error-code catalog

Existing codes are kept (`common/lib/error.ts`). The master prompt's draft names map as: `ORDER_NOT_PAYABLE` to `INVALID_ORDER_STATE`, `CREDIT_INSUFFICIENT` to `INSUFFICIENT_AI_CREDITS`. New codes are marked.

| Code | HTTP | Meaning | Status |
|---|---|---|---|
| `VALIDATION_ERROR` | 422 | DTO or invariant violation | exists |
| `UNAUTHORIZED`, `FORBIDDEN`, `OWNERSHIP_DENIED` | 401, 403 | Authentication or access | exists |
| `NOT_FOUND` | 404 | Also used to hide other users' rows | exists |
| `INVALID_STATE_TRANSITION` | 409 | State table refuses | exists |
| `TENANT_ACCESS_DENIED`, `TENANT_REQUIRED`, `TENANT_ROLE_INSUFFICIENT` | 403, 400, 403 | Tenant context | exists |
| `ALREADY_OWNED` | 409 | Entitlement already held | exists |
| `ENTITLEMENT_REQUIRED` | 403 | Content needs an entitlement | exists |
| `CONTENT_NOT_PUBLISHED`, `CONTENT_LOCKED` | 404, 409 | Publication or edit state | exists |
| `CLASS_FULL` | 409 | Capacity | exists |
| `INVALID_ORDER_STATE`, `INVALID_PAYMENT_STATE`, `PAYMENT_EXPIRED`, `PAYMENT_NOT_FOUND`, `PAYMENT_ALREADY_REVIEWED`, `PAYMENT_PROVIDER_UNAVAILABLE` | 409, 410, 404, 409, 503 | Payment flow | exists |
| `PAYOUT_EXCEEDS_BALANCE`, `REFUND_EXCEEDS_BALANCE` | 409 | Money bounds | exists |
| `INSUFFICIENT_AI_CREDITS`, `AI_CREDIT_RESERVATION_FAILED` | 402, 409 | Credits | exists, unused |
| `UNAUTHORIZED_TOOL`, `AGENT_BUDGET_EXCEEDED` | 403, 429 | Agent runtime | exists, unused |
| `VERSION_CONFLICT` | 412 | `If-Match` mismatch | new |
| `IDEMPOTENCY_KEY_REQUIRED` | 400 | Missing header on a money, credit, event or AI-run route | new |
| `IDEMPOTENCY_KEY_REUSED` | 422 | Same key, different body | new |
| `CAPABILITY_REQUIRED` | 403 | Reviewer capability missing | new |
| `REVIEW_CONFLICT_OF_INTEREST` | 403 | Reviewer is the author | new |
| `CREDIT_RESERVATION_NOT_HELD` | 409 | Settle or release on a closed reservation | new |
| `LLM_UNAVAILABLE` | 503 | Gateway failure, reservation released | new |
| `GROUNDING_EMPTY` | 200 with flag | No material found; no LLM call | new |
| Sandbox: `JOURNAL_MIN_LINES`, `JOURNAL_NON_POSITIVE_AMOUNT`, `JOURNAL_UNBALANCED`, `AMOUNT_PRECISION`, `ACCOUNT_INACTIVE`, `PERIOD_NOT_FOUND`, `PERIOD_CLOSED`, `ENTRY_ALREADY_POSTED`, `CANNOT_EDIT_POSTED`, `REVERSAL_TARGET_INVALID`, `ATTEMPT_NOT_OWNED`, `ATTEMPT_COMPLETED` | 404, 409, 422 | See `06-accounting-domain.md` §3.3 | new (strings exist for six) |
| `EMAIL_*`, `INVALID_OTP`, `EXPIRED_OTP`, `USER_*`, `DB_CONNECTION_ERROR`, `UNIQUE_CONSTRAINT_FAILED`, `SERVICE_UNAVAILABLE`, `INTERNAL_SERVER_ERROR` | various | Auth and infrastructure | exists |

---

## 10. `ai-api` route contracts

Timeout column: HTTP client timeout used for calls to `api` is 15 s (`requests` calls in `v1/learning/service.py`); the HTTP request returns as soon as the task is queued; the Hugging Face embedding call uses a 60 s timeout (`REQUEST_TIMEOUT_SECONDS`, `config/providers.py:17,45`) and `build_chat_model` passes no timeout to `ChatOpenAI` (`providers.py:115-136`), so LLM calls run on the client library default. Retry: Celery `autoretry_for=(Exception,)`, `retry_backoff`, `max_retries=3` on every task, which can repeat writes to `api`; target rows set retries to read-only steps and put an idempotency key on writes.

| Route | Request | Response | Timeout | Retry | Idempotency | Auth today | Auth target |
|---|---|---|---|---|---|---|---|
| `POST /ai/v1/resources/extract` | query `type` (`PDF`, `IMAGE`, `VIDEO`), `resource_id` | `{ task_id, status: "queued" }` | queue only | task: 3, backoff | none | user token via `GET /auth/profile`, roles `TEACHER`, `ADMIN`; limit 30 per minute | signed service call with acting user (called by `api`) |
| `POST /ai/v1/resources/embedding/{resource_id}` | path id | `{ task_id, status }` | queue only | task: 3 | vector id per chunk id | same | same |
| `POST /ai/v1/learning/generate-material` | body `GenerateContentMaterialPipeline` | `{ status, task_id, message }` | queue only | task: 3 (re-posts content) | none | header present, not validated | validated caller; spend through `api` (D-13) |
| `POST /ai/v1/learning/chat` | body `{ chatId, query, userId, userStepId, messageId }` | `{ status, task_id, message }` | queue only | task: 3 | none | not validated | same |
| `GET /ai/v1/users-steps/generate-question` (SSE) | query `lessonId`, `topicId`, `learningStyleId`, `userId`, `token` | events `status`, `introduction_chunk`, `end`, `error` | stream until end | task: 3 | none | non-empty `token` only | header auth, no `userId` parameter |
| `POST /ai/v1/users-steps/generate` | body `LPState` | generated steps or `{ error }` | request thread | none | none | check unreachable | validated caller |
| Target `POST /internal/agents/run` on `ai-api` | `AgentSpec` id, input, budgets, trace id | result, chunk ids, tokens, memory candidates | `max_wall_seconds` | none (caller releases credits) | `x-idempotency-key` | signed service identity | same |

---

## 11. Acceptance criteria

| Criterion | Test |
|---|---|
| Every new route has a decision, an idempotency rule and a status | `route-access.spec.ts` plus a catalog spec that reads this table's paths |
| Money, credit, event and AI-run routes reject a missing `Idempotency-Key` | HTTP harness spec per route |
| No route accepts a client-written score, progress or reward | Strict-DTO spec over the removal list |
| Reviewer cannot review their own item | `review.security.spec.ts` |
