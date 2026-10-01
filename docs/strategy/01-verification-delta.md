# Verification Delta — ReduCera baseline re-check

> **Status**: `stable` · **Owner**: `principal-architect` · **Last reviewed**: `2026-10-02`
>
> Replaces the 2026-09-30 baseline (S-01 to S-20) and the known contradictions (K-01 to K-12) with facts measured on commit `a868095` plus the uncommitted working tree; every later file in `docs/strategy/` cites this file instead of the older audits.

Evidence tags used in every row: `[VERIFIED: command or path:line]`, `[DOC-ONLY: doc path]`, `[CONTRADICTED: higher source vs lower source]`, `[ASSUMPTION: reason]`. Status words for baseline rows: `confirmed`, `changed`, `not found`. Capability labels follow `docs/STYLE-GUIDE.md` §2.1. New finding IDs use the prefix `VF-`; headline corrections use `HC-`.

---

## 1. Scope

| Item | Value |
|---|---|
| Repository state | HEAD `a868095` (2026-10-02); uncommitted: `apps/web/nuxt.config.ts`, `services/ai-api/conftest.py`, `services/ai-api/pyproject.toml`; untracked: `docs/repomix-output.xml`, two autoimport and two Q-02 superpowers files [VERIFIED: `git status --short`] |
| Method | Source read, `codebase-memory-mcp` (`index_status`, `check_index_coverage`, `trace_path` inbound) confirmed with `grep`, test runs without database env, a scratch route inventory outside the repo |
| Graph freshness | Index generation `2026-10-01T19:45:01Z`, `metadata_match` on all 10 cited service paths; `parse_partial` only on CSS, nginx, SQL and `topic-mastery-backfill.service.ts:18` [VERIFIED: `index_status`, `check_index_coverage`] |
| Not measured | Database behavior (no scratch database; the dev database `reducera` is untouched), live Qdrant collection size (stack down), browser checks (Playwright skipped: only `reducera_postgres` and `reducera_redis` run), `pnpm build` |
| Secrets | Env var names only. Presence in the root `.env` checked with `grep -q "^NAME=."`: `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `HF_TOKEN`, `HF_EMBEDDING_MODEL`, `EMBEDDING_DIM` set; `INTERNAL_AI_API_SECRET`, `MANUAL_PAYMENT_ACCOUNTS`, `PLATFORM_FEE_PERCENT`, `STRIPE_SECRET_KEY` empty or unset |

---

## 2. Headline corrections

| ID | Correction to the baseline | Tag |
|---|---|---|
| HC-01 | The API has 273 routes (265 HTTP decorators plus 8 SSE), all with an access decision, not 195. `AUTHORIZATION_MATRIX.md` still lists 195 and omits payouts, refunds, articles, classes, wallets, tutor, analytics | [VERIFIED: scratch inventory `routes.json`; `grep -rhoE "@(Get\|Post\|Put\|Patch\|Delete)\(" --include=*.controller.ts`] |
| HC-02 | Schema is 88 models, 48 enums, 17 migrations, not 80, 45, 11 | [VERIFIED: `grep -c '^model '`, `grep -c '^enum '`, `ls prisma/migrations`] |
| HC-03 | The money loop is built: per-owner wallet, payout request and review, refund request and review with earning reversal, ledger direction, DB guards. Earnings no longer stop at `PENDING` | [VERIFIED: `payouts.service.ts`, `refunds.service.ts`, `commerce-refund.service.ts`, `creator-earnings.service.ts:63-90`] |
| HC-04 | Article and class products exist: authoring, versions, moderation, marketplace read, enrollment with a capacity trigger, attendance | [VERIFIED: `v1/articles/*`, `v1/classes/*`, migration `20260930110000_class_capacity_and_attendance`] |
| HC-05 | A set of services is written, tested with mocks and not reachable: no Nest module provides them and no route calls them | [VERIFIED: `trace_path` inbound; module grep] (table in §10) |
| HC-06 | Three logic defects sit in that unwired code: `AiCreditsService.settle/release` update an append-only ledger; `MasteryService.update` saturates the score in one attempt; `AccountingSandboxService.postJournal` corrupts compound entries | [VERIFIED: VF-01, VF-02, VF-03] |
| HC-07 | `POST /tutor/message` exists but answers with a template; no LLM, no `ai-api` call, no credit reservation; the personal policy is never read from or written to storage | [VERIFIED: `tutor.service.ts:200-243,261`] |
| HC-08 | `ai-api` is unchanged (6 routes). Only the resources router (2 routes) validates the caller; the other 4 routes do not, and 3 of them enqueue Celery tasks that carry the raw bearer token | [VERIFIED: `v1/*/router.py`, `config/user_auth.py`] |
| HC-09 | Web has 34 pages, including marketplace (5) and order pay pages (3); middleware is still role-unaware; no admin or studio page | [VERIFIED: `find apps/web/app/pages -name '*.vue'`, `middleware/auth.global.ts:8-35`] |
| HC-10 | V1 tracks R, TD, TT, TU, TG, A, Q are partly done; none is DONE end to end (§7) | [VERIFIED: existence checks §7] |
| HC-11 | 161 of 416 relative links in `docs/**/*.md` are broken; 21 referenced files do not exist | [VERIFIED: link checker, §8] |
| HC-12 | `GET /metrics` is `@Public()` | [VERIFIED: `observability/metrics.controller.ts:10`] |
| HC-13 | `CREATOR_EARNING_HOLD_DAYS` defaults to 0 while `REFUND_WINDOW_DAYS` defaults to 7, so earnings release at fulfilment and can be withdrawn before the refund window ends; a refund after withdrawal fails with `409` | [VERIFIED: `commerce.config.ts:13-34`, `commerce-fulfillment.service.ts:66`, `commerce-refund.service.ts:61`] |
| HC-14 | Browser calls through nginx cannot reach the API: `location /api/` and `location /ai/` use `proxy_pass http://upstream/;`, which strips the matched prefix, while `api` serves under `/api/v1` and `ai-api` under `/ai/v1` | [VERIFIED: `infra/nginx/nginx.conf:124-125,139-140`; scratch nginx 1.29 container: `GET /api/v1/docs` reached the upstream as `/v1/docs`] |
| HC-15 | The new commerce and marketplace pages cannot work as written: 14 raw `$fetch('/v1/...')` calls use a relative URL without `/api` and bypass the shared request helper, and `pay.vue` calls three routes the API does not define | [VERIFIED: VF-20] |

---

## 3. Baseline S-01 to S-20

| ID | Baseline claim | Status | Corrected fact and evidence |
|---|---|---|---|
| S-01 | 195 routes; Public 15, Service 2, Role 57, Tenant 2, Owner 68, Own rows 17, Authenticated 34 | changed | 273 routes: Public 21, Service 2, Role 95, Tenant 20, Owner 68, Own rows 17, Authenticated 50; undecided 0. `route-access.spec.ts` passes [VERIFIED: scratch jest inventory, `pnpm jest` 65 suites]. Matrix doc is stale [CONTRADICTED: code vs `AUTHORIZATION_MATRIX.md:3-17`] |
| S-02 | 80 models, 45 enums, 11 migrations | changed | 88 models, 48 enums, 17 migrations; added `20260930100000_financial_hardening`, `110000_class_capacity_and_attendance`, `120000_payout_refund_guards`, `130000_theme_foundation`, `20261001090000_sub_topic_prerequisites`, `20261001100000_accounting_sandbox` [VERIFIED: `ls services/api/prisma/migrations`] |
| S-03 | 32 of 80 tables have no writer | changed | Of 88 models: 58 have a writer reachable through a registered module, 1 (`Misconception`) only in a method with no caller, 8 only in services without a module (`SandboxPeriod`, `SandboxTransaction`, `SandboxJournalLine`, `AICreditWallet`, `AICreditLedgerEntry`, `PromptVersion`, `EvaluationDataset`, `InteractionEvaluation`), 21 none: `SandboxAccount`, `SandboxScenario`, `SandboxAttempt`, `Achievement`, `UserAchievement`, `DailyStats`, `LearnerGoal`, `StepMasteryRecord`, `LearningPreference`, `BehavioralSignals`, `EpisodicMemory`, `SemanticLearnerMemory`, `ProceduralMemory`, `LearningEvent`, `PolicyVersion`, `Experiment`, `ExperimentRun`, `OptimizationRun`, `TeacherOverride`, `TenantSettings`, `AICreditPackage`. Now written: `Wallet`, `PayoutRequest`, `Refund`, `ArticleVersion`, `ClassSession`, `ClassEnrollment`, `Episode`, `DecisionTrace` [VERIFIED: model-to-writer script over `services/api/src`; `tenant-provisioning.service.ts:26` and `orders.service.ts:108` nested creates] |
| S-04 | Payments implemented; `PaymentVerified` drives entitlement, `PENDING` earning, three ledger entries; webhook `501` | changed | Same pipeline, plus `WALLET_CREDIT` posting and earning `AVAILABLE` at fulfilment when hold days is 0 (default). Webhook still `501` [VERIFIED: `commerce-fulfillment.service.ts:44-72`, `payment-webhook.controller.ts:5-16`] |
| S-05 | Commit `999bbb2` landed after the audit; status unknown | confirmed | Implemented: 10 payout routes (4 `TEACHER`, 6 `ADMIN`), 8 refund routes, state tables, partial unique indexes, tests exist but the 9 `*.int.spec.ts` suites skip without `TEST_DATABASE_URL` [VERIFIED: `routes.json`, `payout-state.ts`, `refund-state.ts`, migration `20260930120000_payout_refund_guards`, jest skipped list] |
| S-06 | Article and Class are schema only | changed | Authoring services, `CONTENT_TRANSITIONS` (`DRAFT`, `PENDING_REVIEW`, `PUBLISHED`, `REJECTED`, `SUSPENDED`, `ARCHIVED`), admin moderation, versions, marketplace read, entitlement-gated content, enrollment, attendance. Review is `ADMIN` only; no reviewer capability [VERIFIED: `marketplace/content-state.ts`, `articles/*`, `classes/*`, route inventory] |
| S-07 | AI credits are tables only; `OrderItem` admits article, class, topic only | changed | `AiCreditsService` implements `reserve`, `settle`, `release`, `topUp`, `ledger` but no module provides it and no route calls it. Constraint `OrderItem_exactly_one_product` unchanged [VERIFIED: `ai-credits.service.ts:52-141`, `trace_path` inbound: spec only, migration `20260930040500_domain_foundation:621`] |
| S-08 | Gamification dormant | confirmed | `ActivityDetectorInterceptor` is referenced only by its spec; `recordLearningEvent` has 0 callers; nothing writes `Achievement` or `UserAchievement` [VERIFIED: `trace_path` inbound, `grep -rn` in `services/api/src`] |
| S-09 | Learner model: only the backfill; `QuizEvaluationService` feeds nothing | changed | `TopicMasteryRecord` is still written only by `topic-mastery-backfill.service.ts:53`. New registered but unfed services: `MasteryService`, `MisconceptionLifecycleService`, `AdaptivePolicyService`, `PersonalPolicyService`, `QuestionUnderstandingService` (TutorModule). `QuizEvaluationService` callers: its spec only; client-writable attempt fields unchanged [VERIFIED: `tutor.module.ts`, `trace_path`] |
| S-10 | ai-api: 6 routes, linear pipelines, token forwarded except resources HMAC; no agent runtime | confirmed | 6 routes unchanged. `api` now writes `Episode` and `DecisionTrace` itself (`TutorService`), `ai-api` writes nothing back [VERIFIED: `v1/router.py:10-12`, `tutor.service.ts:240-296`] |
| S-11 | OpenAI-compatible LLM, HF embeddings, `EMBEDDING_DIM` 1024 | confirmed | Defaults `bge-m3`, 1024; `ensure_collection` raises on size mismatch. Code defaults for the two models (`gpt-4.1-mini`, `gpt-5-mini`, `config/envs.py:39-40`) differ from the benchmark choice, which lives only in `.env`. Live collection size: evidence missing [VERIFIED: `config/envs.py:47-52`, `config/vector_collections.py:12-18`; stack down] |
| S-12 | RAG filters `source = material` only; injection detector unused; no quarantine | confirmed | Filter at `v1/learning/service.py:94`; `find_instruction_injection` has no non-test caller; prompt segmentation is applied in `content_pipeline.py:152-199` but not in the chat prompt built at `service.py:88-155` [VERIFIED: grep, file reads] |
| S-13 | Browser calls ai-api directly with the user JWT | confirmed | `getAiApiUrl()` returns the public `AI_URL` in the browser; `requestAi` sends `Authorization` and `X-Refresh-Token` [VERIFIED: `apps/web/app/lib/ai.ts:9-13,25-40`] |
| S-14 | Web: 26 pages, no marketplace, studio, admin, checkout; middleware signed-in vs public; order page reads `order.amount` | changed | 34 pages. New: `marketplace/{index,articles/[slug],classes/[slug],creator/index,creator/earnings}`, `learn/orders/{index,[id]/pay,[id]/submitted}`. `learn/topics/[identifier]/order.vue` reads `order.total` and `payment.provider`; the new pages call wrong URLs and routes (VF-20). Middleware unchanged. `marketplace/index.vue:17` calls `/v1/marketplace-discovery/...` without the `/api` prefix [VERIFIED: `find`, `order.vue:108-109`, `auth.global.ts:8-35`] |
| S-15 | Theme layer: scales, `ThemeShell`, tokens, `OceanHero`, `BrandLogo`, proposer | confirmed | Files exist. API: `GET /gamify/themes/default` public, lifecycle intents (`submit-review`, `publish`, `suspend`, `archive`, `set-default`), `POST /gamify/themes/propose`. No `ETag` or `Cache-Control`; no `generate`; no admin theme page; no `ThemeBackground.vue`, `ThemePreview.vue` [VERIFIED: `themes.controller.ts:33-181`, existence checks §7] |
| S-16 | Golden graph, `SubTopicPrerequisite`, sandbox tables, engine with tests, SKKNI out of default seed | confirmed | 10 sub-topics in one linear chain (9 edges). 6 sandbox tables. Engine has validate, post, trial balance, close; no controller, no module, no HTTP route. `seed.ts` is 55 lines and holds no vocational content [VERIFIED: `seed-golden-graph.ts:25-170`, `routes.json`, `seed.ts`] |
| S-17 | Copy guard bans ten terms | confirmed | `copy.test.ts` bans the ten terms and passes (2 tests); scope is `apps/web/app` plus `nuxt.config.ts`, excludes tests and `constants/index.ts`. `sertifikasi` remains in `ai-api` prompts (`generate_quiz_pipeline.py:63,84,107`, `content_pipeline.py:171`); `REDUCERA` remains in `login.vue:13` and `register.vue:9` [VERIFIED: vitest, grep] |
| S-18 | Any `TEACHER` edits any lesson, step, subtopic, quiz, question, resource | confirmed | Unchanged: `@Roles(Role.ADMIN, Role.TEACHER)` on lesson, step, subtopic, quiz, question writes; `Topic.createdBy` comes from the request body (`topics.dto.ts:21`) [VERIFIED: `lessons.controller.ts:21,38`, `steps.controller.ts:24,44`, `subtopics.controller.ts:31,71`] |
| S-19 | Money-model defects | changed | See §3.1 |
| S-20 | Infra: Celery subprocess, in-memory replay cache, no scheduler, `STRIPE_*` unused, synchronous consumers | confirmed | `main.py:28-35` spawns Celery on every startup (also in prod, which has its own `celery-worker`). Replay cache `Map` at `internal-service.guard.ts:42`. No `Cron`, `ScheduleModule` or BullMQ repeat anywhere in `services/api/src`. `STRIPE_*` in `.env.example:43-44`, compose dev `:94-95`, prod `:129-130`. Consumers run in the publisher transaction (`commerce-fulfillment.service.ts:34-38`) [VERIFIED: grep] |

### 3.1 S-19 defect by defect

| Defect | State now | Evidence |
|---|---|---|
| Wallet unique on `(tenantId, currency)` | fixed: unique on `(ownerId, tenantId, currency)` | [VERIFIED: `schema.prisma:1965`] |
| Ledger without direction, plain-string references | fixed: `LedgerDirection`, foreign keys to payout, refund, earning, `reversalOfId`, direction and reference CHECKs | [VERIFIED: `schema.prisma` `LedgerTransaction`, migration `20260930100000_financial_hardening`] |
| Mutable `Wallet.balance` | guarded: `guard_wallet` trigger plus `apply_ledger_to_wallet` | [VERIFIED: migration `20260930100000_financial_hardening` triggers] |
| `Order.user` and `Order.topic` cascade | fixed: `RESTRICT` | [VERIFIED: same migration, `ALTER TABLE "Order" ADD CONSTRAINT ... RESTRICT`] |
| `Order.amount Float` | open: column kept, nullable, marked deprecated; web no longer reads it | [VERIFIED: `schema.prisma` `model Order`, `grep` in `apps/web/app`] |
| `snapToken`, `gateway` on `Order` | open: deprecated columns kept | [VERIFIED: `schema.prisma` `model Order`] |
| Topic sold through the marketplace path | open: `Order.topicId`, `OrderItem.topicId`, topic entitlement | [VERIFIED: `schema.prisma`, `entitlements.service.ts`] |
| `Article.publishedVersionId` without FK | fixed: FK `RESTRICT` plus `validate_article_publication` trigger | [VERIFIED: migration `20260930100000_financial_hardening:331-345`] |
| `OrderItem` cannot hold an AI credit package | open | [VERIFIED: migration `20260930040500_domain_foundation:621`] |
| `TenantSettings` never created, payout destination has no home | open: payout destination is a per-request JSON `destinationInfo` | [VERIFIED: `grep tenantSettings` empty; `schema.prisma` `PayoutRequest`] |

---

## 4. Commits since the audit

`CURRENT_IMPLEMENTATION_AUDIT.md` entered the tree in `d60d330`; `999bbb2` and `a868095` are the commits after it [VERIFIED: `git log --oneline -30`, `git show --stat`].

| Commit | Date | Subject | Added |
|---|---|---|---|
| `58e5cb9` | 2026-09-30 | Business flow docs, progress tracker, nginx | 103 files (+5959 −4177), docs and infra |
| `2f5f8f9` | 2026-09-30 | Circular economy model, service responsibility matrix | 54 files (+4590 −102), `standards-matrix.md` |
| `21dd464` | 2026-09-30 | `jobStatus` and embedding fields; `TopicMasteryBackfillService` | 13 files (+1074 −10), `schema-snapshot.spec.ts` |
| `edb5f42` | 2026-09-30 | Phased roadmap, self-improving LLM plan | 202 files (+11723 −2030), docs renamed from `0N-*` to plain names |
| `d60d330` | 2026-09-30 | Marketplace DTOs, articles, class enrollment, ledger, wallet, financial hardening | 56 files (+4641 −113); migrations `financial_hardening`, `class_capacity_and_attendance`; web order page |
| `999bbb2` | 2026-09-30 | Payouts and refunds | 35 files (+3732 −7); `classes/*`, `payouts/*`, `refunds/*`, `commerce-refund.service.ts`, migration `payout_refund_guards` |
| `a868095` | 2026-10-02 | Restructure to `apps/web`, `services/*`; theme; sandbox; prerequisites | 855 files (+17666 −5254), 618 pure renames; adds 65 files in `services/api`, 39 in `apps/web`, 14 superpowers docs, 6 in `services/ai-api`, 6 scripts; migrations `theme_foundation`, `sub_topic_prerequisites`, `accounting_sandbox`; modules `ai-credits`, `tutor`, `policy`, `evaluation`, `misconception`, `optimization`, `question-intelligence`, `sandbox`, `creator-analytics`, `observability` |

---

## 5. Capability inventory

| Capability | Status | Routes | Web pages | Tests |
|---|---|---|---|---|
| Auth, sessions, roles | implemented | 12 `/auth/*`, `/users/*` | 4 auth pages | `users`, `auth` specs |
| Teacher application, tenant provisioning | implemented | 6 applications, 3 tenants, 3 admin tenants | none | `applications.security.spec`, `tenant-provisioning.spec` |
| Curriculum CRUD | implemented (ownership gap S-18) | topics 5, subtopics 7, lessons 4, steps 5 | `learn/topics/*`, `my-learning/*` | none dedicated |
| Prerequisite graph | partial: model, seed, `PrerequisiteService` without module or route | 0 | 0 | `prerequisite.service.spec` (skipped, needs DB) |
| Learning progress, quiz attempts | implemented; scoring server-side not wired | 5 progress controllers, quiz 20 | `my-learning/*` | `user-topics.security.spec` |
| RAG chat, material generation (`ai-api`) | partial | `/ai/v1/learning/*`, `/users-steps/*` | `Chatbot.vue` | `config/__tests__` |
| Tutor endpoint (`api`) | partial: template reply, traces written | `POST /tutor/message` | none | `tutor.service.spec` |
| Mastery update, misconception lifecycle, adaptive policy | scaffolded: pure services, no persistence path | 0 | 0 | 3 service specs |
| LearningEvent, learner memory, preferences | scaffolded | 0 | 0 | none |
| Gamification (streak, daily log, leaderboard CRUD) | partial: `ADMIN` writes only; engine dormant | 12 | `learn/(gamify)/*` | none |
| Orders, payments (manual), entitlements | implemented | orders 4, payments 4, admin payments 7 | `learn/orders/*`, `order.vue` | `orders.security`, `payments.security`, `manual-payment.provider`, int specs (skipped) |
| Fulfilment, earnings, ledger, wallet | implemented | wallets 3 | `marketplace/creator/earnings.vue` | `money.spec`, `ledger-wallet.int.spec` (skipped) |
| Payout, refund | implemented (API only) | payouts 10, refunds 8 | none | `money.security.spec`, `payouts.int`, `refunds.int` (skipped) |
| Articles, classes, marketplace read | implemented (API) | articles 7+7+4, classes 11+7+9 | `marketplace/*` (5) | `articles.security`, `classes.security`, int specs (skipped) |
| Creator analytics, discovery recommendations | partial | 2, 1 | `marketplace/creator/index.vue`, `marketplace/index.vue` | 2 specs, 1 spec |
| AI credits | scaffolded: unwired, defect VF-01 | 0 | 0 | `ai-credits.service.spec` (mock) |
| Accounting sandbox | partial: engine, no route, defect VF-03 | 0 | 0 | `accounting-sandbox.service.spec` (mock) |
| Evaluation, frozen benchmark, optimization | scaffolded: no module, heuristic scoring (VF-05) | 0 | 0 | 2 specs |
| Themes (API) | implemented lifecycle, partial delivery | 15 under `/gamify/themes`, incl. `propose` | `ThemeShell`, `OceanHero`, `BrandLogo` | 7 theme specs, `theme-invariants.int` (skipped) |
| Themes (web layer) | implemented core, partial rollout (§7) | none | `app/theme/*` | `theme.spec` 19 tests |
| Service auth (HMAC) | partial: 2 `/internal` routes | 2 | none | `internal-signature.spec` |
| Metrics | partial: Prometheus registry, public route | 1 | none | `metrics.service.spec` |
| Role-aware web (studio, review, admin) | planned | n/a | none | none |

---

## 6. Contradictions K-01 to K-12

| ID | Winner | Assumption used in the plan | Decision |
|---|---|---|---|
| K-01 | Code and copy guard: university accounting, no minors flow, no certification claims [VERIFIED: `copy.test.ts:11-22`, `nuxt.config.ts:7-8`]. The owner memory note of 2026-09-30 says the product is generic with minors in scope [DOC-ONLY: auto-memory `reducera-product-direction`] | Segment A (university) until the owner decides; every minors-dependent item is gated | D-01, D-02, D-03 (owner-confirm first) |
| K-02 | Migration `20261001100000_accounting_sandbox` wins over `accounting-sandbox.md`: line-pair model (`debitAccountId`, `creditAccountId`, `amount`), no chart table, no entry status, no statements | Extend the implemented tables additively (`06-accounting-domain.md` §3) | none |
| K-03 | `PAYMENT_ARCHITECTURE.md` and code: provider abstraction, manual provider, webhook `501`, `PayoutRequest` table | The matrix at `service-responsibility-matrix.md:49,55` is regenerated in `10-target-architecture.md` | none |
| K-04 | Phase 3 report and this file: 0 failed API suites, 1043 tests, ratchet passes; the four `test_rate_limit` failures no longer occur | Gap analysis lists no closed gap | none |
| K-05 | Code: 1024 (`config/envs.py:52`, `.env.example:87`); `openai-migration.md` is `superseded` | 1024 | none |
| K-06 | `AGENTS.md` rule 5 is the written rule; ADR-007 is `proposed`; code implements signed identity for resources only | Target is ADR-007; `AGENTS.md` is not edited by this job | D-13 |
| K-07 | Neither. Both spellings are doc-only; no `AIAgentProduct` model exists [VERIFIED: `grep AIAgentProduct schema.prisma` empty] | Use `VALIDATING` (matches the transition table in `ai-agent-marketplace.md:90-103`) | D-09 |
| K-08 | `14-roadmap.md` replaces `phased-roadmap.md` (13 phases), `TARGET_STATE.md` §5, V1 tracks | One sequence, stages 0 to 7 | none |
| K-09 | Code: only `ADMIN` moderates articles and classes | Reviewer capability granted by `ADMIN`, enum stable | D-12 |
| K-10 | Code and ADR-001: global `TEACHER` plus tenant `OWNER`; copy guard bans "Menjadi Guru" | Public name "Jadi Kreator"; role enum unchanged | D-04 |
| K-11 | `circular-economy-model.md` §9 (anti-patterns) over §2.3 (earn from quiz streaks) | Earn rules need caps and a non-farmable trigger | D-06 |
| K-12 | Code: curated golden graph with prerequisites | AI sequences inside the graph; it does not invent curriculum | none |

---

## 7. V1 execution tracks

Item status: `DONE` = artifact present and covered by a test run now; `PARTIAL` = artifact present, verify step not run or acceptance incomplete; `NOT STARTED`; `BLOCKED`.

| Track | Roll-up | Items and evidence |
|---|---|---|
| R repository and operations | PARTIAL | R-02 `DONE` (`parse-origins.ts`, `parse-origins.spec.ts`, no `cervana.vercel.app` in `services/api/src`). R-03 `BLOCKED` (stack down; `INTERNAL_AI_API_SECRET`, `MANUAL_PAYMENT_ACCOUNTS` empty). R-04 evidence missing (dev database not touched by rule). R-05 `DONE` (no `cervana_*` container or volume; `.env.cervana.bak` absent). R-06 `DONE` (no `hf_cache`, `HF_HOME`, `HF_HUB`, `HF_ENDPOINT` in compose or Dockerfile) |
| TD database | PARTIAL | TD-01 to TD-04: schema, migration `130000_theme_foundation`, `seed-theme.ts`, JSON present; scratch-database verify not run. TD-05 `theme-invariants.int.spec.ts` skipped without `TEST_DATABASE_URL` |
| TT theme layer | PARTIAL | TT-01, 02, 03, 05, 07, 08 `DONE` (files and specs pass). TT-04 `DONE` (`FILTERABLE_KEYS`, `themes.repo.ts:21`). TT-06 `PARTIAL`: no `ETag`, `Cache-Control`, `304` |
| S SSR and speed | PARTIAL | S-01 `DONE` (`nuxt.config.ts` internal URLs, `lib/api.ts:10-14`). S-03 `PARTIAL` (`server/utils/theme.ts` exists; fallback timing untested). S-04 `DONE` (cookie `rc-color-mode`). S-05 `PARTIAL` (font preload yes; `compressPublicAssets`, `routeRules`, lazy hydration absent). S-02, S-06 `NOT STARTED` (no measurements) |
| TU UI | PARTIAL | TU-01, 02, 03 `DONE` (`lang`, `theme-color`, skip link, `--rc-*`, `ThemeShell` in `app.vue`). TU-04 `PARTIAL` (`ThemeBackground.vue` absent; `Blackhole`, `Sunset`, `Glassy`, `DownStarAnimation` still imported by 10 files). TU-05 `PARTIAL` (`theme?.primary` and `Math.random` remain: `MappingTopics.vue:67`, `MappingSubTopics.vue:10`, `DownStarAnimation.vue:27-29`). TU-06 `PARTIAL` (`BrandLogo.vue`, `build-brand-assets.mjs` present; `pictures/logo.svg`, planet SVGs remain). TU-07 `PARTIAL` (`OceanHero.vue`; no "Segera" label in any page). TU-08, TU-09 `NOT STARTED` |
| B brand and copy | PARTIAL | B-04 `DONE`, B-05 `DONE` (`public/images/seo/reducera-preview.png`). B-01, B-02 `PARTIAL` (VF-12). B-03 `NOT STARTED` |
| TG generator | PARTIAL | TG-01 `DONE` (`theme-proposer.service.ts`). TG-02 `PARTIAL` (`POST /gamify/themes/propose`, validates, saves nothing). TG-03, TG-04 `NOT STARTED` (no `services/ai-api/v1/themes`, no `pages/admin`) |
| A accounting and learning | PARTIAL | A-01 `PARTIAL` (model and service; spec skipped). A-02 `PARTIAL` (linear 10-node seed; no seeded sandbox scenario). A-03 `NOT STARTED`. A-04, A-05, A-06, A-10 `PARTIAL` (unwired services, §10). A-07, A-09 `PARTIAL` (API yes, web minimal) |
| Q quality gates and docs | NOT STARTED | Q-01 `NOT STARTED` (no `accounting-theme-system.md`, `theme-generator.md`). Q-02 `PARTIAL` (`README.md` fixed, `progress-tracker.md` has 84 stale links). Q-03 `PARTIAL` (VF-13). Q-04 `NOT STARTED` (no `infra/scripts/verify.sh`). Q-06 `NOT STARTED` |

---

## 8. Broken links and missing files

| Check | Result |
|---|---|
| Relative links in `docs/**/*.md` | 416 checked, 161 broken, 20 files affected; worst: `progress-tracker.md` 84, `standards-matrix.md` 17, `service-responsibility-matrix.md` 6, `phased-roadmap.md` 6, `microservice-boundary-audit.md` 6 |
| Cause | Directories renamed `01-audit`, `02-architecture`, `03-plans`, `04-operations` to `audit`, `architecture`, `plans`, `operations` |
| Missing, referenced by older docs | `architecture/data-model.md`, `architecture/learner-state.md`, `architecture/target-state.md` (lowercase; `TARGET_STATE.md` exists), `plans/service-boundaries.md`, `operations/acceptance-criteria.md`, `operations/failure-modes.md`, `operations/safety-guards.md`, `audit/authorization-audit.md`, `audit/ai-contract-audit.md`, `business/flows/BF-001` to `BF-004` (the directory is empty), `data/README.md`, `system/README.md`, `decisions/README.md`, `testing/traceability.md`, `implementation/service-map.md`, `implementation/traceability.md`, `architecture/service-map.md`, `architecture/current-state.md` |
| "master prompt §NN" references | 20 occurrences in 11 files point to a brief that is not in the repo |

Rule applied: a missing file is recorded here and never reconstructed; `learner-state.md` is not available, so D-08 uses the formula in `MasteryService` only as an input to a defect finding (VF-02).

---

## 9. Test runs

| Run | Command | Result |
|---|---|---|
| API | `cd services/api && env -u DATABASE_URL -u TEST_DATABASE_URL -u TEST_LEGACY_DATABASE_URL pnpm jest --silent` | 65 suites: 54 passed, 11 skipped, 0 failed; 1043 tests: 900 passed, 143 skipped, 0 failed; 42.4 s |
| Skipped suites | `*.int.spec.ts` ×9, `prerequisite.service.spec.ts`, `topic-entitlement-backfill.int.spec.ts` | all need `TEST_DATABASE_URL` |
| Web | `cd apps/web && pnpm vitest run` | 2 files, 21 tests passed (`copy.test.ts` 2, `theme.spec.ts` 19) |
| ai-api, prescribed light env | `uv run --no-project --with pytest --with requests --with fastapi --with python-dotenv --with pydantic --with httpx pytest -q` | stops at collection: 2 errors (`numpy`, `qdrant_client` missing) |
| Same, `--continue-on-collection-errors` | as above | 56 passed, 8 failed, 2 errors |
| Same plus `--with numpy --with qdrant-client` | as above | 59 passed, 8 failed, 1 error. Causes: `langchain_openai` missing (1), `pdfplumber` missing (3), `llama_index` missing so `config.embedding_pipeline` does not import (5, plus the collection error in `test_providers.py`). Dependency gaps of the light environment, not assertion failures |
| Former failures | `pytest -q config/__tests__/test_rate_limit.py utils/tools/__tests__` (light plus numpy, qdrant) | 6 passed |
| Compose | `docker compose config -q`; `docker compose -f docker-compose.prod.yml config -q` | exit 0 and 0 |
| Not run | jest with a database, `pnpm build`, `docker compose up`, Playwright | evidence missing |

---

## 10. New findings (not in the baseline)

| ID | Sev | Finding | Evidence |
|---|---|---|---|
| VF-01 | H | `settle` and `release` call `tx.aICreditLedgerEntry.update`; the table has `AICreditLedgerEntry_append_only` (`BEFORE UPDATE OR DELETE`). Both would raise at runtime. A reservation is modeled as a mutable `SPEND` row, there is no reservation identity, and unit tests use a mocked client so the trigger never fires | [VERIFIED: `ai-credits.service.ts:130,154`, migration `20260930040500_domain_foundation:660`, `ai-credits.service.spec.ts`] |
| VF-02 | H | `MasteryService.update` uses `baseK = 32` on a 0 to 1 score, and `expected` depends on difficulty only and rises with it. Replaying the formula: score 0.4, difficulty 0.5, one correct answer gives 1.000, one wrong answer gives 0.000. The eight golden vectors assert sign and bounds only | [VERIFIED: `mastery.service.ts:70-98`, `mastery.service.spec.ts`, node replay of the formula] |
| VF-03 | H | `postJournal` pairs each debit line with the credit line at the same index and falls back to the debit account when none exists; a two-debit, one-credit entry posts one debit-credit pair and one self-pair; extra credit lines are dropped. `validateJournal` sums floats; no `$transaction`; no ownership check on `attemptId`; `closePeriod` takes any id | [VERIFIED: `accounting-sandbox.service.ts:70-174`; constraint `SandboxJournalLine_distinct_accounts` would reject the self-pair at the database] |
| VF-04 | M | Services without a module: `AccountingSandboxService`, `AiCreditsService`, `FrozenBenchmarkService`, `PerInteractionEvaluatorService`, `PromptOptimizationService`, `PrerequisiteService`, `QuizEvaluationService`. Inbound callers: specs only | [VERIFIED: module grep, `trace_path` inbound] |
| VF-05 | M | `PerInteractionEvaluatorService` derives scores from response length (`text.length > 50`) and chunk presence, not from a judge | [VERIFIED: `evaluation.service.ts:104-117`] |
| VF-06 | M | `TutorService.loadOrBuildPolicy` ignores the stored user and returns an empty policy; `persistPolicy` only logs; `recordAttemptOutcome` has no caller; `topicMasteryRecord` is looked up by `topicId ?? conceptKey`, mixing two id spaces | [VERIFIED: `tutor.service.ts:75-83,162-168,229-243`; `trace_path recordAttemptOutcome` 0 callers] |
| VF-07 | H | `GET /ai/v1/users-steps/generate-question` takes `userId` and `token` as query parameters, checks only that `token` is non-empty, enqueues `generate_personality_quiz` before any validation; `/learning/generate-material` and `/learning/chat` never validate the bearer; `POST /users-steps/generate` runs the thinking-model pipeline inside a `try` that returns on every path, so its bearer check below it never executes; the token travels inside Celery arguments (`GenerateContentMaterialPipeline(**body, token=token).dict()`); the stored chat citations are hard-coded `[]` (`workers.py` key `citatetions`) | [VERIFIED: `v1/users_steps/router.py:21-44,92-130`, `v1/learning/router.py:12-50`, `v1/learning/workers.py:78-90`] |
| VF-08 | M | `GET /metrics` is public; registry includes agent, tool, AI credit balance and mastery gauges | [VERIFIED: `metrics.controller.ts:10`, `metrics.service.ts:16-60`] |
| VF-09 | M | `CREATOR_EARNING_HOLD_DAYS`, `REFUND_WINDOW_DAYS`, `PAYOUT_MIN_AMOUNT` are read by code and absent from `.env.example` | [VERIFIED: `commerce.config.ts:13-34`; `grep` on `.env.example` empty] |
| VF-10 | M | `releaseDue` has no caller and no scheduler exists, so any non-zero hold leaves earnings `PENDING` | [VERIFIED: grep callers, no `Cron`/`ScheduleModule`] |
| VF-11 | L | `tests/test_main.py::test_app_creates_without_celery_subprocess` passes while `main.py` still starts Celery, because startup handlers do not run on import | [VERIFIED: `test_main.py:7-31`, `main.py:28-35`] |
| VF-12 | L | `sertifikasi` in `ai-api` prompts and `REDUCERA` in two pages are outside the copy guard scope | [VERIFIED: grep] |
| VF-13 | L | The uncommitted `pyproject.toml` adds `collect_ignore` under `[tool.pytest.ini_options]`; pytest reports `Unknown config option: collect_ignore` | [VERIFIED: `git diff`, pytest warning] |
| VF-14 | M | `GET /lessons/:id` and `GET /steps/:id` are `@AuthenticatedOnly()` and no entitlement check exists in `v1/curriculum`, so any signed-in user can read paid topic content | [VERIFIED: `lessons.controller.ts:26-28`, `grep -rn ntitlement v1/curriculum` empty] |
| VF-15 | L | `marketplace/index.vue` fetches `/v1/marketplace-discovery/recommendations` without `/api` | [VERIFIED: `index.vue:17`] |
| VF-16 | H | `AI_URL` is read by `knowledge.processor.ts:18`, `content.processor.ts:24` and `user-steps.processor.ts:36` and is defined nowhere (not in `.env.example`, compose or the root `.env`), so the jobs that ask `ai-api` to extract or embed a resource throw `AI_URL is not defined`. `content.processor.ts:34` also posts to `/v1/resources/embedding/content` with no bearer, a route shape `ai-api` does not serve without a role token | [VERIFIED: `grep AI_URL docker-compose*.yml .env.example`, `grep -q "^AI_URL=." .env` empty, `v1/resources/router.py:27-43`] |
| VF-17 | M | The `knowledge` BullMQ job carries the user's bearer token in its data, which Redis stores; Phase 1 removed tokens only from Celery tasks of the resource flow | [VERIFIED: `knowledge.processor.ts:16-32`] |
| VF-18 | M | `build_chat_model` passes no timeout to `ChatOpenAI`; only the Hugging Face call has one (60 s) | [VERIFIED: `config/providers.py:17,45,115-136`] |
| VF-19 | H | nginx prefix stripping: the browser path `/api/v1/...` reaches `api` as `/v1/...` and `/ai/v1/...` reaches `ai-api` as `/v1/...`; the services mount `api/v1` (`main.ts:44-54`) and `/ai` plus `/v1` (`main.py:54`, `v1/router.py:7-9`), so every call through nginx would answer `404`. The API itself was not started to confirm the final status; the probe proves the proxy behavior only. The documented check `curl http://localhost/api/v1/docs` cannot pass as configured | [VERIFIED: nginx.conf, scratch probe, `main.ts`, `main.py`] |
| VF-20 | H | `marketplace/{index,articles/[slug],classes/[slug],creator/index,creator/earnings}.vue`, `learn/orders/index.vue` and `learn/orders/[id]/pay.vue` use `$fetch('/v1/...')` (14 call sites). `pay.vue` calls `GET /v1/payments/config` (API serves `/payments/methods`), `POST /v1/payments/intents` (not defined; the intent is created by `POST /orders`) and `POST /v1/payments/intents/:id/manual-submissions` (API serves `/payments/manual/intents/:id/submissions`). The marketplace detail pages pass `route.params.slug` to routes keyed by `id` | [VERIFIED: `grep -rnF '$fetch' apps/web/app/pages`, route inventory] |
| VF-21 | M | `PrerequisiteService.addPrerequisite` runs `detectCycle(requiresId)` before inserting the new edge; on an acyclic graph that call always returns no cycle, so an edge that closes a loop (A requires B while B already requires A, directly or transitively) is inserted. The spec tests a copy of the algorithm written inside the spec file, not the service, and the suite skips without a database | [VERIFIED: `prerequisite.service.ts:46-64`, `__tests__/prerequisite.service.spec.ts:10-70`] |

---

## 11. Explicit answers

| Question | Answer |
|---|---|
| Does `999bbb2` make wallet, payout, refund implemented, partial or scaffolded? | `implemented` on the API (services, routes, state tables, DB guards, mock and integration tests); `partial` as a product: no scheduler for maturity, no UI, integration suites unrun here |
| Do sandbox HTTP routes exist? | No. Only the service, and it is not provided by a module |
| Which theme tables and routes exist after TD and TG? | Columns on `Theme` (`slug`, `status`, `scope`, `tenantId`, `isDefault`, `version`, `mood`, `tokens`, `atmosphere`, `variants`, `provenance`, `publishedAt`, `archivedAt`), `ThemeIcon`, `Topic.themeId`; routes under `/gamify/themes`: `GET default` (public), CRUD, `submit-review`, `publish`, `suspend`, `archive`, `set-default`, icons, `POST propose` |
| Does the Qdrant collection size equal `EMBEDDING_DIM`? | Evidence missing: Qdrant is not running. The code creates collections at `EMBEDDING_DIM` (1024) and refuses to start on a mismatch |
| Which V1 tracks are DONE, PARTIAL or BLOCKED? | None `DONE`; R, TD, TT, S, TU, B, TG, A `PARTIAL`; Q `NOT STARTED`; R-03 `BLOCKED` |

---

## Evidence citations

| Item | Command or path |
|---|---|
| Route inventory | scratch spec `route-count.spec.ts` run with `npx jest --rootDir=services/api/src --modulePaths services/api/node_modules`; output `routes.json` (session scratchpad, not in the repo) |
| Decorator count | `grep -rhoE "@(Get\|Post\|Put\|Patch\|Delete)\(" --include=*.controller.ts services/api/src \| sort \| uniq -c` |
| Model writers | Node script scanning `services/api/src` for `prisma.<model>.(create\|createMany\|upsert\|update\|updateMany\|delete\|deleteMany)` and nested `create` |
| Unwired services | `trace_path` inbound on `AiCreditsService`, `AccountingSandboxService`, `QuizEvaluationService`, `ActivityDetectorInterceptor` (spec only), `recordLearningEvent` and `recordAttemptOutcome` (0 callers); `grep` confirmation |
| Links | Python script over `docs/**/*.md` resolving each relative target |
| Docker | `docker compose ps` (postgres, redis only) |
| nginx probe | throwaway `nginx:1.29-alpine` container with the repository's `location /api/` and `proxy_pass http://upstream/;` shape against a local echo server on ports 18080 and 18081, both removed afterwards; nothing in the repository or the project stack was touched |

## Verdict

The 2026-09-30 audit understates the repository on the commerce side (wallets, payouts, refunds, content products are built) and overstates readiness on the learning side: the learner model, AI credits, sandbox and evaluation exist as unwired services, three of them with defects that tests do not catch. `ai-api` is unchanged and its authentication is weaker than ADR-007 states. The path from browser to API is not wired: nginx strips the prefix the services expect, and the new pages use URLs the API does not serve. The plan in the other `docs/strategy/` files starts from this state.
