# Microservice Boundary Audit

> **Status**: `stable` · **Owner**: `architect` · **Last reviewed**: `2026-09-30`
>
> Whether ReduCera's two-service architecture actually maintains the boundary between **Application API (source of truth)** and **FastAPI AI (intelligence)**. This audit deepens findings from [`system-audit.md`](./system-audit.md) along the axes of *business-logic location*, *tool permissions*, *concurrency*, *cache safety*, and *prompt-injection defense*.

---

## 1. Scope and method

This audit answers 17 questions from the master prompt:

1. Microservice boundaries correct?
2. Database ownership correct?
3. Business logic correctly located?
4. AI service appropriately isolated?
5. AI agent state correctly managed?
6. Learner modeling correctly designed?
7. Memory correctly designed?
8. Adaptive policy correctly designed?
9. RAG separated from business data?
10. DSPy integration safely possible?
11. Evaluation independent from optimization?
12. Longitudinal personalization supported?
13. Data flows explicit and traceable?
14. Service-to-service contracts robust?
15. Production-ready?
16. Research-ready?
17. Controlled self-improvement possible?

Findings are evidence-cited. Companion docs cover specific angles.

---

## 2. Service inventory (recap)

| Service | Runtime | Port | Owns | Direct dependencies | Evidence |
|---|---|---:|---|---|---|
| `services/api` (Application API) | NestJS 11 + Prisma 7 | 3002 | Postgres, Redis (cache + queue), auth | `npm run build` | [`services/api/src/main.ts`](../../services/api/src/main.ts) |
| `services/ai-api` (AI Service) | FastAPI + LangChain + LangGraph + Celery | 3003 | Qdrant collections, LLM provider, Tavily | [`services/ai-api/main.py`](../../services/ai-api/main.py) |
| `celery-worker` | Celery 5.5 | – | Embedding + LangGraph pipelines | [`docker-compose.prod.yml:236-266`](../../docker-compose.prod.yml) |
| `web` | Nuxt 4 | 3000 | – | [`apps/web/app/pages/`](../../apps/web/app/pages/) |
| `nginx` | Nginx 1.27 | 80/443 | – | [`infra/nginx/nginx.conf`](../../infra/nginx/nginx.conf) |
| Postgres | PG 15 | 5432 (internal) | DB | [`docker-compose.yml:4-26`](../../docker-compose.yml) |
| Redis | Redis 7 | 6379 (internal) | Cache + queue + broker | – |
| Qdrant | Qdrant v1.12.4 | 6333 (internal) | Vector DB | – |

---

## 3. Service responsibility matrix

Capabilities and their correct owner, with current reality:

| Capability | Correct owner | Current owner | Status | Evidence |
|---|---|---|---|---|
| Authentication | Application API | Application API | ✅ | [`auth.controller.ts`](../../services/api/src/v1/auth/auth.controller.ts) |
| Authorization (RBAC) | Application API | Application API | 🟡 partial (only `categories` + `resources` use `@Roles`) | See [`api-inventory.md`](./api-inventory.md) |
| Authorization (ownership) | Application API | ❌ not enforced | ❌ | See [`api-inventory.md` §3.2](./api-inventory.md) |
| User profile | Application API | Application API | ✅ | – |
| Course data | Application API | Application API | ✅ | – |
| Lesson data | Application API | Application API | ✅ | – |
| Material / Resource | Application API | Application API | 🟡 no learner access | – |
| Enrollment | Application API | Application API | ✅ | – |
| Quiz / Question | Application API | Application API | ✅ | – |
| Attempt | Application API | Application API | 🟡 no evaluator | – |
| Score / `isCorrect` | Application API | ❌ never set | ❌ | – |
| Learning event | Application API | 🟡 partial | – |
| Learner model (mastery, misconception) | Application API | ❌ not implemented | ❌ | – |
| Memory (long-term) | AI Service | AI Service | 🟡 partial (Qdrant reducera-memory) | – |
| Memory schema authority | Application API | ❌ no schema | ❌ | – |
| RAG corpus (curriculum) | AI Service | AI Service | ✅ | – |
| RAG retrieval | AI Service | AI Service | ✅ | – |
| LLM calls | AI Service | AI Service | ✅ | – |
| Agent orchestration | AI Service | 🟡 LangGraph linear | – |
| Adaptive policy | Application API (deterministic) | ❌ inside LLM | ❌ | – |
| Evaluation (frozen) | AI Service worker | ❌ not implemented | ❌ | – |
| Optimization (DSPy) | AI Service worker | ❌ not installed | ❌ | – |
| Audit logging | Application API | 🟡 console.log only | – |
| Tracing | Application API + AI Service | ❌ not implemented | ❌ | – |
| Payment | Application API | ✅ (Midtrans/Stripe) | – |
| Refund | Application API | 🟡 partial | – |
| Tutor / admin endpoints | Application API | ✅ | – |

**Verdict**: the responsibility matrix is mostly correct **in design** (the AGENTS.md `Service Ownership` rule already codifies this). The reality is that several "Application" responsibilities are partially implemented (auth, ownership) and one critical capability (evaluation, mastery) is missing entirely from both sides.

---

## 4. Source-of-truth classification

The master prompt requires distinguishing:

```
RAW DOMAIN DATA          → Application API
AI-DERIVED STATE         → AI Service (derived)
AI EXPERIMENTAL STATE    → AI Service worker (sandboxed)
```

Mapping current tables:

| Table | Owner today | Classification | Notes |
|---|---|---|---|
| `User` | Application API | RAW DOMAIN | Identity |
| `Session` | Application API | RAW DOMAIN | Auth |
| `Topic`, `SubTopic`, `Lesson`, `Step` | Application API | RAW DOMAIN | Curriculum |
| `Quiz`, `Question` | Application API | RAW DOMAIN | – |
| `QuizAttempt`, `Answer` | Application API | RAW DOMAIN | Score is currently never computed |
| `Chat`, `ChatMessage`, `Content` | Application API | RAW DOMAIN | Content is LLM output but persisted as raw text |
| `Resource` | Application API | RAW DOMAIN | – |
| `LessonProgress`, `StepProgress`, `SubTopicProgress`, `UserTopic`, `UserStep` | Application API | RAW DOMAIN (with AI-derivable projections) | – |
| `LearningStyleProfile`, `PersonalityQuiz` | Application API | RAW DOMAIN (mostly user-declared) | – |
| `StreakHistory`, `DailyActivityLog`, `LeaderboardScore` | Application API | AI-DERIVED (auto-computed) | – |
| `Achievement`, `UserAchievement` | Application API | AI-DERIVED (no evaluator) | – |
| `Notification` | Application API | RAW DOMAIN | – |
| `Order` | Application API | RAW DOMAIN | – |
| `Theme`, `ThemeIcon` | Application API | RAW DOMAIN (visual config) | – |
| Qdrant `reducera-embedding` | AI Service | EXTERNAL KNOWLEDGE | – |
| Qdrant `reducera-memory` | AI Service | AI-DERIVED (learner state) | – |

**Observation**: the system has only two states — RAW DOMAIN and AI-DERIVED (and even AI-DERIVED is minimal). There is **no AI EXPERIMENTAL STATE** at all. When DSPy is introduced, it must write candidate artifacts only into AI EXPERIMENTAL STATE, never into RAW DOMAIN.

The `content_embeddings` raw SQL query in [`contents.repo.ts:80`](../../services/api/src/v1/chat/contents/contents.repo.ts) reads from a table that does not exist in the Prisma schema. This is either dead code or pre-existing AI EXPERIMENTAL STATE; either way it must be reconciled.

---

## 5. Database ownership audit

CRITICAL RULE: the AI service must not connect directly to Postgres.

Verification:

```bash
grep -rn "DATABASE_URL\|prisma\|createPool\|pg\b" services/ai-api/ \
  --include="*.py" 2>/dev/null | grep -v __pycache__
→ 0 results
```

The AI service does **not** import Prisma, SQLAlchemy, or any DB driver. All DB data is fetched via HTTP to the Application API using the user's bearer token (e.g., [`services/ai-api/v1/learning/service.py:13-86`](../../services/ai-api/v1/learning/service.py)).

**Verdict**: ✅ DB ownership is respected. The AI service is correctly isolated from Postgres.

At audit time the Application API had one violation: `services/api/src/common/lib/embeding.ts` called Gemini directly for embeddings ("AI logic in API layer"). Resolved 2026-09-30: the file had no callers (graph `trace_path` inbound and `grep` both empty) and was deleted, together with the unused LLM dependencies of `api`.

---

## 6. Business logic location audit

The master prompt warns: "Identify business logic accidentally implemented inside prompts or LLM reasoning."

Searching for rules that should be code:

| Prompt hint | Business rule being asked of LLM | Where it should live | Risk |
|---|---|---|---|
| [`v1/learning/content_pipeline.py:148-152`](../../services/ai-api/v1/learning/content_pipeline.py) | Prompt says "if outside scope, respond with 'Maaf...' " | Should be a deterministic scope check before LLM call | high — LLM may ignore |
| [`v1/users_steps/generate_user_steps_pipeline.py:344-352`](../../services/ai-api/v1/users_steps/generate_user_steps_pipeline.py) | LLM is told "OUTPUT MUST be JSON ONLY" and given a strict schema; no code validation before passing to `api` | Should be a JSON-schema validator on the LLM output before downstream use | high — empty `QuizResponse` is the fallback |
| [`v1/users_steps/service.py:114-118`](../../services/ai-api/v1/users_steps/service.py) | `tool_memory_upsert` always writes regardless of content quality | Should be a write-policy gate based on extraction rules | medium — Qdrant memory will fill with low-value entries |
| [`v1/users_steps/service.py:25-33`](../../services/ai-api/v1/users_steps/service.py) | `tool_semantic_search` falls back to top-5 unfiltered memory if lesson-scoped is empty | Should be a fallback decision, not silent | high — cross-lesson leak documented elsewhere |
| [`v1/learning/content_pipeline.py:71`](../../services/ai-api/v1/learning/content_pipeline.py) | "use Indonesian, professional" — language is a UI contract | Should be a structured output schema with `language` field | low |
| [`v1/learning/content_pipeline.py:177-205`](../../services/ai-api/v1/learning/content_pipeline.py) | "Panjang: 300-700 kata" — length is a UX constraint | Should be enforced via token-count validation | low |
| [`v1/users_steps/generate_quiz_pipeline.py:60-141`](../../services/ai-api/v1/users_steps/generate_quiz_pipeline.py) | LLM is told "Material-Bound" but only by prompt | Should be a content filter on retrieved chunks before injection | medium — LLM may hallucinate beyond scope |
| [`v1/learning/workers.py:73-80`](../../services/ai-api/v1/learning/workers.py) | "citatetions: []" hard-coded — citations are presented as if real but are empty | Should fail-fast if no citations were retrieved | critical — false-grounding risk |

**Verdict**: at least 4 cases (out-of-scope, citations, JSON schema, memory fallback) embed business rules in prompts. Each must be migrated to deterministic code.

---

## 7. AI state ownership

Classifying existing AI state:

| State | Where | Storage | Owner |
|---|---|---|---|
| Conversation (per request) | In-memory | Python dict | AI Service |
| Memory (long-term) | Qdrant `reducera-memory` | Vector DB | AI Service |
| Embeddings (RAG) | Qdrant `reducera-embedding` | Vector DB | AI Service |
| Memory of previous prompt versions | none | – | ❌ not implemented |
| Memory of policy versions | none | – | ❌ not implemented |
| Optimizer state | none | – | ❌ not implemented |
| Experiment state | none | – | ❌ not implemented |
| Decision trace | none | – | ❌ not implemented |

AI state is mostly **session-only**. There is no persistent trace, no version registry, no experiment record. This makes DSPy integration and self-improvement impossible today.

The fix is documented in [`data-model.md`](../02-architecture/data-model.md) §2.3 (`Episode`, `InteractionEvaluation`, `DecisionTrace`, `PromptVersion`, `PolicyVersion`, `Experiment`, `OptimizationRun`).

---

## 8. Service contract audit

For every API endpoint that ai-api calls into api, classify:

| Caller | Endpoint | Auth | Timeout | Retry | Idempotent? | Error contract | Trace ID |
|---|---|---|---|---|---|---|---|
| content_pipeline.py:13-22 | `PATCH /chat/chat-messages/:id` | bearer token | 15s | none | yes | raise_for_status | none |
| content_pipeline.py:23-30 | `POST /chat/contents` | bearer token | 15s | none | no | raise_for_status | none |
| users_steps/service.py:13-21 | `GET /material/resources/:id` | bearer token | 15s | none | yes | raise_for_status | none |
| users_steps/service.py:55-63 | `GET /curriculum/lessons/:id` | bearer token | 15s | none | yes | raise_for_status | none |
| users_steps/service.py:65-74 | `GET /learning/user-steps/:id` | bearer token | 15s | none | yes | raise_for_status | none |
| learning/service.py:33-51 | `GET /chat/contents/similarity` | bearer token | 15s | none | yes | `if except: return []` | none |
| learning/workers.py:28-30 | `POST /chat/contents` (callback) | bearer token | 15s | none | no | raise_for_status | none |
| users_steps/workers.py:38-39 | `POST /learning/personality-quizzes` | bearer token | 15s | none | no | raise_for_status | none |
| user-steps.processor.ts:44-58 | `POST /ai/v1/users-steps/generate` | bearer token | 300s (nginx) | none | no | raise_for_status | none |
| knowledge.processor.ts:30-48 | `POST /ai/v1/resources/{extract,embedding}` | bearer token | 300s (nginx) | 3× backoff (Celery) | yes (resource) | raise_for_status | none |

**Observations**:

- **Timeouts**: 15s in code, 300s at nginx. Discrepancy is fine (nginx is the outer ceiling).
- **Retries**: Celery retries 3× with exponential backoff. Within the synchronous `requests.post` calls, **no retry**.
- **Idempotency**: only `knowledge.processor.ts` retries — but `user-steps` POSTs are not idempotent. A Celery retry could create duplicate `UserStep` rows.
- **Error contract**: every call uses `raise_for_status`. There is no domain error mapping. When the user-facing API returns 500, the AI worker does not know if it is transient or permanent.
- **Trace ID**: not propagated. The Application API has no `X-Trace-Id` header, the AI service does not emit one.

**Critical gap**: the `if except: return []` in [`learning/service.py:32-51`](../../services/ai-api/v1/learning/service.py) silently masks errors. The tutor pipeline continues with empty chat history.

---

## 9. Tool audit

The "agents" use these tools (read or write to what):

| Tool | Where defined | Purpose | Permissions | Side effects |
|---|---|---|---|---|
| `EmbeddingPipeline.retrieve` | [`config/embedding_pipeline.py:231-255`](../../services/ai-api/config/embedding_pipeline.py) | Vector search over `reducera-embedding` | R | none |
| `tool_web_search` | [`utils/tools/web_search.py`](../../services/ai-api/utils/tools/web_search.py) | Tavily search | R | external HTTP to Tavily |
| `MemoryManager.upsert` | [`config/memory_embedding.py:65-88`](../../services/ai-api/config/memory_embedding.py) | Insert into `reducera-memory` | W | writes to vector store |
| `MemoryManager.retrieve` | [`config/memory_embedding.py:90-126`](../../services/ai-api/config/memory_embedding.py) | Retrieve from `reducera-memory` | R | none |
| REST GETs (lesson, step, etc.) | [`v1/users_steps/service.py`](../../services/ai-api/v1/users_steps/service.py) | Read learner state from api | R | none |
| REST POSTs (`/chat/contents`, `/learning/personality-quizzes`) | `workers.py` | Write AI output | W | persistent DB writes |

**Findings**:

- All tools are **R or W** (read or write). There are **no EXTERNAL ACTION** tools — no agent can send email, place an order, change billing.
- This is correct (lowest privilege), but also reflects that the agents are **content generators**, not autonomous actors.
- The Tavily tool is unbounded — `limit=10` per call but no domain allow-list. A malicious tutor could embed instructions in a public website that gets retrieved and fed to the LLM.
- The `MemoryManager.upsert` is called on every LLM output (see [`config/memory_embedding.py:65-88`](../../services/ai-api/config/memory_embedding.py)). It has no write policy. The caller (`utils/tools/memory.py:40-55`) wraps it but doesn't add filtering either.

The AI service does **not** use any formal tool-calling framework (no `bind_tools`, no `ToolNode`). Tools are imported as Python functions and called from LangGraph node bodies. This means there is no per-tool permission or sandbox; if a node function calls something, it calls it.

---

## 10. Concurrency and consistency

Identifying places where two requests could race:

| Place | Race | Consequence | Fix |
|---|---|---|---|
| `streaks.repo.ts:136-171` `incrementOrReset` | Two simultaneous requests from the same user | Double-increment of streak count | Add `@@unique([userId, date])` to `StreakHistory` (already present) + use `INSERT ... ON CONFLICT DO NOTHING` |
| `daily-activity.interceptor.ts:13-49` | Two pings within ms | Two `DailyActivityLog` rows for same day | Check-then-insert is not atomic; use `INSERT ... ON CONFLICT` or `find_or_create_by_date` with serializable transaction |
| `mastery` (future) | Two attempts at the same time | Wrong Elo update (uses stale state) | Optimistic locking: `UPDATE ... WHERE version = $expected_version` |
| `leaderboards.repo.ts:151-174` `incrementScore` | Two increments in flight | Score lost | Read-modify-write not atomic; use `score: { increment: ... }` in raw Prisma (already done) but no row lock — OK for global counter |
| `personality-quizzes.service.ts:168` `addUserStepsJob` after submit | Same submit clicked twice | Duplicate user-steps generation | Idempotency key on the submit endpoint |
| `contents.repo.ts:122-133` `addContentEmbeddingJob` | Same content updated twice | Duplicate embeddings in Qdrant | Already idempotent via Qdrant vector IDs (but currently dead code — see C-003) |

Consistency guarantees needed:

| Data | Required consistency | Rationale |
|---|---|---|
| `User` row updates | strong | Auth-critical |
| `Order` + payment | strong | Money |
| `QuizAttempt.score`, `Answer.isCorrect` | strong | Grading integrity |
| `TopicMasteryRecord.score` | eventual (per attempt) is OK | Elo is self-correcting |
| Memory writes | eventual | Conflict resolution via timestamp |
| `DecisionTrace` | strong (append-only) | Auditability |
| `OptimizationRun` | strong (immutable history) | Auditability |
| Experiment results | strong (append-only) | Reproducibility |

The current implementation achieves "strong" by relying on single-row `UPDATE` semantics in Prisma. Multi-row or conditional updates (e.g., "read score, then update") are not transactional.

---

## 11. Cache key safety

Searching Redis usage:

| Use | Key pattern | Safety |
|---|---|---|
| BullMQ queue | `bull:<queue-name>:<job-id>` | ✅ isolated by BullMQ |
| SSE event bus | Subject (in-memory) | ✅ not persisted |
| `Arcjet` rate-limit | per-IP | ✅ |
| `daily-activity.interceptor.ts` | writes `DailyActivityLog` row, no cache | n/a |

**There is no application-level Redis cache.** No memory cache, no RAG cache, no LLM cache, no policy cache.

Implication for AI service:

- No opportunity for cross-learner cache poisoning (good).
- But also: every AI call goes straight to Qdrant + LLM. There is no opportunity to cache expensive RAG queries (cost optimization deferred).

---

## 12. DSPy readiness classification

| Question | Answer |
|---|---|
| Are prompts modular? | 🟡 partial — each LangGraph node has a separate prompt, but within a node, system+user+tutorial are concatenated inline |
| Are inputs structured? | ❌ prompts receive JSON strings, not typed objects |
| Are outputs structured? | 🟡 partial — only `QuizResponse` uses `with_structured_output`; others use regex parsing |
| Is evaluation measurable? | ❌ no eval set, no scorer |
| Is there an optimization dataset? | ❌ no `Episode` log |
| Is there a validation dataset? | ❌ |
| Is there a frozen benchmark? | ❌ |
| Is the agent deterministic enough to compare? | ❌ LLM is non-deterministic; temperature=0.2 |

**DSPy readiness: NOT READY.**

Roadmap to READY:
1. Implement `Episode` log (Phase 2).
2. Implement frozen benchmark (Phase 7).
3. Refactor prompts to typed modules.
4. Make every LLM call use `with_structured_output`.
5. Implement scorer (LLM-as-judge with rubric).
6. Run baseline twice to establish non-determinism noise floor.

Estimated: 8–10 weeks of focused work. See [`phased-roadmap.md`](../03-plans/phased-roadmap.md) §Phases 2, 6, 7, 8, 9.

---

## 13. Evaluation independence

| Component | Current | Independent? |
|---|---|---|
| Per-interaction evaluator | ❌ not implemented | n/a |
| Frozen eval set | ❌ not implemented | n/a |
| LLM-as-judge | ❌ not implemented | n/a |
| Optimizer | ❌ not installed | n/a |

Once implemented, the eval must be a **separate worker** in `ai-api` that:

- Reads from `Episode` log via `api` (no direct DB).
- Writes `InteractionEvaluation` rows via `api`.
- Has its own prompt version (so optimizing the tutor prompt does not affect scoring).
- Cannot modify the frozen benchmark.

This is consistent with the AGENTS.md §Service Ownership rule: the frozen benchmark lives in `api` (Postgres); the eval worker reads it via HTTP; the worker cannot write to it.

---

## 14. Test matrix

Per-layer test coverage needed:

| Layer | Test type | Currently exists | Required |
|---|---|---|---|
| Application API contract | supertest + Jest | 🟡 1 stale e2e (`app.e2e-spec.ts:23` asserts "Hello World!") | ≥ 30 tests |
| Database | integration with testcontainers | ❌ | ≥ 10 tests on critical queries |
| AI agent | pytest + golden vectors | ❌ | ≥ 5 end-to-end tests per LangGraph |
| RAG retrieval | precision/recall on labeled set | ❌ | ≥ 1 labeled eval set, 50 scenarios |
| Memory | unit + integration | ❌ | ≥ 5 tests for write policy + retrieval scoring |
| Learner model | unit (golden vectors) | ❌ | ≥ 8 Elo vectors |
| Adaptive policy | property-based | ❌ | ≥ 100 random learner states |
| DSPy optimization | golden vector replay | ❌ | ≥ 1 baseline run + 1 improvement run |
| Frozen benchmark | regression suite | ❌ | ≥ 50 scenarios |
| Tenant isolation | security test | ❌ | ≥ 1 cross-tenant access attempt per endpoint |
| Prompt injection | red-team corpus | ❌ | ≥ 5 injection attempts |
| Memory poisoning | red-team corpus | ❌ | ≥ 3 attempts |
| RAG poisoning | red-team corpus | ❌ | ≥ 3 attempts |
| Concurrency | integration | ❌ | ≥ 1 double-submit test per critical path |
| E2E happy-path | playwright/cypress | ❌ | ≥ 3 critical user journeys |

Current total: **1 test**. Target: ≥ 60.

---

## 15. Self-improvement boundaries

Three loops, three cadences, three owners:

| Loop | Cadence | Owner | Mutates |
|---|---|---|---|
| Fast (learner adaptation) | per interaction | Application API (mastery, memory writes) | `TopicMasteryRecord`, `EpisodicMemory`, `SemanticLearnerMemory` |
| Medium (policy adaptation) | daily/weekly | Optimizer worker (ai-api) | `PromptVersion` (DRAFT only); reads via api |
| Slow (system optimization) | weekly/monthly | DSPy optimizer worker + human approval | `PromptVersion` (ACTIVE); reads `OptimizationRun` |

Hard rule: **no loop writes to `prompt_versions` without `decidedBy = human`** at the slow loop. The DB-level check on `OptimizationRun.decidedBy` enforces this.

---

## 16. Gap matrix

| Area | Current | Target | Gap | Severity | Action |
|---|---|---|---|---|---|
| Microservice boundaries | mostly correct | enforced | `embeding.ts` direct Gemini call (resolved 2026-09-30, file deleted) | CRITICAL | none open |
| DB ownership | ✅ correct | correct | none | – | – |
| Business logic in prompts | at least 4 cases | 0 cases | out-of-scope, citations, schema, memory fallback | HIGH | move to deterministic code |
| Tool permissions | all tools R or W | same | no formal tool-calling framework | MEDIUM | introduce `bind_tools` if going agentic |
| Service contracts | bearer-token HTTP | typed contracts | no trace_id, no idempotency keys | HIGH | add per contract |
| Concurrency | mostly serial | Some PR notes | streak/daily-log races | MEDIUM | atomic upserts |
| Cache | none | none | none | – | – |
| Memory schema | untyped | typed 4-layer | none | HIGH | see `data-model.md` §2.2 |
| Adaptive policy | inside LLM | explicit deterministic | none | HIGH | see `target-state.md` §4.4 |
| RAG vs memory | mixed in same store | separate | same Qdrant instance | MEDIUM | separate collections |
| Evaluation | none | offline + online | none | CRITICAL | build per Phase 7 |
| DSPy | not installed | installed after Phase 7 | none | P2 | – |
| Tenant isolation | none | enforced at SQL level | none | CRITICAL | filter by `userId` |
| Prompt injection | instruction-only | segment inputs by trust | none | HIGH | XML fences |
| Memory poisoning | no write policy | explicit policy | none | HIGH | see `target-state.md` §4.3 |
| RAG poisoning | unfiltered URLs | allow-list + quarantine | none | HIGH | see `phased-roadmap.md` §Phase 0 |
| Tests | 1 stale | ≥ 60 tests | none | CRITICAL | see §14 above |

---

## 17. Definition of done (architecture)

| Criterion | Status |
|---|---|
| ✓ Application Service owns domain truth | ✅ (except `embeding.ts`) |
| ✓ AI Service owns AI intelligence | ✅ (no DB access) |
| ✓ Database ownership is explicit | ✅ |
| ✓ Service contracts are typed | 🟡 partial (DTOs exist but no machine-readable contract ID per call) |
| ✓ Authentication is centralized | ✅ |
| ✓ Authorization is enforced | 🟡 only `categories` + `resources` use `@Roles`; ownership not enforced |
| ✓ Learner context is scoped | ❌ (see audit §6) |
| ✓ Learner Model is derived and versioned | ❌ not implemented |
| ✓ Memory is learner-scoped | 🟡 partial (Qdrant filter exists but unused) |
| ✓ Memory has provenance/confidence | ❌ |
| ✓ RAG is separated from learner memory | 🟡 separate collections but same Qdrant instance |
| ✓ Adaptive Policy is explicit | ❌ |
| ✓ Prompt construction is modular | 🟡 |
| ✓ Agent orchestration is observable | ❌ no OTel |
| ✓ Evaluation is independent | ❌ |
| ✓ Frozen benchmark exists | ❌ |
| ✓ DSPy has measurable objectives | ❌ |
| ✓ Optimization is asynchronous | ✅ (Celery-based) |
| ✓ Candidate versions are isolated | ❌ (no version registry yet) |
| ✓ Acceptance gate exists | ❌ |
| ✓ Rollback exists | ❌ |
| ✓ Tenant isolation exists | ❌ |
| ✓ Prompt injection is addressed | ❌ |
| ✓ Memory poisoning is addressed | ❌ |
| ✓ RAG poisoning is addressed | ❌ |
| ✓ Service failures have deterministic handling | 🟡 (Celery retries, but `if except: return []` masks errors) |
| ✓ Tests cover critical paths | ❌ |
| ✓ Documentation matches implementation | 🟡 (this audit + companion docs are catching up) |

**Score: 4/27 ✅, 6/🟡, 17/❌**. The architecture is mostly correctly designed; the implementation has not caught up.

---

## 18. Cross-references

- Detailed API endpoint inventory: [`api-inventory.md`](./api-inventory.md)
- Authorization gaps: [`authorization-audit.md`](./authorization-audit.md)
- AI service contracts: [`ai-contract-audit.md`](./ai-contract-audit.md)
- Prompt injection, memory poisoning, RAG poisoning: [`security-audit.md`](./security-audit.md)
- Concurrency model: [`concurrency-and-consistency.md`](../04-operations/concurrency-and-consistency.md)
- Test coverage requirements: [`test-matrix.md`](../04-operations/test-matrix.md)
- Tool permissioning: [`tool-audit.md`](./tool-audit.md)
- Where business rules should live (not in prompts): [`business-logic-location-audit.md`](./business-logic-location-audit.md)