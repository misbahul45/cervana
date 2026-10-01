# Current implementation audit

> Date: 2026-09-30. Verified against source (not against earlier documents): `services/api/src`, `services/api/prisma`, `services/ai-api`, `apps/web`, compose files. Where an earlier document disagrees with this one, this one wins.
> Method: file inventories, Prisma schema read in full, a script that maps every model to the application code that touches it, route metadata extracted at runtime, test runs (`30 suites / 607 tests` with a database), an end-to-end run against the built API.

## 1. Inventory

| Area | Count | Note |
|---|---|---|
| API modules / controllers / services / repositories | 62 / 48 / 61 / 32 | `services/api/src` |
| HTTP routes | 195 | every route has an explicit access decision (ratchet test); see [AUTHORIZATION_MATRIX](./AUTHORIZATION_MATRIX.md) |
| Prisma models / enums / migrations | 80 / 45 / 11 | zero drift on a clean database |
| Jest suites / tests | 30 / 607 | 554 pass and 53 skip without a database, all pass with one |
| AI service routes | 6 | `/ai/resources/extract`, `/resources/embedding/{id}`, `/learning/generate-material`, `/learning/chat`, `/users-steps/generate-question`, `/users-steps/generate` |
| Web pages | 26 | learner only (`learn/*`, `my-learning/*`, auth). No marketplace, teacher or admin page |
| BullMQ processors | 3 | `content`, `knowledge`, `user-steps` |

## 2. The schema against the baseline in the brief

Every model the brief lists as baseline exists. Seven models exist that the brief does not list: `PersonalityQuiz`, `LearningStyleProfile`, `DailyStats`, `Notification`, `Resource`, `Theme`, `ThemeIcon`. `DomainEvent` exists (added in Phase 3). Missing from the schema, and required by the brief's target: `AICreditReservation`, `AICreditPurchase` (if needed), `Universe`, `World`, `QuestDefinition`, `UserQuest`, `UserUniverseState`, `RewardRule`, `GamificationLedger`.

### Which models application code actually touches

| State | Models |
|---|---|
| Wired (read or written by non-test code) | User, Session, VerificationToken, TeacherApplication, TeacherExperience, Certification, Category, Topic, SubTopic, Lesson, PersonalityQuiz, Step, UserStep, UserTopic, LearningStyleProfile, SubTopicProgress, LessonProgress, StepProgress, Quiz, Question, QuizAttempt, Answer, Chat, ChatMessage, Content, StreakHistory, DailyActivityLog, LeaderboardScore, Notification, Order, OrderItem (nested create), Resource, Theme, ThemeIcon, IdempotencyKey, TopicMasteryRecord, AuditLog, Tenant, TenantMembership, Article and ClassProduct (read by the order catalog only), Entitlement, ManualPaymentSubmission, PaymentIntent, PaymentTransaction, DomainEvent, CreatorEarning, LedgerTransaction |
| Schema only, no code | Achievement, UserAchievement, DailyStats, LearnerGoal, StepMasteryRecord, Misconception, LearningPreference, BehavioralSignals, EpisodicMemory, SemanticLearnerMemory, ProceduralMemory, LearningEvent, Episode, InteractionEvaluation, PromptVersion, PolicyVersion, Experiment, ExperimentRun, EvaluationDataset, OptimizationRun, DecisionTrace, TeacherOverride, TenantSettings, ArticleVersion, ClassSession, ClassEnrollment, Wallet, PayoutRequest, Refund, AICreditPackage, AICreditWallet, AICreditLedgerEntry |

Consequence: 32 of the 80 tables have no writer. The whole learner model, memory, agent observability, optimisation, creator wallet/payout/refund and AI credit domains exist only as tables.

## 3. Flow by flow, as the code behaves today

| Flow | Reality |
|---|---|
| Auth and roles | JWT access and refresh cookies, Google OAuth, sessions table. Global guards run `JwtAuthGuard`, `RolesGuard`, `OwnershipGuard`. Global roles `STUDENT`, `TEACHER`, `ADMIN` (the brief agrees to keep `STUDENT`). Role change only through `POST /users/:id/role` |
| Teacher application to tenant | Working (Phase 1): submit, edit while pending, admin approve or reject, approval upgrades the role and provisions a tenant with an `OWNER` membership in one transaction, audited. `TenantSettings` is never created, so `payoutInfo` has no writer |
| Tenant context | `@TenantScoped`, `TenantGuard`, `TenantContextService`. The `x-tenant-id` header only selects among the caller's own active memberships. No tenant-owned content service uses it yet |
| Article | Schema only. No controller, service, repository, moderation or marketplace listing. `ArticleVersion` has no writer. The order catalog can read a published article |
| Class | Schema only. No controller or service. `ClassEnrollment` has no writer, so capacity is unenforced. `ClassSession.meetingUrl` and `recordingUrl` are private material with no access gate |
| Order and payment | Working (Phase 3): provider-agnostic `PaymentIntent`, manual provider, admin review, transactional approval, `PaymentVerified` event, fulfilment. Prices from the database. Topics, articles, classes are sellable |
| Fulfilment and creator economy | Entitlement, `CreatorEarning` (`PENDING`), and three ledger entries per tenant item are written on approval. Nothing moves an earning into a wallet, and `Wallet`, `PayoutRequest`, `Refund` have no code |
| AI credits | Tables only. No package endpoint, purchase, reward, reserve, settle, spend or adjustment. `AICreditWallet.reserved` is a counter with no reservation identity |
| AI service | FastAPI with LangGraph pipelines for material and quiz generation and RAG chat. It forwards the user's bearer token to user-facing API endpoints for chats, contents, curriculum, learning styles and personality quizzes (only the resource flow uses signed service auth). No agent runtime, tool registry, execution budget, credit accounting or trace writer |
| Learner model | Only `TopicMasteryBackfillService` (admin backfill). No deterministic mastery update, no misconception lifecycle, no preference evidence. `QuizEvaluationService` scores attempts but does not feed the learner model |
| Memory | `utils/tools/memory.py` uses a Qdrant memory collection keyed by user and lesson. The three Postgres memory tables have no writer, so there is no write policy and no tenant filter |
| Learning events | `LearningEvent` has no writer |
| Gamification | Dormant. `ActivityDetectorInterceptor` is never registered and its `intercept` never calls `detect`; `StreakService.recordLearningEvent` has no caller; nothing writes `User.totalPoints`, `souls`, `stars` or the streak counters. `Achievement` and `UserAchievement` have no code. Leaderboard and streak endpoints read tables nothing fills |
| Uploads and RAG ingestion | Cloudinary upload (images and PDFs, ownership by file prefix). `Resource` ingestion goes through `ai-api` with an allow-list that admits loopback only. There is no quarantine or review state before RAG. Any `TEACHER` can create and read any resource |
| Web | Nuxt 4, SSR. Middleware only distinguishes logged in from public. No role-aware layout, no marketplace, no teacher area, no admin area, no checkout. The order page reads the deprecated `order.amount` |
| Infra | Compose dev has no `celery-worker` (subprocess started from `main.py`); prod has one. The former Gemini call in `api` (`common/lib/embeding.ts`) had no callers and was deleted on 2026-09-30. Replay cache for signed internal requests is in memory |

## 4. Authorization as implemented

| Control | State |
|---|---|
| Routes with an access decision | 195 of 195; a test fails the build otherwise |
| By kind | Public 15, Service 2, Role 57, Tenant 2, Owner 68, Own rows 17, Authenticated 34 |
| Ownership registry | 22 resource types including `payment-intent`. Admin bypasses; `UNOWNED` for global rows |
| Curriculum writes | `TEACHER` may create topics; lessons, steps, subtopics, quizzes, questions and resources accept any `TEACHER` or `ADMIN` with no per-author check (`Topic.createdBy` is stored, not enforced) |
| Tenant checks | Only in the tenant endpoints. Nothing yet checks "active membership and active tenant" before a content mutation because no content service exists |
| Payment authority | Admin only, transactional, idempotent, audited. Removed: every order-level status mutation |
| Service-to-service | HMAC-signed `/internal` routes for resources. Other AI calls still use the user token |

## 5. Broken paths, legacy paths, duplication

| # | Finding | Evidence | Effect |
|---|---|---|---|
| 1 | `Wallet` is unique on `(tenantId, currency)` | `schema.prisma` `model Wallet` | Two creators in one tenant cannot each have a wallet; the second would collide or, worse, share the first |
| 2 | Ledger has no direction; `payoutId`, `refundId`, `earningId` are plain strings | `model LedgerTransaction` | Sign of money is implied by category; references can dangle |
| 3 | Wallet balance is a mutable column | `model Wallet.balance` | Nothing but convention stops a direct update |
| 4 | `Order.user` and `Order.topic` cascade on delete | `model Order` | Deleting a user or topic can delete financial history for orders without items |
| 5 | Order money is duplicated: `amount Float` next to `subtotal/platformFee/total Decimal` | `model Order` | Float money is still writable and the web page reads it |
| 6 | `snapToken`, `gateway`, `topicId` on `Order` | `model Order` | Gateway-era fields and a Topic shortcut coexist with the canonical `OrderItem` |
| 7 | Topic is sold through the marketplace code path | `order-catalog.service.ts`, `entitlements.service.ts` | Topic is an accidental second marketplace product |
| 8 | `Article.publishedVersionId` and `ArticleVersion.createdById` have no foreign key | `model Article`, `model ArticleVersion` | A published pointer can name a version of another article or nothing |
| 9 | `OrderItem` can reference only article, class or topic | check `OrderItem_exactly_one_product` | AI credit packages cannot go through the commerce pipeline |
| 10 | Streak and points engine is dead code | section 3, Gamification | No learner earns anything today |
| 11 | `TenantSettings` never created | `tenant-provisioning.service.ts` | Payout destination has nowhere to live |
| 12 | Any `TEACHER` edits any lesson, step, quiz, resource | section 4 | Cross-teacher tampering |
| 13 | `api` called Gemini directly (resolved 2026-09-30: file had no callers and was deleted) | `common/lib/embeding.ts` | Breaks the API/AI boundary |
| 14 | AI calls forward user tokens for reads and writes of learning data | `services/ai-api/v1/*/service.py` | Partly migrated (ADR-007) |
| 15 | Celery worker started as a subprocess in dev | `services/ai-api/main.py` | Dev and prod differ |
| 16 | Stripe variables remain in `.env.example` and compose | env files | Unused |
| 17 | `DailyStats`, `Achievement`, `UserAchievement` unused | section 2 | Dead schema |
| 18 | Integration tests commit rows that append-only tables cannot clean | `payment-flow.int.spec.ts` | Scratch databases only |

There is no duplicated commerce, article, class, tenant or AI credit model to merge: each of those exists once, and the audit found no second order, article, class, tenant or wallet entity.

## 6. The brief against the code

| Brief section | Status |
|---|---|
| 1 Baseline schema | Matches, see section 2 |
| 3, 4, 21 to 26 Manual payment, provider abstraction | Done (Phase 3). Endpoint names differ from section 75 of the brief and are aligned in the commerce phase |
| 7 Order reconciliation | Open: legacy Float and cascade, Phase 1 of this run |
| 8 Topic commerce legacy | Open: isolate |
| 9 Wallet fix | Open |
| 10, 11 Ledger direction and foreign keys | Open |
| 12 Financial invariants | Partly: earning arithmetic, positive amounts, one approved payment. Open: wallet non-negative through the ledger, payout and refund bounds |
| 13 Entitlement invariants | Done (check constraints) |
| 14 to 16 Article service and marketplace | Not started |
| 17, 18 Class service and capacity | Not started |
| 19, 20 Order model, price snapshot | Order model done; snapshot immutability not enforced by the database |
| 27 Admin payment UI | Backend done, no UI |
| 28 to 30 Creator economy, payout | Earning done; wallet, payout not started |
| 30 Refund | Not started |
| 31 to 38 AI credits | Not started |
| 39, 40 Learning events | Table only |
| 41 to 47 Gamification universe | Not started; legacy engine dead |
| 48 to 56 Learner model, memory, RAG trust | Tables and prompt segmentation helper only |
| 57 to 65 Personal agent, self-improvement | Not started |
| 66 to 74 Tenant, authorization, service auth, upload security | Done for identity and tenant provisioning; content-level tenant checks arrive with the content services |
| 76 to 82, 105 to 109 Single web app | Not started |
| 87 to 88 Audit and domain events | Audit done; events done for payment |
| 89 to 92 Constraints, decimal, integer credits | Most done; see the reconciliation document |
| 95 Seed | Not started |
