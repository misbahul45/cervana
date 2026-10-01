# 10-Phase Implementation Plan — Design Spec

> **Status**: `draft` · **Owner**: `architect` · **Last reviewed**: `2026-10-02`
>
> Strategic implementation roadmap that maps a 10-phase product template
> (Foundation → Production Scale) onto ReduCera's verified current state, the
> existing 13-phase execution backlog (`docs/plans/phased-roadmap.md`), and the
> V1 execution plan (`docs/plans/reducera-v1-execution-plan.md`).
>
> This spec is the **strategic overlay**. Per-phase task breakdowns are produced
> by the writing-plans skill, not this spec.

---

## 1. Goals, Non-Goals, and Cross-Walk

### 1.1 Goals

- **G1**: Map the 10-phase template (Phase 0 Foundation → Phase 9 Production
  Scale) onto ReduCera's verified current state with evidence drawn from
  `docs/strategy/01-verification-delta.md` (VD) and
  `docs/architecture/CURRENT_IMPLEMENTATION_AUDIT.md`.
- **G2**: For each of the 10 phases, produce an architecture summary
  (services touched, key modules, data-model delta, AI safety boundary, cross-
  walk to existing 13-phase work) that the writing-plans skill can expand into
  per-task execution plans.
- **G3**: Lock the cross-cutting architectural invariants that every phase must
  respect — service ownership rules from `AGENTS.md`, AI safety rule
  (deterministic engine for accounting truth, AI for explanation/recommendation
  only), SSR-first rendering, evidence-claim traceability.

### 1.2 Non-Goals

- **NG1**: Replace `docs/plans/phased-roadmap.md` (13 phases) or
  `docs/plans/reducera-v1-execution-plan.md` (V1 execution). The 13-phase
  roadmap remains the execution backlog.
- **NG2**: New microservices. `AGENTS.md` forbids adding services. All new
  modules go into `api`, `ai-api`, or `web`.
- **NG3**: Production-scale infrastructure work that is not already a CRITICAL
  or HIGH gap. Multi-region, advanced WAF, full disaster recovery — deferred
  to a future V3.
- **NG4**: Per-phase task breakdowns in this spec. The writing-plans skill
  produces the tasks. The 10-phase spec stays at architecture-decision level.

### 1.3 Cross-Walk — 10 phases → existing 13 phases

| Template phase | Maps to existing | Already done? |
|---|---|---|
| 0 Foundation Architecture | Existing Phase 0 (Stabilize) + Phase 1 (Architecture Cleanup) + selected V1 items (TT-04, S-01, S-02, S-05) | Partial — Docker, CI, services built; ownership rules still being enforced |
| 1 Accounting Learning MVP | Existing Phase 6 (Agent Integration) + G-P-01 (sandbox route/UI), G-P-02 (onboarding/path) | Curriculum chain exists; sandbox + onboarding missing |
| 2 Personalized AI Learning Engine | Existing Phases 2 (Domain), 3 (Memory), 4 (Learner Model), 5 (Adaptive Policy) | Not started |
| 3 Gamified Learning | Existing Phase 1 (Architecture Cleanup) + Phase 3 (Memory) gamification hooks | Partial — XP/level/streak exist; skill tree missing |
| 4 Creator Economy | Gap G-P-03 (studio), G-P-06 (become-creator), D-12 (Reviewer capability) | Routes exist; studio UI missing |
| 5 Payment & Economic Loop | Gap G-B-01 (credit package), G-B-02 (hold days), G-B-04 (Topic retirement) | Routes exist; UI missing; credit revenue loop not started |
| 6 Advanced Accounting Simulation | Gap G-P-01 (sandbox) — the core differentiator | Module exists; no route/UI |
| 7 AI Agent Ecosystem | Existing Phase 7 (Evaluation) + Phase 8 (DSPy) | Partial — tutor endpoint exists; marketplace agents not started |
| 8 Analytics Platform | Gap G-P-07 (analytics), G-D-* data layer | Barely started |
| 9 Production Scale | Existing Phase 12 (Production Hardening) + new capabilities | Partial — CSP/HSTS in nginx; rate limits, WAF pending |

---

## 2. Architectural Invariants (Locked Across All 10 Phases)

### 2.1 I1 — Service Ownership (No Bypass)

```
api (NestJS :3002)  owns PostgreSQL via Prisma, Redis (BullMQ), SSE bus, auth + authz
ai-api (FastAPI :3003) owns Qdrant, LLM providers, Tavily, Celery worker
web (Nuxt :3000) owns nothing, calls api and ai-api via Nginx
nginx routes /, /api/, /ai/
```

Each phase that adds a capability places it on the service that owns the data
it needs. Cross-service data needs use HTTP with the original user's bearer
token forwarded (`AGENTS.md` Rule 5). No phase may add a shared Prisma client,
SQLAlchemy session, new microservice, or second `.env` file.

### 2.2 I2 — Read-Only Cross-Service Projections

Phases that need read-only views of data owned by `api` (lessons, topics,
learning style, personality quiz) consume them over HTTP through a new
endpoint on `api`. No direct database connection from `ai-api`. Precedent:
`requests.get(f"{ENVS['NEST_API']}/learning/user-steps/{id}", headers={"Authorization": f"Bearer {token}"})`.

### 2.3 I3 — Accounting Truth Is Deterministic

The accounting engine (Phase 1 MVP + Phase 6 simulation) is a deterministic
rules engine in `api`. It accepts a transaction (`Buy inventory $100`) and
returns journal entries with `Debit = Credit` enforced by code, not by LLM.
The LLM (`ai-api`) explains, recommends, generates exercises, and analyzes
patterns. The LLM is **not** the source of truth for journal validity, trial
balance, or financial statements. Phase 6 (Virtual Company Simulator)
generates Income Statement / Balance Sheet / Cash Flow from the deterministic
engine; the AI tutor can explain *why* the statements look the way they do
but cannot alter the numbers.

### 2.4 I4 — AI Safety Boundary (Explicit Per Phase)

For every phase that adds an AI feature, the spec states (a) what decision AI
assists, (b) what decision remains deterministic. Rejectable categories:

- AI cannot make financial decisions (Phase 5 wallet/payout: AI cannot approve
  a withdrawal).
- AI cannot replace accounting validation (Phase 6 simulation: AI cannot
  override a balance sheet that does not balance).
- AI cannot autonomously approve transactions (Phase 5 marketplace: AI cannot
  publish a creator's article).
- AI cannot determine academic certification (Phase 1+3: AI cannot issue a
  "passed" badge; the deterministic evaluator does).

### 2.5 I5 — Web Rendering: SSR First

`apps/web` renders on the server. Every page ships its meaningful content and
theme in the first HTML response. Decorative values from stable inputs (no
`Math.random()`, `Date.now()`, `window`, `localStorage`) during render.
Browser-only code in `onMounted` or `<ClientOnly>`. Internal URLs
(`API_URL_INTERNAL`, `AI_API_INTERNAL_URL`) for SSR calls — never
`NUXT_PUBLIC_*` (BL-14 in the V1 execution plan already proved this). Theme
must render from static CSS when the API is unreachable; color scheme stored
in a cookie. No `swr`/`isr`/`prerender` on user-state pages.

### 2.6 I6 — Single Configuration Source

One root `.env`. No per-service `.env`. Reference via `${VAR}` in compose with
sensible defaults. Browser-facing URLs use public host; service-to-service
URLs use Docker service names (`postgres`, `redis`, `api`, `ai-api`,
`qdrant`, `celery-worker`). Rotate `COOKIE_SECRET`, `JWT_ACCESS_SECRET`,
`JWT_REFRESH_SECRET` per environment. Personal developer `HF_TOKEN` lives
only in git-ignored root `.env` and is removed when work ends.

### 2.7 I7 — Verification Before Phase Closure

Every phase closes with:

- `docker compose config` exit 0 for both dev and prod compose files.
- `docker compose ps` shows all services healthy.
- `curl http://localhost/nginx-health` returns 200.
- All declared tests pass (per-phase AC table states counts).
- For any phase touching `apps/web`, the Playwright MCP matrix in `AGENTS.md`
  runs at viewports 375×812, 768×1024, 1280×800, both color schemes,
  `reducedMotion: reduce` once; screenshots to `.playwright-mcp/`.
- Code audit with `codebase-memory-mcp` for any structural claim (callers,
  ownership, removals).
- No `--no-verify`, no `--force`, no `git add`, no `git commit`, no `git
  push` from the executor (owner performs stage and commit).

---

## 3. Data Model Evolution Strategy

ReduCera's data model lives in exactly one place:
`services/api/prisma/schema.prisma`, applied via hand-written migrations
(`prisma migrate diff --from-config-datasource --to-schema
prisma/schema.prisma --script`, per `AGENTS.md`). All 10 phases add
columns/tables to this single schema; no service owns a second schema. The
existing `docs/strategy/13-data-model-delta.md` enumerates schema changes
per stage; the 10-phase plan inherits and groups them by template phase.

### 3.1 Phase-by-phase schema summary

| Phase | Adds (api) | Touches (existing) | Leaves alone |
|---|---|---|---|
| 0 Foundation | `Theme.scope`, `Theme.tenantId` invariants, theme FK hardening | — | `User`, `Role`, `Permission`, `Organization`, `AuditLog` |
| 1 Accounting MVP | Sandbox route + journal workspace tables per `docs/architecture/accounting-sandbox.md` | `Curriculum`, `Lesson`, `Step` (existing); seed golden graph per §6-accounting-domain | — |
| 2 Personalization | `MasteryScore`, `MisconceptionPattern`, `MemoryRecord`, `AdaptivePolicy` | `User`, `Lesson`, `Question` | — |
| 3 Gamification | `SkillTree`, `Achievement`, `Streak`, `Leaderboard`, theme-aware badge assets | `XP`, `Level` (existing) | — |
| 4 Creator | `CreatorProfile`, `CourseBuilder`, `QuizBuilder`, `ArticleDraft`, `SimulationBuilder`, `Reviewer` capability | `User`, `Role` | — |
| 5 Payment | `Wallet`, `Transaction`, `RevenueShare`, `Withdrawal`, `HoldWindow`, `Reservation` | `Order`, `Payment`, `Payout` (existing); retire `Topic` as product (G-B-04) | — |
| 6 Simulation | `VirtualCompany`, `JournalEntry`, `Ledger`, `FinancialStatement` snapshots | Sandbox tables (Phase 1) | — |
| 7 Agents | `AgentRegistry`, `AgentTool`, `AgentMemory`, `DecisionTrace` (audit) | `MemoryRecord` (Phase 2) | — |
| 8 Analytics | `EventLog`, `MasterySnapshot`, `EngagementMetric`, `CreatorOutcomeMetric` | `User`, `Lesson`, `Order`, `Wallet` | — |
| 9 Production | `RateLimit`, `BackupRecord`, expanded `AuditLog` | `User`, `Order`, `Payment` | — |

### 3.2 Schema-wide rules

1. **No new ORM client.** `ai-api` reads only via HTTP to `api` endpoints
   (`AGENTS.md` Rule 7). Phases that need `ai-api` to know DB structure
   declare it via a published DTO.
2. **No edit of applied migrations.** Phase work that finds an existing
   column wrong writes a new migration that fixes it; the original migration
   stays in git history.
3. **FK safety on theme-cascade (BL-01 lesson).** `SubTopic`, `Lesson`,
   `Step.themeId` are `SetNull`, not `Cascade`. Phases that add new
   theme-aware tables follow the same `SetNull` rule. Verified by invariant
   tests in the existing execution plan.

---

## 4. AI Architecture Across Phases

ReduCera's AI is concentrated in `ai-api` (FastAPI + LangGraph + Celery)
and reaches the LLM through one OpenAI-compatible gateway (Flaz,
`https://ai.flaz.id/v1`) with a single key. Two modes chosen by benchmark:
**Flash** (`OPENAI_MODEL_FLASH`, `pipeline.llm` — tutor streaming, summaries,
chat replies, quiz generation) and **Thinking** (`OPENAI_MODEL_THINKING`,
`pipeline.llm_thinking` — lesson content generation, learning-path planning;
never sends temperature). Embeddings are computed remotely by Hugging Face
Inference (`HF_TOKEN`, `HF_EMBEDDING_MODEL`, `HF_EMBEDDING_URL` with
`{model}` placeholder, `EMBEDDING_DIM`). No embedding model runs inside a
container. Only `ai-api` and `celery-worker` receive these credentials.

### 4.1 AI-1 — Two-Mode LLM, One Gateway, No Provider Switching

Phases 2, 7, 8 consume `pipeline.llm` or `pipeline.llm_thinking`. No phase
adds a second LLM provider client. Phases that need reasoning use Thinking;
phases that need low-latency streaming use Flash. The benchmark in
`docs/plans/reducera-v1-execution-plan.md` §3.4 plus
`infra/scripts/llm-bench/` is the only source of model-change decisions.

### 4.2 AI-2 — Agent Router Pattern (Phase 7)

`ai-api` exposes one router endpoint that dispatches to specialized agents:
`AccountingTutorAgent` (Phase 1+6), `CurriculumAgent` (Phase 2),
`AssessmentAgent` (Phase 3+7), `CreatorAssistantAgent` (Phase 4),
`CareerAgent` (later). The router is a thin dispatch (intents, not heavy
logic) — it does **not** use an LLM to decide which agent runs. Routing is
deterministic, selected by the calling `api` endpoint.

### 4.3 AI-3 — Memory: Short-Term Window + Long-Term Profile

`MemoryRecord` (added in Phase 2) holds two slices: **short-term** (recent
conversation turns, capped at last N, time-decayed) and **long-term learner
profile** (mastery, misconceptions, preferences, conversation summaries).
The retrieval tool `tool_semantic_search` is scoped to the current
`lessonId` strictly. Cross-lesson recall is forbidden by default and gated
by an explicit "allow cross-lesson" flag the deterministic policy decides.

### 4.4 AI-4 — Tool Boundary

Agents call tools in `api` over HTTP with the user's bearer token forwarded.
Tools are deterministic (`get_lesson`, `submit_attempt`, `compute_journal`)
and return structured responses. Agents do not call tools in other agents.
Agent-to-agent composition happens through `api` orchestration.

### 4.5 AI-5 — Decision Trace Table (Phase 7)

Every agent decision produces a row in `DecisionTrace`:
`{traceId, agentId, userId, promptHash, responseHash, toolCalls,
deterministicOutputs, ownerCheckpoints}`. Owned by `api` (write), read by
`ai-api` only via a published projection endpoint. This table answers I4
("what did AI decide, what remained deterministic?") at audit time.

### 4.6 AI-6 — Evaluation Is Deterministic First

Quiz and exercise evaluation: `MULTIPLE_CHOICE` is string comparison;
`TEXT` and `CASE_STUDY` go to `ai-api /ai/v1/evaluator/grade` with rubric,
and the LLM returns structured output that `api` persists to
`Answer.isCorrect` and `QuizAttempt.score`. The LLM's verdict is advisory;
the deterministic rule "score must equal sum of correct answers" is enforced
in `api`.

### 4.7 AI-7 — No Autonomous Certification

Phase 3 badges and Phase 5 payouts are issued by deterministic rules. AI
agents cannot directly issue a badge, grant credit, or approve a withdrawal.
They can recommend; a deterministic policy service issues the side-effect.

---

## 5. Per-Phase Architecture Summaries

Each phase follows this shape:

```
Phase N — [Title]
  Engineering Goal:    one sentence
  User Impact:        who + what problem solved
  Services Touched:   api / ai-api / web / infra
  Key Modules:        where in the codebase
  Cross-Walk:         existing 13-phase roadmap stages
  Acceptance Gates:   how we know it is done (commands + results)
  Notable Risks:      1-2 things that can derail this phase
```

### 5.1 Phase 0 — Foundation Architecture

- **Engineering Goal**: Stabilize ReduCera's existing service boundaries and
  harden cross-cutting rules (SSR, ownership, AI safety) so phase 1+ work
  cannot quietly violate them.
- **User Impact**: No direct user-visible change. Operational hardening.
  Indirect impact: fewer bugs in later phases because rules are enforced once.
- **Services Touched**: `api` (ownership guards), `ai-api` (decision-trace
  hookpoint), `web` (SSR invariants), `infra` (nginx CSP/HSTS, Celery start
  path), `docs/architecture/`.
- **Key Modules**: `services/api/src/common/lib/auth`,
  `services/ai-api/main.py` (drop Celery subprocess spawn),
  `infra/nginx/nginx.conf` (CSP + HSTS + Permissions-Policy),
  `apps/web/app/lib/api.ts` (URL resolver BL-14 fix lands in V1 but is part
  of Phase 0 ownership).
- **Cross-Walk**: Existing Phase 0 (Stabilize) + Phase 1 (Architecture
  Cleanup) + selected V1 items (TT-04, S-01, S-02, S-05).
- **Acceptance Gates**: `docker compose config` and prod variant exit 0;
  `pnpm jest` and `uv run pytest` exit 0 with ≥ 30 added tests; CSP/HSTS
  visible via `curl -I`; cross-user chat access returns 403; tool
  lesson-scope test green; detection-grep CI gate green.
- **Notable Risks**: (1) AGENTS.md ownership rules not yet enforceable by
  CI — countermeasure: detection-grep gate as pre-commit hook. (2) V1
  execution plan doing parallel Phase 0 work — countermeasure: explicit
  cross-walk with TT-04 and S-01 in writing-plans output.

### 5.2 Phase 1 — Accounting Learning MVP

- **Engineering Goal**: Make the **Accounting Sandbox** reachable
  end-to-end (currently the core differentiator has no route, no UI, no
  seeded scenario per Gap G-P-01). Add the diagnostic + onboarding +
  skill-tree surface so a new learner can place themselves and start.
- **User Impact**: First-time student lands on a placement diagnostic, gets
  a recommended starting lesson, can complete one accounting exercise with
  deterministic journal validation, sees instant feedback plus LLM "why
  this debit/credit" explanation. Student sees first XP and streak update.
- **Services Touched**: `api` (sandbox route, journal workspace,
  deterministic engine route, onboarding pages), `web` (sandbox UI,
  onboarding UI, skill-tree viewer), `docs/strategy/06-accounting-domain.md`
  (golden graph seed).
- **Key Modules**: `services/api/src/v1/sandbox/`,
  `services/api/src/v1/accounting/journal-validator.ts`,
  `apps/web/app/pages/sandbox/`, `apps/web/app/pages/onboarding/`,
  golden graph at `services/api/prisma/seed-data/golden-accounting-graph.json`.
- **Cross-Walk**: Existing Phase 6 (Agent Integration) for tutor endpoint;
  fills G-P-01 + G-P-02 + G-A-*; first delivery against
  `docs/architecture/accounting-sandbox.md`.
- **Acceptance Gates**: `POST /sandbox/scenarios` returns a scenario with
  expected journal; `POST /sandbox/journal` validates `Debit = Credit`
  deterministically; landing-page placement diagnostic renders SSR with
  theme in first byte (Playwright matrix); tutor explanation streams from
  `ai-api` and cites the curriculum chunk by `lessonId`; `prisma db seed`
  populates golden graph (4 levels × 15+ topics per §6-accounting-domain);
  sandbox route behind login with `Authorization` check.
- **Notable Risks**: (1) Golden graph seed incomplete — countermeasure:
  structural validator (each `prerequisite` points to an existing
  `topicId`). (2) Raw deterministic-engine errors confuse learners —
  countermeasure: map common engine errors to user-language messages in
  `apps/web/app/lib/accounting-error-messages.ts`.

### 5.3 Phase 2 — Personalized AI Learning Engine

- **Engineering Goal**: Move from "deliver lessons" to "deliver the right
  next lesson for this learner". Build mastery tracking, misconception
  detection, and adaptive policy using deterministic rules + AI explanation.
- **User Impact**: Student finishes a quiz, sees which concepts they are
  weak on, gets a recommended next activity targeted at the misconception,
  sees long-term profile progress.
- **Services Touched**: `api` (`MasteryService`, `MisconceptionDetector`,
  `AdaptivePolicyService`, `MemoryService`), `ai-api` (`CurriculumAgent`,
  memory retrieval via `MemoryRecord` over HTTP), `web` (mastery dashboard
  widgets).
- **Key Modules**: `services/api/src/v1/learning/mastery/`,
  `services/api/src/v1/learning/memory/`,
  `services/api/src/v1/learning/policy/`,
  `services/ai-api/v1/learning/personalization.py`,
  `apps/web/app/components/my-learning/MasteryView*`.
- **Cross-Walk**: Existing Phases 2 (Domain), 3 (Memory), 4 (Learner
  Model), 5 (Adaptive Policy). Fills the AI personalization core of
  `docs/strategy/07-ai-architecture.md`.
- **Acceptance Gates**: `MasteryScore` table populated from real quiz
  attempts; `MisconceptionDetector` returns known patterns with confidence
  ≥ 0.6; `AdaptivePolicyService` returns "next activity" with deterministic
  rationale trace; tutor streaming includes memory recall scoped to current
  lesson; integration test `test_mastery_updates_on_attempt` green.
- **Notable Risks**: (1) Misconception detection becomes an LLM call —
  countermeasure: scope to rule-table patterns only; LLM is reserved for
  explaining misconceptions. (2) Memory grows unbounded — countermeasure:
  decay policy (90-day short-term TTL, profile-level distillation on
  rollover).

### 5.4 Phase 3 — Gamified Learning Experience

- **Engineering Goal**: Make the gamification layer **visible and varied** —
  skill tree, badges, streak rules, theme-aware celebrations, leaderboard
  that does not shame low-performers.
- **User Impact**: Student sees a skill tree that lights up as they master
  topics, earns named badges ("Journal Keeper", "Trial Balance Hero") at
  deterministic milestones, experiences a UI that subtly changes with level
  (beginner-friendly → professional dashboard).
- **Services Touched**: `api` (`SkillTree`, `Achievement`, `StreakRule`,
  deterministic badge issuance), `web` (skill-tree viewer, badge toast,
  level-up animation, theme-aware atmosphere layer).
- **Key Modules**: `services/api/src/v1/gamify/skill-tree/`,
  `services/api/src/v1/gamify/achievements/`,
  `apps/web/app/components/gamification/SkillTree.vue`,
  `apps/web/app/components/gamification/LevelUpAnimation.vue`.
- **Cross-Walk**: Existing Phase 3 (Memory gamification hooks) +
  `docs/strategy/08-gamification-and-theme.md`. Honors I3 (no AI-issued
  certifications) and I5 (atmosphere ships in first HTML byte).
- **Acceptance Gates**: Skill tree renders SSR for any user with ≥ 1
  lesson attempt; deterministic rule "issue badge when mastery ≥ 0.9 on
  topic X" verified by integration test; theme color scheme honored in
  animation without flash; Playwright matrix green at all viewports.
- **Notable Risks**: (1) Atmosphere animation drift on slow networks —
  countermeasure: animations disabled when `prefers-reduced-motion: reduce`.
  (2) Leaderboard can demoralize low-performers — countermeasure:
  cohort-scoped leaderboards, never public ranking.

### 5.5 Phase 4 — Creator Economy

- **Engineering Goal**: Turn **mastered students into published creators**.
  Build studio UI for articles / classes / simulations / quizzes, the
  eligibility gate (mastery ≥ 0.85), the moderation queue with a new
  `Reviewer` capability, and the creator profile page.
- **User Impact**: A student who masters "Adjusting Entries" can apply to
  become a creator, get approved, build a class, publish it, and earn when
  other students buy it. Reviewers (new role) see a queue and approve.
- **Services Touched**: `api` (`CreatorProfile`, `ArticleDraft`,
  `CourseBuilder`, `QuizBuilder`, `SimulationBuilder`, `Reviewer`
  capability + queue, `Content`, `Order` extensions), `web` (studio pages
  `/studio/articles`, `/studio/classes`, `/studio/quizzes`,
  `/studio/simulations`, `/become-creator`).
- **Key Modules**: `services/api/src/v1/studio/`,
  `services/api/src/v1/marketplace/listings/`,
  `services/api/src/v1/moderation/queue/`,
  `apps/web/app/pages/studio/`.
- **Cross-Walk**: Fills G-P-03, G-P-04, G-P-06, G-P-07; honors D-12
  (reviewer capability).
- **Acceptance Gates**: `/become-creator` blocks submission unless mastery
  ≥ 0.85; studio `/articles/new` saves drafts; `POST
  /moderation/queue/:id/approve` requires `Reviewer` role; published
  article appears in marketplace within 60 seconds.
- **Notable Risks**: (1) Peer content quality variance — countermeasure:
  deterministic rubric scoring before approval. (2) Studio UI scope creep
  — countermeasure: MVP studio is markdown + quiz JSON upload; rich
  WYSIWYG deferred to V2.

### 5.6 Phase 5 — Payment & Economic Loop

- **Engineering Goal**: Close the **circular economy loop** (Gaps G-B-01,
  G-B-02, G-B-04). Build the wallet, credit-package order path,
  platform-fee ledger, creator payout, hold-window for refund safety,
  retire `Topic` as product.
- **User Impact**: Student buys credit package → credits spent on classes →
  creator earns → creator withdraws. Refund within 7-day window works;
  payouts hold until window closes. Platform fee is transparent.
- **Services Touched**: `api` (`Wallet`, `Transaction`, `RevenueShare`,
  `Withdrawal`, `HoldWindow`, `Reservation`; retire `Topic` per G-B-04),
  `web` (checkout, purchase confirmation, creator earnings dashboard,
  withdrawal request UI), `infra` (no new service; reuse existing
  `payments` / `commerce` / `ledger` modules).
- **Key Modules**: `services/api/src/v1/wallet/`,
  `services/api/src/v1/payments/credit-packages/`,
  `services/api/src/v1/commerce/revenue-share/`,
  `services/api/src/v1/payouts/` (extend existing).
- **Cross-Walk**: Fills G-B-01 through G-B-05; honors I3 (AI cannot
  approve withdrawals) and I4 (AI cannot publish content or trigger
  payouts); aligns hold-day default with refund window (D-05).
- **Acceptance Gates**: `POST /wallet/topup` with `credit_package_id`
  moves credits to wallet; `Transaction` audit row written for every
  state change; `POST /payouts/request` enters hold queue; deterministic
  rule "payout released iff hold_days_passed AND no open refund" enforced
  in `api`; `Topic` no longer in marketplace listing (404).
- **Notable Risks**: (1) Money-loop correctness is paramount —
  countermeasure: every state transition is two-phase (reserve + commit)
  with `idempotency_key` on the request and `Transaction` row on commit.
  (2) Idempotency drift under retries — countermeasure: integration test
  with 5× duplicate POST asserting exactly one credit increment.

### 5.7 Phase 6 — Advanced Accounting Simulation

- **Engineering Goal**: Deliver the **Virtual Company Simulator** — a
  student runs a simulated company end-to-end, generating Income Statement,
  Balance Sheet, and Cash Flow from the deterministic engine. Core
  differentiator (Gap G-P-01 also covers this).
- **User Impact**: Student picks a simulated company (e.g., "Warung Kopi
  Maju Jaya — q1 2026"), generates 30 days of transactions, records journal
  entries, runs the deterministic engine, sees real numbers in three
  statements. Tutor (AI) explains "why your COGS spiked" but cannot change
  the numbers.
- **Services Touched**: `api` (`VirtualCompany`, `JournalEntry`, `Ledger`,
  `FinancialStatement` snapshots; deterministic engine extended with
  multi-period closing), `web` (simulator UI: timeline, journal workspace,
  statements viewer), `ai-api` (explanation agent only; reads via
  published projection endpoints per I2).
- **Key Modules**: `services/api/src/v1/simulator/`,
  `services/api/src/v1/accounting/period-close.ts`,
  `apps/web/app/pages/simulator/[companyId]/`.
- **Cross-Walk**: Fills the remainder of G-P-01; reuses Phase 1 sandbox
  engine; honors I3 strictly.
- **Acceptance Gates**: Simulator scenario completes a 30-day cycle and
  produces a balanced Balance Sheet on every snapshot; LLM explanation
  cannot alter the displayed numbers (verified by snapshot hash equality
  before/after LLM call); multi-tenant data isolation enforced in
  simulator queries; Playwright matrix green at all viewports.
- **Notable Risks**: (1) Engine bugs produce unbalanced statements —
  countermeasure: CI runs a property-based test (`fast-check`) asserting
  balance for 1000 randomized transaction streams. (2) Scenario authoring
  is code-only — countermeasure: scenario JSON format documented;
  non-engineer authoring deferred to creator Phase 4 extension.

### 5.8 Phase 7 — AI Agent Ecosystem

- **Engineering Goal**: Stand up the **agent router** and the
  decision-trace table (AI-2 / AI-5). Add `CreatorAssistantAgent` and
  `CareerAgent` to the existing `AccountingTutorAgent` /
  `CurriculumAgent`. Each agent has its own tool surface and memory slice;
  routing is deterministic.
- **User Impact**: Student asks the tutor, gets a streaming answer
  grounded in their lesson + mastery profile. Creator asks the studio
  assistant for content ideas. Career agent says "your mastery on
  consolidation is strong — consider a class on group accounts". All
  agent decisions are auditable.
- **Services Touched**: `ai-api` (router, `CreatorAssistantAgent`,
  `CareerAgent`, agent memory slices), `api` (decision-trace table write,
  agent-tool endpoints), `web` (chat UI extensions for studio + career).
- **Key Modules**: `services/ai-api/v1/agents/router.py`,
  `services/ai-api/v1/agents/creator_assistant.py`,
  `services/ai-api/v1/agents/career.py`,
  `services/api/src/v1/agents/decision-trace/`.
- **Cross-Walk**: Existing Phase 6 (Agent Integration) + Phase 7
  (Evaluation) + Phase 8 (DSPy). Honors AI-2, AI-4, AI-5, AI-7.
- **Acceptance Gates**: Decision-trace row written for every agent call
  (integration test); router picks agent by deterministic intent lookup
  (not by LLM); agent tool calls go through `api` HTTP endpoints with
  original bearer token (AI-4); DSPy teleprompter compiled for at least
  one signature.
- **Notable Risks**: (1) Decision-trace table grows unbounded —
  countermeasure: 90-day TTL with cold-storage offload. (2) Agents
  drift into autonomous behavior — countermeasure: I4 enforcement test
  that asserts agents cannot call payout/approval endpoints directly.

### 5.9 Phase 8 — Analytics Platform

- **Engineering Goal**: Make the platform **measurable**. Student
  analytics (mastery, engagement, weakness), creator analytics (sales,
  completion rate, satisfaction), admin analytics (ecosystem health,
  revenue loop). All events routed through `api`; `ai-api` is read-only
  via projections.
- **User Impact**: Creator sees a dashboard showing which lessons have
  the highest dropout; admin sees cohort retention; student sees their own
  progress (already partial in Phase 2 mastery view).
- **Services Touched**: `api` (`EventLog`, `MasterySnapshot`,
  `EngagementMetric`, `CreatorOutcomeMetric`), `web` (analytics
  dashboards for creator + admin).
- **Key Modules**: `services/api/src/v1/analytics/events/`,
  `services/api/src/v1/analytics/snapshots/`,
  `apps/web/app/pages/analytics/creator/[id].vue`,
  `apps/web/app/pages/admin/analytics.vue`.
- **Cross-Walk**: Fills G-P-07; closes G-D-* data-layer gaps; sets up
  Phase 9 capacity baselines.
- **Acceptance Gates**: `EventLog` populated for 5 mandatory actions
  (`lesson_completed`, `quiz_submitted`, `purchase_completed`,
  `payout_released`, `badge_issued`); creator dashboard renders SSR
  with cached aggregates (no waterfall); admin analytics page lists
  ecosystem KPIs.
- **Notable Risks**: (1) PII leakage in analytics — countermeasure:
  explicit PII filter in `EventLog` projection; verified by test. (2)
  Heavy analytics queries slow `api` — countermeasure: nightly snapshot
  job (BullMQ) writes aggregated `MasterySnapshot`; live dashboards
  read snapshots.

### 5.10 Phase 9 — Production Scale

- **Engineering Goal**: Hardening for real-world load — performance
  (caching, queue, background jobs), security (RBAC audit, encryption
  at rest, audit logging), reliability (backup, monitoring, runbook,
  basic DR). Aligned with `docs/architecture/PAYMENT_ARCHITECTURE.md`,
  `docs/architecture/agent-safety.md`, and existing Phase 12 (Production
  Hardening).
- **User Impact**: No direct feature change. Indirect: page loads
  latency-to-time-to-bytes below budget, fewer 5xx errors, payment-loop
  recovery from a Redis flush.
- **Services Touched**: `api` (`RateLimit`, expanded `AuditLog`,
  `BackupRecord`), `ai-api` (rate limit on LLM calls per user), `web`
  (asset budget, font preload), `infra` (Nginx rate-limit zone, Redis
  eviction policy, backup cron, monitoring stack).
- **Key Modules**: `services/api/src/common/middleware/rate-limit.ts`,
  `infra/nginx/nginx.conf` (limit_req zone),
  `infra/scripts/backup.sh`, runbook under `docs/operations/runbook/`.
- **Cross-Walk**: Existing Phase 12 + gaps closed in Phases 0, 5, 7.
  Honors invariants I6, I7.
- **Acceptance Gates**: nginx `limit_req` returns 429 on synthetic burst
  test; nightly backup script produces a verifiable Postgres dump;
  rate-limit per-user enforced on `ai-api /ai/v1/chat`; load test
  (`k6`) shows p95 < 500ms on `GET /chat/contents/similarity` with 100
  VUs; runbook covers DB restore, Redis flush recovery, Qdrant rebuild.
- **Notable Risks**: (1) Backups untested — countermeasure: monthly
  restore drill in `infra/scripts/restore-drill.sh`. (2) Monitoring
  becomes "alert on noise" — countermeasure: only critical alerts
  (5xx rate, payment failure rate, queue depth) generate pages; rest
  are dashboards.

---

## 6. Testing Strategy (Cross-Cutting)

### 6.1 Four-layer test model

| Layer | Owner | Tooling | When it runs | What it catches |
|---|---|---|---|---|
| Unit | Phase executor | Jest (`api`), pytest (`ai-api`) | pre-commit + CI | Logic bugs, regressions in deterministic engine, AI safety rules, RBAC guards |
| Integration | Phase executor | Jest + real Postgres (`TEST_DATABASE_URL`), pytest + Qdrant container | CI | DB invariants, agent tool boundaries, payment two-phase transitions |
| E2E | Phase executor | Playwright MCP matrix | Pre-merge to main | SSR first-byte theme, no `Math.random` in render, contrast ratios, console errors |
| Smoke | Executor or owner | `curl` scripts in `infra/scripts/smoke/` | Post-deploy | All services healthy, key endpoints return expected codes |

### 6.2 T1 — Mandatory test counts per phase

```
Phase 0:  >= 30 new tests
Phase 1:  >= 60 cumulative
Phase 2:  >= 100 cumulative
Phase 3:  >= 140 cumulative
Phase 4:  >= 180 cumulative
Phase 5:  >= 240 cumulative
Phase 6:  >= 300 cumulative
Phase 7:  >= 360 cumulative
Phase 8:  >= 400 cumulative
Phase 9:  >= 460 cumulative
```

A phase cannot be marked `DONE` unless the cumulative count is met and all
green. Executor reports counts as part of the per-phase report (per V1
execution plan §2 "Evidence" rule).

### 6.3 T2 — AI safety tests are first-class

- AI cannot call payout/approval endpoints directly (I4 enforcement) —
  Phase 7.
- Deterministic engine numbers unchanged before/after LLM call (I3 +
  Phase 6) — property test, 1000 random transactions.
- Cross-user data access returns 403 — Phase 0, must remain green.
- Memory retrieval is lesson-scoped (BL-21 fix) — Phase 0, must remain
  green.

### 6.4 T3 — Visual regression via Playwright MCP

`apps/web` changes run the matrix in `AGENTS.md` "Web verification
(Playwright MCP)" — 375×812, 768×1024, 1280×800, both color schemes,
`reducedMotion: reduce` once. Screenshots to `.playwright-mcp/`. Visual
change requires before/after screenshots of the same page + a written
statement of what visibly changed.

---

## 7. Deployment & Verification

### 7.1 D1 — Single command path

Dev: `docker compose up -d --build`. Prod build: `docker compose -f
docker-compose.yml -f docker-compose.build.yml build`. Prod deploy:
`docker compose -f docker-compose.prod.yml up -d`. Rollback: change
`IMAGE_TAG` in `.env` and re-up. No ad-hoc `docker run` outside compose
(`AGENTS.md`).

### 7.2 D2 — Health gates before marking a deploy complete

- `docker compose config -q` exits 0 (both dev and prod variants).
- `docker compose ps` shows every service `healthy`.
- `curl http://localhost/nginx-health` returns 200.
- `curl http://localhost/api/v1/docs` returns Swagger UI.
- `curl http://localhost/` returns 200 and SSR HTML.

### 7.3 D3 — Image integrity

Prod compose uses image references (`image:`) for runtime rollback, not
just `build:`. Image tag matches `IMAGE_TAG` in `.env`. No `latest` in
prod. Non-root user in runtime stage; `dumb-init` as ENTRYPOINT;
healthcheck inside Dockerfile.

### 7.4 D4 — Migrations are deploy-time reversible

Every Prisma migration applied in a phase has a tested down-migration.
Applied by hand per `prisma migrate diff --from-config-datasource
--to-schema prisma/schema.prisma --script`. Test only on scratch
database, never the dev one (`AGENTS.md`).

### 7.5 D5 — Logs and observability surface

Structured JSON logs, log level configurable via env, retention 30
days. Critical alerts: 5xx rate > 1%, payment failure rate > 0.5%,
BullMQ queue depth > 1000, Redis memory > 80%. All other metrics on
dashboards only (Phase 9).

---

## 8. Risks (Consolidated)

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Schema migration breaks prod data | Medium | Critical | Apply on scratch DB first; never edit applied migrations; reversible up/down |
| Phase ordering assumption wrong (e.g., payment before creator studio) | Low | High | Cross-walk (§1.3); per-phase dependencies explicit in writing-plans output |
| LLM cost spikes under load | Medium | High | Rate-limit per user (Phase 9); two-mode model choice; benchmark before any model change |
| AGENTS.md ownership rules bypassed in PR | Medium | Critical | Grep gate in pre-commit (Phase 0); code-audit step in every PR review; `codebase-memory-mcp` evidence for any structural claim |
| Sandbox engine produces unbalanced statements | Medium | High | Property-based test (fast-check, 1000 random transactions) in Phase 6 |
| Payment loop correctness bug | Low | Critical | Two-phase reservation + commit; idempotency key on every POST; payment integration test with 5× duplicate POST |
| AI agent drift into autonomous behavior | Medium | High | Decision-trace table (Phase 7); I4 enforcement test suite; deterministic policy service as gate |
| Solo executor burnout across 10 phases | Medium | Medium | Per-phase report cadence; explicit `BLOCKED` and `PARTIAL` allowed; owner review between phases |
| V1 execution plan races with 10-phase plan on Phase 0 work | High | Medium | Cross-walk table (§1.3) + per-phase "Cross-Walk" footer so duplicates are spotted before double-work |
| Scope creep in studio UI (Phase 4) | High | Medium | MVP scope is markdown + quiz JSON upload only; rich WYSIWYG deferred to V2 |

---

## 9. Success Criteria for the 10-Phase Plan

| ID | Criterion | Evidence |
|---|---|---|
| SC-1 | All 10 phases have `DONE` status | `docs/progress-tracker.md` shows all 10 phases `DONE` with phase report |
| SC-2 | Sandbox route reachable from a fresh seed | `curl http://localhost/api/v1/sandbox/scenarios` returns seeded scenarios |
| SC-3 | Circular economy loop testable end-to-end | Integration test: student buys credits → creator earns → creator requests payout → payout released after hold window |
| SC-4 | AI agents all behind decision-trace table | `DecisionTrace` rows present for every agent call in last 7 days of staging logs |
| SC-5 | Cumulative test count >= 460 green | CI report |
| SC-6 | Playwright MCP matrix green on apps touched | `.playwright-mcp/` screenshot set for all changed pages |
| SC-7 | AGENTS.md detection grep gate is in CI | `.github/workflows/ci.yml` (or equivalent) runs the detection grep |
| SC-8 | Backup + restore drill executed within last 30 days | `infra/scripts/restore-drill.sh` log |
| SC-9 | No `--no-verify`, no `--force`, no agent commits | `git log --no-merges` shows no commit author matching the agent identifier (e.g., the email or GPG key the agent uses) |
| SC-10 | Per-phase report exists for all 10 phases | `docs/progress-tracker.md` or per-phase report files |

---

## 10. Open Questions Deferred to Writing-Plans

These decisions are out of scope for this spec and the writing-plans
skill will surface them per task:

- **OQ-1**: Is the Phase 5 wallet implementation extended to support a
  third-party payment gateway (Stripe, Midtrans) at the same time as the
  internal credit-loop, or is the credit loop the only path for V1?
- **OQ-2**: Is the AI gateway (Flaz) a hard dependency, or should the
  architecture support a second provider via configuration for HA?
- **OQ-3**: Are analytics dashboards available to creators in the V1
  timeframe, or only in V2 (Phase 8)?
- **OQ-4**: Does the Phase 7 agent ecosystem expose a public marketplace
  (other agents can be plugged in by third parties) or remain internal
  only?
- **OQ-5**: For the I2 projection endpoints, does `ai-api` cache the
  response, or always re-fetch?

---

## 11. Next Step

After this spec is approved, the writing-plans skill produces the
per-phase task plan. That plan is what the executor runs phase-by-phase;
this spec is the architecture-decision layer above it.