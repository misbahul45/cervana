# Actors and Journeys

> **Status**: `planned` · **Owner**: `product-strategist` · **Last reviewed**: `2026-10-02`
>
> Maps every actor of the learning loop onto the real role model, defines a five-stage ladder with deterministic entry rules, and traces the four journeys that must work end to end.

Facts: [`01-verification-delta.md`](./01-verification-delta.md) (VD). Decisions: [`decision-register.md`](./decision-register.md) (DR). Segment: D-01 A [ASSUMPTION]. Event names marked `exists` are declared in `payment-events.ts`, `commerce-events.ts`, `content-events.ts` or `payouts.service.ts`; `planned` names are proposed here.

---

## 1. Actor mapping

Role model: global `Role` is `STUDENT`, `TEACHER`, `ADMIN`; tenant role is `OWNER`, `MANAGER`, `TEACHER`, `EDITOR`; the `x-tenant-id` header only selects among the caller's own memberships [VERIFIED: ADR-001 §Decision 1-3, `tenant-context.service.ts`].

| Actor | Global role | Tenant role | Exists today | Missing capabilities |
|---|---|---|---|---|
| Learner (D-01 A) | `STUDENT` | none | Curriculum, quiz, chat, orders, manual payment proof, refund request, class enroll, marketplace read | Diagnostic, path view, sandbox UI, credits, portfolio, server-side scoring (VD S-09) |
| Student creator | `TEACHER` after an approved application | `OWNER` of own tenant | Application API with admin approval, tenant provisioning, article and class authoring API, wallet, payout API | Application UI, studio UI, evidence on the application, `TenantSettings` for payout destination (no writer), analytics UI |
| Reviewer | none | none | none; `ADMIN` moderates articles and classes | Review queue, quality score, reviewer capability (D-12) |
| Platform admin | `ADMIN` | any, by naming the tenant | Payment, payout and refund review, application approval, content moderation, tenant suspend, theme lifecycle: all API | Every UI, finance overview, audit search, separation of duties |
| Guardian | none | none | none | Consent, purchase approval (only if D-02 applies) |
| Institution lecturer | none | none | none | Cohort view, seat purchase [ASSUMPTION: later stage] |
| `ai-api` service | service identity | none | HMAC for 2 `/internal/resources/*` routes | Internal contract for every call (ADR-007, D-13) |
| Payment provider | none | none | Manual provider; `POST /webhooks/payments/:provider` answers `501` | Gateway adapter when D-14 is decided |

Separation of duties, to take effect when a second admin account exists (D-20): the account that approves a payment proof does not approve payouts; the account that approves a payout does not mark it paid; reviewers cannot review their own products. Today one `ADMIN` can do all of it.

---

## 2. Stage ladder

Each stage has a computed entry rule, the capabilities it unlocks, its UI surface and one KPI. Entry rules are deterministic functions of stored data; thresholds are parameters with no value set [ASSUMPTION: values come from the pilot, D-19]. A stage never decreases learner capabilities; creator capabilities are removed only through moderation (`SUSPENDED` content, tenant suspend).

| Stage | Entry rule (deterministic) | Unlocks | UI surface | KPI |
|---|---|---|---|---|
| Learner | Verified account (and age gate if D-02) | Free content, free tutor allowance `F`, sandbox `LEARN` mode | `/learn`, `/onboarding` | Share of new accounts completing the diagnostic |
| Practitioner | Mastery at least `theta_p` on at least `N_core` core sub-topics (golden graph up to `trial-balance`) and at least `K_p` distinct scenarios passed in `PRACTICE` or `CHALLENGE` with score at least `s_p` and first-attempt balanced-entry rate at least `rho` | Sandbox `CHALLENGE` and `EXAM`, portfolio entry, right to apply as creator | `/sandbox`, `/portfolio` | Share of learners reaching Practitioner within `T_p` days of the diagnostic |
| Creator | Application with evidence approved by a human (D-04); precondition computed: Practitioner stage or uploaded academic proof | Role `TEACHER`, tenant, studio, submit for review, earnings, wallet, payout request | `/become-creator`, `/studio` | Learner-to-creator conversion among Practitioners |
| Mentor | At least `M_pub` approved products and, per product, at least `n_min` buyers with mean mastery gain on the linked sub-topics of at least `g` and refund rate at most `r_max`, and no open quality incident | Reviewer capability nomination (granted by `ADMIN`, D-12), mentoring class type, verified badge (D-03) | `/review`, `/u/[handle]` | Reviewer agreement with a second reviewer on a sample |
| Knowledge Entrepreneur | Net revenue over the last `W` days at least `R_min`, at least two product types or one published agent that passed every gate (D-09), net refund rate at most `r_max` | Agent publication, bundles, analytics export, wallet-paid reinvestment | `/studio/agents`, `/studio/earnings` | Creator retention and reinvestment rate |

Promotion is an event, not a flag: a `StagePromotion` row stores the stage, a snapshot of the inputs, the deciding service or human, and the time (`13-data-model-delta.md`). Parameters live in one configuration record versioned like a policy.

---

## 3. Journeys

Event names: `exists` or `planned`. KPI formulas are in [`05-circular-economy.md`](./05-circular-economy.md) §5.

### 3.1 Learner: first session to first balanced journal entry (stages 1)

| Stage | Route | User goal | System action | Event | Friction or risk | KPI |
|---|---|---|---|---|---|---|
| Sign up | `/register`, `/verify-email` | Create an account | `POST /auth/register`, verification token mail | `UserRegistered` (planned) | Mail delivery; age gate only if D-02 | Verification completion |
| Diagnostic | `/onboarding` | Show current level | Deterministic placement on the prerequisite graph from a short quiz | `DiagnosticCompleted` (planned) | Quiz scored by `QuizEvaluationService`, which is unwired (VD VF-04) | Diagnostic completion |
| See path | `/learn/path` | Know what is next | Skill tree from `SubTopicPrerequisite` plus mastery overlay | `PathViewed` is not a reward event | Linear 10-node graph is a thin path (VD S-16) | Next-activity acceptance |
| Open scenario | `/sandbox/[scenarioId]` | Practice a transaction | `POST /sandbox/scenarios/:id/attempts` creates `SandboxAttempt` | `SandboxAttemptStarted` (planned) | Needs a seeded scenario; none exists | Attempt start rate |
| Draft entry | `/sandbox/attempts/[id]` | Enter debit and credit lines | Draft saved; live totals in the UI | none | Compound entries corrupted by VD VF-03 until fixed | Balanced draft rate |
| Validate and post | same | Get a deterministic verdict | `validate` then `post` by `AccountingSandboxService` in one transaction | `JournalEntryPosted` (planned) | Float arithmetic in validation (VF-03) | First-attempt balanced rate |
| Feedback | same | Understand a mistake | Misconception tag from a rule; AI explains only | `MisconceptionDetected` (planned) | AI must not grade | Mistake-to-fix rate |
| Complete | same | See score | `complete` computes score by rule | `ScenarioCompleted` (planned) | Score must not gate rewards without review | Scenario completion |

### 3.2 Learner: first purchase (stage 2)

| Stage | Route | User goal | System action | Event | Friction or risk | KPI |
|---|---|---|---|---|---|---|
| Discover | `/marketplace` | Find a product | `GET /marketplace/articles`, `/classes` (public) | none | The recommendations page calls a wrong URL (VD VF-15) | Product detail views to order |
| Order | `/marketplace/[type]/[slug]` | Buy | `POST /orders` with items; price from the database | `PaymentCreated` (exists) | Manual payment accounts unset gives `503` (`MANUAL_PAYMENT_ACCOUNTS` empty); the page calls `/v1/orders` without `/api` (VD VF-20) | Order creation rate |
| Pay | `/orders/[id]` | Transfer and prove | Instructions shown; proof upload; `POST /payments/manual/intents/:id/submissions` | `PaymentSubmitted` (exists) | Proof is a client-supplied URL, not fetched | Proof acceptance rate |
| Wait | `/orders/[id]` | Know the status | SSE or polling; admin queue oldest first | none | One admin is the bottleneck | Time to approval |
| Access | product page | Read or join | `PaymentVerified` then `EntitlementGranted`, `OrderFulfilled` | exists | Content read is not gated for curriculum lessons (VD VF-14) | Fulfilment success rate |
| Refund (optional) | `/orders/[id]` | Undo | `POST /orders/:id/refund-requests` inside the window | `RefundRequested` (exists) | Window 7 days default; creator already paid out blocks reversal (VD HC-13) | Refund rate |

### 3.3 Creator: first publication (stage 2)

| Stage | Route | User goal | System action | Event | Friction or risk | KPI |
|---|---|---|---|---|---|---|
| Apply | `/become-creator` | Become a creator | `POST /teacher/applications`; admin approves; role upgrade and tenant provisioned in one transaction | none (audit row) | Application has no mastery evidence field | Approval rate, time to decision |
| Draft | `/studio/articles/[id]` | Write | `POST /articles` (tenant scoped), `PATCH` while `DRAFT` or `REJECTED` | none | Optimistic concurrency not implemented (`If-Match`) | Draft-to-submit rate |
| Submit | same | Ask for review | `POST /articles/:id/submit-review` | none | Review queue has no UI | Time in `PENDING_REVIEW` |
| Review | `/review` | Approve or reject | Reviewer capability (D-12) approves, rejects or requests changes | `ArticlePublished` (exists) on approval | Reviewer must not review own product | Rejection rate, reviewer agreement |
| Publish | product page | Be listed | Version pinned; marketplace read lists `PUBLISHED` of `ACTIVE` tenants | exists | Wrong accounting content (risk R-03 in `15-risks.md`) | Published products per creator |

### 3.4 Creator: first payout (stage 3)

| Stage | Route | User goal | System action | Event | Friction or risk | KPI |
|---|---|---|---|---|---|---|
| Sale | n/a | Earn | `CreatorEarningCreated`; release to wallet immediately when hold is 0 | `CreatorEarningCreated` (exists), `CreatorEarningReleased` (declared) | Hold default 0 (VD HC-13); `releaseDue` has no caller (VF-10) | Earning to wallet latency |
| Balance | `/studio/earnings` | See funds | `GET /wallets/mine`, `/wallets/:id/ledger` | none | Wallet scope per creator within tenant (D-07) | Wallet balance accuracy (ledger sum equals balance) |
| Request | `/studio/payouts` | Withdraw | `POST /payouts` holds funds with a ledger `PAYOUT` debit | `PayoutRequested` (exists) | Destination typed per request; `TenantSettings` unused | Payout request success |
| Review | `/admin/payouts` | Verify | `start-review`, `approve` by `ADMIN` | `PayoutApproved` (exists) | Same admin as payments until D-20 | Time to approval |
| Pay | admin transfers, records evidence | Complete | `mark-paid` with uploaded evidence | `PayoutPaid` (exists) | Manual transfer error | Reconciliation breaks per period |
| Cancel or reject | `/studio/payouts` | Undo | Funds returned by ledger reversal | `PayoutCancelled`, `PayoutRejected` (exists) | Double submit | Rejected share |

### 3.5 Supporting journeys

| Journey | Route | Key steps | Events | KPI |
|---|---|---|---|---|
| Admin payment review | `/admin/payments` | Open queue, view proof, `start-review`, `approve` or `reject` with reason | `PaymentVerified`, `PaymentFailed` (exist) | Median review time, reject-with-resubmit rate |
| Reviewer content review | `/review` | Claim item, check rubric and sandbox scenario, decide | `ReviewDecided` (planned) | Review time, agreement rate |
| Tutor message with credits | `/tutor/[sessionId]` | Show cost, reserve, call `ai-api`, settle or release | `CreditReserved`, `CreditSettled`, `CreditReleased` (planned) | Reservation release rate, cost per answer |

---

## 4. Acceptance criteria

| Criterion | Test |
|---|---|
| Each actor row has a stated source of truth or `none` | Review against VD §3 |
| Each stage rule reads only stored data and parameters | Rule evaluator unit tests with fixed fixtures (stage 5) |
| Each journey step names a route, system action and event | Table review; events either exist in code or are listed as planned |
