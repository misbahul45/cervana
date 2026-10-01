# CURRENT_STATE

> **Phase 1 has since changed much of this. See [PHASE_1_REPORT](./PHASE_1_REPORT.md); this file describes the code as it was before Phase 1.** Corrections found later are listed in section 19.
>
> Phase 0 audit of the actual source tree. Audit date: 2026-09-30. Ground truth is code; existing docs were treated as input only.
> Method: file/route/schema inspection, `pnpm test`, `tsc --noEmit`, plus the `codebase-memory-mcp` graph (project `home-misbahul45-code-reducera`, 4,526 nodes / 14,740 edges) for caller/writer tracing, cross-checked with grep. Graph limits: 5 files parse-partial (`topic-mastery-backfill.service.ts` line 18, nginx and SQL configs, one CSS file); graph `Route` nodes are HTTP client calls, not server routes, so the API route inventory comes from controllers. Not verified at runtime: Docker stack, Postgres migrations, AI service tests (see §14).
> Detection greps from `AGENTS.md` were re-run: the only LLM call in `services/api` is `common/lib/embeding.ts` (other hits are Google OAuth); `ai-api` has no `DATABASE_URL` in compose or code.

## 1. Directory map

| Path | Role |
|---|---|
| `services/api/` | NestJS 11 API, Prisma 7 schema (1214 lines, 6 migrations), `src/v1/*` feature modules, `src/common/*` |
| `services/ai-api/` | FastAPI app (`main.py`), `v1/{learning,resources,users_steps}`, `config/`, `utils/tools/` |
| `apps/web/` | Nuxt 4 app: pages `(auth)`, `learn/*`, `my-learning/*`; Pinia stores `auth`, `learning`; `services/*` API clients |
| `nginx/`, `postgres/`, `qdrant/` | infra config |
| `docker-compose.yml`, `docker-compose.prod.yml` | dev / prod stacks |
| `docs/` | planning docs; audit/plans/operations dirs renamed in working tree (uncommitted) |

No admin frontend exists (README and `ADMIN_URL` env refer to one that is absent). Single Nuxt app already, which matches the target.

## 2. Tech stack

NestJS 11, Prisma 7 + `@prisma/adapter-pg`, Zod 4 DTOs (`ZodPipe`), BullMQ + ioredis, Socket.IO and SSE controllers, Passport (JWT, Google), Arcjet `shield`, Cloudinary uploads, Resend email. Python 3.11, FastAPI, Celery, LangChain/LangGraph, LlamaIndex, Qdrant, `langchain-openai` (OpenAI-compatible LLM), Hugging Face Inference (embeddings), Tavily, Whisper. Nuxt 4, Nuxt UI, Pinia, TanStack Query.

## 3. Database model (Prisma)

Groups: identity (`User`, `Session`, `VerificationToken`); teacher (`TeacherApplication`, `TeacherExperience`, `Certification`); curriculum (`Category`, `Topic`, `SubTopic`, `Lesson`, `Step`, `PersonalityQuiz`); progress (`UserTopic`, `UserStep`, `SubTopicProgress`, `LessonProgress`, `StepProgress`, `LearningStyleProfile`); quiz (`Quiz`, `Question`, `QuizAttempt`, `Answer`); chat/content (`Chat`, `ChatMessage`, `Content`, `Resource`); gamification (`StreakHistory`, `DailyActivityLog`, `Achievement`, `UserAchievement`, `LeaderboardScore`, `DailyStats`, `Theme`, `ThemeIcon`, `Notification`); commerce (`Order`); infra (`IdempotencyKey`); learner model + AI (`LearnerGoal`, `TopicMasteryRecord`, `StepMasteryRecord`, `Misconception`, `LearningPreference`, `BehavioralSignals`, `EpisodicMemory`, `SemanticLearnerMemory`, `ProceduralMemory`, `LearningEvent`, `Episode`, `InteractionEvaluation`, `PromptVersion`, `PolicyVersion`, `Experiment`, `ExperimentRun`, `EvaluationDataset`, `OptimizationRun`, `DecisionTrace`, `TeacherOverride`).

Absent entirely: Tenant, TenantMembership, ArticleProduct, ClassProduct, ClassSession, ClassEnrollment, Entitlement, OrderItem, ManualPaymentSubmission, CreatorEarning, Wallet, PayoutRequest, Refund, ledger, AICredit*, Universe/World/Quest/RewardRule, AuditLog, AgentVersion.

Key facts:
- `User.role` enum is `STUDENT | ADMIN | TEACHER` (target prompt says USER; see TARGET_STATE decision D1).
- Gamification counters live on `User` (`totalPoints`, `souls`, `stars`, `currentStreak`, `longestStreak`).
- `Order`: one `topicId`, `amount Float`, `status PENDING|PAID|FAILED|REFUNDED`, `snapToken`, `gateway`, `@@unique([userId, topicId, status])`. Money is `Float`.
- `Topic.price` gates paid access; `UserTopic.accessType` records FREE/PAID.
- `LearningEvent` is `{userId, eventType String, payload Json, createdAt}` with no idempotency key, no tenant, no entity reference.
- `Episode` and `DecisionTrace` exist with `costUsd Decimal`; no code writes to them (grep found no writers in `src`).
- `LearningPreference` has 4 nullable strings, no confidence/evidenceCount. Memory models have `MemoryStatus` lifecycle matching the target.
- Migrations: `20251202032210_final_db`, `20251202230940_final_db`, `20260115090000_idempotency_key`, `20260115100000_domain_model`, `20260115110000_content_job_fields`.

## 4. API map

Global prefix `/api/v1`, Swagger at `/api/v1/docs`. About 38 controllers, mostly generic CRUD: `auth`, `users`, `categories`, `topics`, `subtopics`, `lessons`, `steps`, `quizs`, `questions`, `quiz-attempts`, `answers`, `chats`, `chat-messages`, `contents`, `resources`, `user-topics`, `user-steps`, `lesson-progresses`, `subtopic-progresses`, `step-progresses`, `learning-styles`, `personality-quizzes`, `streaks`, `daily-logs`, `leaderboards`, `themes`, `notifications`, `orders`, `webhooks/stripe`, `applications`, `certifications`, `experiences`, `uploads`, `learner-model/backfill/topic-mastery`, and 9 `*-sse` controllers.

Pattern: `POST /x`, `GET /x`, `GET /x/:id`, `PATCH /x/:id`, `DELETE /x/:id` per table. No business-intent endpoints, no state-transition endpoints.

## 5. Auth model

- Global `APP_GUARD`s: `JwtAuthGuard` then `RolesGuard` (`app.module.ts`). `@Public()` opts out; `@Roles(...)` restricts. Default is authenticated-only.
- `RolesGuard` allows everything when no `@Roles` metadata exists. Only 6 of about 38 controllers reference `@Roles`/`UseGuards`/`@Public` (topics, categories, resources, users (create only), learner-model, auth).
- JWT access/refresh, cookie-parser with `COOKIE_SECRET` (falls back to literal `'your-secret-key'` if unset, `main.ts`), Google OAuth, email verification.
- Arcjet `shield` global; no per-route rate limits found in API.
- CSRF: cookie auth in use; no CSRF middleware found.
- CORS allow-list includes hard-coded `https://cervana.vercel.app`, `localhost:3000/3001`.

## 6. Role model

Single global role on `User`. No tenant role, no membership, no tenant context on requests. `TeacherApplication.status` is `PENDING|APPROVED|REJECTED` (target needs 7 states).

## 7. Ownership model

`OwnershipGuard` exists (`v1/common/guards/ownership.guard.ts`) for `chat`, `content`, `user-step`, `message`; owner or ADMIN passes. Declared resource type `lesson-progress` has no fetcher (falls to `default: null` → always forbidden). Used by 2 chat controllers (2 guard references). All other per-user CRUD controllers (progress, quiz attempts, answers, orders, notifications, daily logs, user-topics, user-steps) have no ownership check and take `:id` from the URL.

## 8. Payment / commerce model

- `OrdersService.create`: single topic per order; price 0 → order `PAID` immediately with gateway `manual` and a `UserTopic` FREE row; otherwise `PENDING`, gateway `stripe`, and `snapToken` is a hard-coded literal string. Currency conversion hard-coded (`supportsIDR = false`, rate 16726) and amount computed in USD cents for a column named `amount Float` with default currency IDR.
- `StripeWebhookController` (`POST /webhooks/stripe`): no `@Public`/signature verification, event object is a stub `{type:'payment_intent.succeeded'}`, then reads `event.data.object` (undefined → throws). Latent forgery path if the stub is replaced without adding signature verification.
- `OrdersController`: `GET /orders` and `GET /orders/:id` return any order; `PATCH /orders/:id` accepts `any` body and updates any order (including `status`); `DELETE` unrestricted. Any authenticated user can mark any order PAID.
- No entitlement, earning, wallet, payout, refund or ledger exists. Paid access is inferred from `UserTopic`.

## 9. AI architecture

- `ai-api` exposes 3 routers under `/ai/v1`: `learning` (`/generate-material`, `/chat`), `users-steps` (`/generate-question`, `/generate`), `resources` (`/extract`, `/embedding/{id}`).
- Endpoints read `Authorization` header, strip `Bearer`, and forward the raw token to `api` via `requests` (`NEST_API`). The AI service never validates the token itself; it depends on `api` rejecting bad tokens on the forwarded call. There is no service identity.
- No DB access from `ai-api`: no `DATABASE_URL`, no Prisma/SQLAlchemy found. Boundary is respected in this direction.
- LLM calls live in `ai-api` through an OpenAI-compatible endpoint; embeddings are computed by Hugging Face Inference (`services/ai-api/config/providers.py`). The former direct Gemini call in `api` was deleted on 2026-09-30.
- Pipelines: `content_pipeline.py`, `generate_quiz_pipeline.py`, `generate_user_steps_pipeline.py` (LangChain/LangGraph). There is no agent runtime, tool registry, step/tool-call budget, or credit reservation.
- `main.py` spawns a Celery worker via `subprocess.Popen` on FastAPI startup; the dev compose has no `celery-worker`; the prod compose has one. Two execution models.
- `main.py` CORS uses `ADMIN_URL`/`WEB_URL` only.

## 10. RAG

`v1/learning/service.py:94`: `pipeline.retrieve(query, metadata_filter={"source": "material"}, top_k=10)`. No tenant, publication status, content id, or entitlement filter. `Content` has `jobStatus` and embedding fields (latest commit) but no publication/quarantine lifecycle. `Resource` ingestion accepts arbitrary URLs subject to `config/url_allowlist.py` (has tests).

## 11. Memory

- Qdrant collection `reducera-memory` via `MemoryManager` (`config/memory_embedding.py`) with `userId` and `memory_type` metadata filters (per-user isolation at retrieval).
- `utils/tools/memory.py`: `tool_semantic_search` filters by lessonId after retrieving by user; a fallback variant returns cross-lesson items (logs a warning).
- Prisma has typed memory tables (`Episodic`, `SemanticLearner`, `Procedural`) with `MemoryStatus`. Nothing writes them: the only Prisma write to any learner-model/AI table in `services/api/src` is `topicMasteryRecord.upsert` in `topic-mastery-backfill.service.ts` (graph query plus grep). No write policy and no TTL job exist.
`config/prompt_segmentation.py` provides prompt segmentation (`segment_retrieved`, `build_segmented_prompt`, used by `content_pipeline.generate_material`) and an instruction-injection detector (`looks_like_instruction`, `find_instruction_injection`, with tests). The detector has no production caller: it is not applied to memory writes or retrieved chunks.

## 12. Gamification

- Streak: `ActivityDetectorInterceptor.detect()` writes a `DAILY_LOGIN` `DailyActivityLog` and increments streak on the first authenticated request of a day (request-driven, not learning-driven). `intercept()` currently does not call `detect()`, so it is inactive. `StreakHistory @@unique([userId,date])` gives DB-level daily uniqueness. `common/streak/streak.service.ts` has `recordLearningEvent(StreakEvent)`, which has no callers (graph `trace_path` and grep), so no streak is being awarded at all right now.
- Achievements: `Achievement` / `UserAchievement @@unique([userId, achievementId])`. `LeaderboardScore`, `DailyStats`, `Theme`, `ThemeIcon`.
- No Universe/World/Quest/RewardRule/ledger. Points, souls, stars are mutable counters on `User`.
- Gamify controllers (`streaks`, `daily-logs`, `leaderboards`, `themes`) have no role or ownership guard; `daily-logs` exposes `POST`, `PATCH`, `DELETE`.

## 13. Frontend

- Routes: `/`, `(auth)/{login,register,forgot-password,verify-email}`, `/learn/*` (gamify, profile, topics), `/my-learning/*`, catch-all.
- `middleware/auth.global.ts` handles only authenticated vs anonymous. `role` is typed in `interfaces/auth.ts` but no route checks it. No `/admin`, `/teacher`, `/marketplace`, `/articles`, `/classes`, `/credits`, `/orders` pages (there is an `order` service client).
- Public pages list includes any path containing `/learn/topics` without `order`.

## 14. Tests, build, health (executed)

| Check | Result |
|---|---|
| `pnpm test` in `services/api` | 8 suites: 1 passed, 7 failed; 17 tests pass, 1 fails. Four suites (`ownership.guard`, `topic-mastery-backfill`, `streak.service`, `daily-activity.interceptor`) fail with `Cannot find module '@/…'` because the jest config in `package.json` has no `moduleNameMapper` for the `@/*` alias. `contents.controller.spec.ts` fails type-checking of its mocks; `idempotency.service.spec.ts` fails for a cause not yet diagnosed. `quiz-evaluation.service.spec.ts` has one real assertion failure (case-study threshold 60% vs free-text 70%). Only `roles.guard.spec.ts` passes. |
| `tsc --noEmit` in `services/api` | Fails only in `prisma/seed.ts` (4 errors) and in `contents.controller.spec.ts` mock typings. Application source under `src/` has no type errors. |
| `pytest` in `services/ai-api` | Not run. `pytest` not installed (`uv run pytest` fails: dev dependency group not synced; no `.venv`). Tests exist: `tests/test_main.py`, `config/__tests__/*` (4 files), `utils/tools/__tests__/test_memory.py`. |
| `nest build`, `nuxt build`, Docker stack, migrations on clean DB | Not run in this phase. |
| Web tests | None defined. |

## 15. Broken paths

1. Jest cannot resolve `@/` alias (7 suites dead).
2. Stripe webhook is a non-functional stub and unauthenticated.
3. `OwnershipGuard` `lesson-progress` resource declared but unimplemented.
4. `ActivityDetectorInterceptor.intercept` does not invoke `detect`.
5. `seed.ts` type errors.
6. `users.dto.ts` example role `"USER"` is not a valid enum value.
7. Order amount stored in USD cents in a `Float` column labelled for IDR.

## 16. Duplicated paths

- Two Celery start paths (subprocess in `main.py`, dedicated service in prod compose).
- Two learner-state homes: `User` counters/`StreakHistory` vs new `LearnerGoal`/mastery tables; `LearningStyleProfile` and `PersonalityQuiz` vs `LearningPreference`.
- `Content` embeddings (Postgres `Content`) vs Qdrant `reducera-embedding`.
- Embedding runs only in `ai-api`, via Hugging Face Inference (`BAAI/bge-m3`, 1024-dim by default).

## 17. Legacy modules and security gaps that block the V1 plan

| # | Finding | Severity |
|---|---|---|
| S1 | `PATCH /users/:id` and `GET /users`, `GET /users/:id`, `DELETE /users/:id` lack `@Roles`; `UpdateUserDto` includes `role`. `UpdateUserDto` is `baseUserSchema.partial()` (includes `role`) and `UsersService.update` spreads it into the row. Confirmed by code reading: any authenticated user can set any user's role, including their own to ADMIN. Runtime test to be added first in Phase 1. | Critical |
| S2 | `PATCH /orders/:id` unrestricted → arbitrary PAID; `GET /orders` lists all orders. | Critical |
| S3 | `applications` controller has no role guard; approval likely via `PATCH` status (state machine absent). | High |
| S4 | About 30 CRUD controllers rely on global JWT only; no ownership. IDOR across progress, attempts, notifications, daily logs. | High |
| S5 | Unauthenticated-by-design Stripe webhook without signature check. | High (latent) |
| S6 | Cookie secret fallback literal. | Medium |
| S7 | RAG has no publication/tenant filter; forwarded user JWT is the only AI→API auth. | Medium (grows with marketplace) |
| S8 | Memory fallback returns cross-lesson items. | Low |
| S9 | `docker-compose.yml` gives `api` a `DATABASE_URL` default containing a literal placeholder password (`change_me_strong_random_password_min_24_chars`); `AGENTS.md` forbids hard-coded secrets in compose. | Low |
| S10 | Browser calls `ai-api` directly through Nginx with the user's JWT (`apps/web/app/lib/ai.ts`, `NUXT_PUBLIC_AI_URL`) and `ai-api` does not verify tokens itself. Any new agent endpoint must verify auth before spending credits. | Medium |

## 18. Migration matrix (legacy → target)

| Subsystem | Decision | Notes |
|---|---|---|
| Auth (JWT, Google, sessions) | KEEP | Add tenant context and `TEACHER`/`ADMIN` checks on top; remove secret fallback. |
| Generic CRUD controllers | REFACTOR | Add ownership/role guards first; replace mutation-by-PATCH on sensitive tables with intent endpoints. |
| `OwnershipGuard` | REFACTOR | Complete resource types; add tenant scope; fix jest alias so its spec runs. |
| `Order` (single topic, Float) | MIGRATE | Additive: new `OrderItem`, Decimal money, new statuses; backfill existing rows; keep `topicId` until removed. |
| Stripe webhook / `snapToken` | DEPRECATE | Disable operational path; keep provider abstraction stub behind `ManualPaymentService`. |
| `UserTopic` (purchase access) | MIGRATE | Backfill `Entitlement` for existing PAID/FREE rows; keep `UserTopic` as progress. |
| `TeacherApplication` | REFACTOR | Extend status enum; add review actions; add tenant creation on approval. |
| Curriculum (`Topic`…`Step`) | KEEP | Not the marketplace product schema; article/class are new models. |
| Streak / daily activity | REFACTOR | Drive from `LearningEvent`; remove request-driven login streak. |
| `Achievement`, `LeaderboardScore` | KEEP + REFACTOR | Fold into event-driven engine; keep tables. |
| `User.totalPoints/souls/stars` | MIGRATE | Move to `UserUniverseState` + ledger; leave columns until cutover. |
| `LearningEvent` | REFACTOR | Add idempotency key, tenant, entity ref, unique constraint. |
| Learner model tables | KEEP | Add style attributes with confidence/evidence. |
| Memory tables + Qdrant memory | REFACTOR | Add write-policy service in `api`; wire ai-api to it. |
| LangGraph pipelines | KEEP + WRAP | Reuse retrieval/prompt pieces inside an agent runtime. |
| `Episode`, `DecisionTrace`, prompt/policy versions | KEEP | Wire writers. |
| `embeding.ts` in api | MIGRATE | Existing known violation. |
| Celery subprocess in `main.py` | REMOVE | Single canonical worker service in dev and prod. |
| Admin frontend | N/A | Does not exist; build `/admin` inside Nuxt. |

## 19. Corrections and findings added during Phase 1

- **S5 was overstated.** `StripeWebhookController` was never registered in any module, so the route did not exist. It is now registered as `410 Gone`.
- **Python tests can run** without the repo environment: `uv run --no-project --with pytest --with requests --with fastapi --with python-dotenv --with pydantic --with httpx pytest -q config/__tests__`. Before Phase 1: 45 passed, 11 failed. Among them a real SSRF hole in `url_allowlist.py` and a weak injection detector, both fixed. Remaining failures: 4 in `test_rate_limit.py` (the bucket starts full, so `burst` does not bound the initial allowance) and 4 in `test_embedding_pipeline.py` (need `llama_index`).
- **Zod 4 `.partial()` keeps `.default()`**, so 14 `Update*Dto` schemas reset fields on every partial update (for example `Topic.isVerified`, progress and attempt status). Fixed with `partialWithoutDefaults`.
- **`POST /learning/user-topics` let a learner grant themselves any paid topic**, and `UpdateUserTopicDto` also accepted `userId` and `topicId`.
- **SSE**: `SseJwtGuard` verified with `JWT_SECRET` (not configured anywhere) and every stream broadcast all users' events.
- **`PrismaService` logged query parameters**; `ai-api` printed JWTs and queued them in Celery arguments.
- **The dev database** (`reducera`) is empty, has 58 tables and no `_prisma_migrations` table, so `migrate deploy` needs a baseline first.
- **`schema.prisma` and the SQL migrations had drifted** (foreign keys without `ON UPDATE CASCADE`, missing index); reconciled by the first Phase 1 migration.
- **`docker-compose.yml`** contains a default `DATABASE_URL` with a placeholder password (unchanged).

## 20. Corrections and findings added during Phase 3

- **Payment is now its own domain.** `PaymentIntent`, `PaymentTransaction`, `ManualPaymentSubmission` (linked to the intent) and `DomainEvent` sit between the order and everything that reacts to a paid order. The order-level `approve-payment`, `reject-payment` and `refund` of Phase 1 are gone; see [PAYMENT_ARCHITECTURE](./PAYMENT_ARCHITECTURE.md) and [PHASE_3_REPORT](./PHASE_3_REPORT.md). The row for `Order` and `Stripe webhook` in section 18 is superseded: the webhook route is now `POST /webhooks/payments/:provider` and answers `501`.
- **`ManualPaymentSubmission`, `CreatorEarning`, `LedgerTransaction` and `Wallet` were empty tables** until this phase. Approval now writes the first three; wallets and payouts are still unused.
- **Legacy `Order` unique index `(userId, topicId, status)` was a latent bug**: a user could not have two cancelled orders for the same topic. Dropped; duplicate open orders are prevented in the order-creation transaction.
- **The web order page** (`apps/web/app/pages/learn/topics/[identifier]/order.vue`) only displays status, amount, gateway and paid date. There is no checkout, proof upload or admin queue in the UI.
- **Zod 4 `z.string().url()` accepts `javascript:` and `data:` URLs.** Any DTO that stores a URL should also constrain the scheme.
