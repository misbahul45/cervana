# TARGET_STATE

> Derived from the master prompt and `CURRENT_STATE.md`. Status: proposed, awaiting owner sign-off on the decisions in §1 before Phase 1 starts.

## 1. Decisions needing owner confirmation

| ID | Question | Proposal |
|---|---|---|
| D1 | Global role name: prompt says `USER`, schema has `STUDENT`. | Keep `STUDENT` in the DB and API; the prompt's `USER` maps to it. Renaming an enum touches JWTs, the web app and seed for no product gain. |
| D2 | AI→API auth: `AGENTS.md` rule 5 says forward the user's bearer token; the master prompt (§59) says use a service identity carrying user, tenant, trace and idempotency context. | Adopt the prompt: service credential (signed, rotated secret) plus signed user context headers; `api` re-authorizes every call. Amend `AGENTS.md` cross-service rule 5 and record ADR-007. `AGENTS.md` is not edited until you approve. |
| D3 | Existing `Order` is single-topic with `Float` money. | Additive migration: new `OrderItem`, Decimal columns, new status values, backfill; old `topicId`/`amount` retained until cutover, then dropped in a later migration. |
| D4 | Curriculum `Topic.price`/`UserTopic` vs new Article/Class products. | Curriculum stays as the structured learning path. Articles and classes are new products. Topic purchases are backfilled to `Entitlement` (resourceType `TOPIC` added) so one access authority exists. |
| D5 | Tenant for existing TEACHER users. | Backfill one tenant + OWNER membership per existing approved teacher. |
| D6 | Where memory write policy runs. | `api` owns the policy and tables (Postgres is the source of truth); `ai-api` proposes memory candidates and keeps only the Qdrant index. |
| D7 | Worker model. | One `celery-worker` service in dev and prod; remove the subprocess from `main.py`. |

## 2. Architecture

Keep the current topology; add modules inside `services/api`, no new services.

```
Web (Nuxt, one app: learner / teacher / admin)
  -> Nginx
  -> api (NestJS)  ---- Postgres (source of truth)
       |             ---- Redis (cache, BullMQ, Celery broker)
       | service identity + user/tenant/trace/idempotency context
       v
     ai-api (FastAPI) ---- Qdrant, LLM provider, tool registry
       ^
  celery-worker (extraction, embeddings, evaluation, aggregation)
```

Boundaries:
- `api` owns identity, RBAC, tenants, products, orders, payments, wallets, earnings, payouts, refunds, AI credit ledger, learner state, memory policy, gamification state, audit.
- `ai-api` owns LLM calls, embeddings, retrieval, agent runtime, tool orchestration, evaluation. It may call `api` only through its internal contract and never holds `DATABASE_URL`.
- Sensitive mutations exist only as intent endpoints (`approvePayment`, `publishArticle`, …) backed by a state-machine table per aggregate. No generic `PATCH status`.

## 3. Domain modules to add in `services/api/src/v1`

`tenants`, `tenant-memberships`, `teacher-applications` (extends `teacher/applications`), `articles`, `classes`, `enrollments`, `entitlements`, `orders` (rewritten), `manual-payments`, `creator-earnings`, `wallets`, `payouts`, `refunds`, `ledger`, `ai-credits`, `learning-events` (event bus + consumers), `gamification` (UniverseEngine), `memory`, `recommendations`, `audit`, `admin`, `analytics`, `internal` (service-to-service contract). Existing curriculum, quiz, chat, learning modules stay.

Cross-cutting: `TenantContext` (resolved from membership, never from a client-supplied id), central `PolicyService` for the access matrix, `DomainError` catalog (§86 of the prompt), `Money` value object on `Decimal`.

## 4. Data scope classification (starting matrix)

| Entity | Scope | Read | Write |
|---|---|---|---|
| User, Session | PRIVATE USER | self, ADMIN | self (no role/isActive), ADMIN via `changeRole` |
| Tenant, TenantMembership, TenantSettings | TENANT | members, ADMIN | OWNER/MANAGER, ADMIN |
| ArticleProduct, ClassProduct, ClassSession, ArticleVersion | TENANT | tenant members; public when `PUBLISHED` and tenant `ACTIVE` | tenant members via intent endpoints |
| Entitlement, ClassEnrollment | USER (+ tenant aggregate) | owner; tenant aggregates | services only |
| Order, OrderItem, ManualPaymentSubmission | PRIVATE USER | buyer, ADMIN | buyer (create/submit), ADMIN (review) |
| CreatorEarning, Wallet, PayoutRequest | TENANT | tenant OWNER/MANAGER, ADMIN | services; ADMIN for payout review |
| Ledger entries (commerce, AI credit) | GLOBAL, append-only | owner/ADMIN | services only |
| AICreditPackage | GLOBAL | all | ADMIN |
| AICreditWallet, AICreditLedgerEntry | PRIVATE USER | owner, ADMIN | services only |
| LearnerGoal, Mastery, Misconception, Preference, Memory | PRIVATE USER | owner, ADMIN | services only |
| LearningEvent | PRIVATE USER (+ tenant for creator analytics as aggregate) | owner, ADMIN | event ingestion service |
| Universe, World, QuestDefinition, AchievementDefinition, RewardRule | GLOBAL | all | ADMIN |
| UserUniverseState, UserQuest, UserAchievement, GamificationLedger | PRIVATE USER | owner, ADMIN | UniverseEngine only |
| AuditLog | GLOBAL | ADMIN | append by services |
| Episode, DecisionTrace, PromptVersion, PolicyVersion | GLOBAL / PRIVATE USER | ADMIN; owner for own episodes | ai pipeline; version changes need human approval |

## 5. Phased plan with entry and exit gates

Each phase: inspect, design, change, test, verify. Nothing in a later phase starts until the prior exit gate passes.

| Phase | Scope | Exit gate |
|---|---|---|
| 1a | Baseline repair: jest `@/` alias, seed type errors, failing quiz spec, install Python dev deps and run pytest | `pnpm test`, `tsc --noEmit`, `uv run pytest` green (or failures explained and tracked) |
| 1b | Close S1–S6: user PATCH/role, orders, applications, IDOR sweep on CRUD controllers, cookie secret, disable Stripe webhook | Role/ownership tests for every guarded route; no route reachable without an explicit policy |
| 1c | Tenant primitives, `TenantContext`, `PolicyService`, `AuditLog`, `DomainError` | Tenant isolation tests pass; migration applied on clean and seeded DB |
| 2 | Articles, classes, versioning, marketplace read, entitlement-gated content API | Free/premium access tests; published-only marketplace |
| 3 | Orders, manual payment, entitlement, state machines, idempotent approval | Double-approval and concurrency tests produce one effect |
| 4 | Wallet, earnings, ledger, payouts, refunds | Financial invariants (§80) tested |
| 5 | AI credits: packages, wallet, ledger, reserve/settle/release | Concurrent-spend test; no negative balance |
| 6 | `LearningEvent` v2 (idempotent) + consumers; learner style model; memory policy | Duplicate-event and memory-isolation tests |
| 7 | Agent runtime in `ai-api`, tool registry, budgets, service identity, RAG filters, quarantine pipeline | Tool permission, budget, injection tests |
| 8 | UniverseEngine and `/gamification/me` | Reward-once, no-farming tests |
| 9–11 | Admin, teacher, learner UI in Nuxt with role middleware; analytics and circularity metrics | Route guard tests; backend independently enforces |
| 12 | Full E2E (prompt §98) and security acceptance (§99) | Scenario passes on the running Docker stack |
| 13 | Loop B/C readiness only | Docs and schema, no autonomous deployment |

## 6. Migration rules applied

Additive first: new tables, backfill jobs, dual-read where needed, switch, then deprecate columns in a later migration. Each migration is run on a clean database and on the seeded database before merging. Nothing under `prisma/migrations/` is edited after it has been applied anywhere.

## 7. Repository rule conflicts to respect

- `AGENTS.md`: no code comments, no `git add/commit/push`; I report changed files and you stage.
- Prompt: no new microservices, single Nuxt frontend, `ai-api` without Postgres access. All consistent with the plan above.
- The "known violation" `embeding.ts` must be migrated before any new LLM-dependent feature in `api`; recommendation lookup and content embedding will be routed through `ai-api` endpoints.

## 8. Deliverables tracking (prompt §103)

A–C are covered by `CURRENT_STATE.md` and this file. D–T are produced per phase into `docs/architecture`, `docs/business`, `docs/data`, `docs/system`, `docs/decisions` (ADR-001 to ADR-007), and `docs/testing`. U–W are produced at Phase 12 from real runs.
