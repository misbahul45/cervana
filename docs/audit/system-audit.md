# System Audit — Cervana

> **Status**: `stable` · **Owner**: `architect` · **Last reviewed**: `2026-09-30`
>
> Evidence-based audit of the Cervana repository. Every claim cites a file path.

---

## 1. Scope

This document audits the Cervana repository at the snapshot taken on 2026-09-30. It covers:

- Service inventory and boundaries.
- RAG lifecycle, memory architecture, learner model.
- Gamification, accounting domain, evaluation, observability.
- Security, privacy, testing, failure modes.
- Architectural debt classified by severity.

This is an **audit**, not a plan. For the target architecture and implementation roadmap, see [`docs/02-architecture/target-state.md`](../02-architecture/target-state.md) and [`docs/03-plans/phased-roadmap.md`](../03-plans/phased-roadmap.md).

---

## 2. Findings at a glance

| Area | Status | One-line verdict |
|---|---|---|
| Microservices | `partial` | Split is mostly "Python vs TypeScript", not capability-aligned. |
| RAG | `partial` | Qdrant works; retrieval broken in 1 of 3 flows; no citations. |
| Memory | `partial` | Qdrant memory exists but untyped, with a cross-lesson leak bug. |
| Learner model | `scaffolded` | VARK profile + progress counters; no mastery, no misconception. |
| Gamification | `scaffolded` | Streaks/leaderboard recompute; no learning-event-driven reward. |
| Accounting domain | `scaffolded` | Curriculum hierarchy is solid; no evaluator; no prerequisite graph. |
| Evaluation | `scaffolded` | `Answer.isCorrect` field exists; no service sets it. |
| Self-improvement AI | `referenced` | `notes.md` describes it; no implementation. |
| Security | `partial` | Auth + RBAC + Arcjet; missing ownership, CSP, prompt-injection control. |
| Privacy | `partial` | No retention, no export, no deletion. |
| Observability | `scaffolded` | `console.log` only; no metrics, no traces, no episode log. |
| Tests | `scaffolded` | 1 stale e2e test that asserts `'Hello World!'`. |

---

## 3. Service inventory

| Component | Type | Technology | Responsibility | Dependencies | Status | Evidence |
|---|---|---|---|---|---|---|
| `postgres` | DB | PostgreSQL 15 | OLTP store | Docker volume `postgres_data` | `implemented` | [`docker-compose.yml:4-26`](../../docker-compose.yml), [`postgres/init/01-extensions.sql`](../../postgres/init/01-extensions.sql) |
| `redis` | Cache + broker | Redis 7 | App cache, BullMQ broker, Celery broker, SSE pub/sub | Docker volume `redis_data` | `implemented` | [`docker-compose.yml:28-46`](../../docker-compose.yml) |
| `qdrant` | Vector DB | Qdrant v1.12.4 | Collections `cervana-embedding`, `cervana-memory` | Docker volume `qdrant_data` | `implemented` | [`docker-compose.yml:48-65`](../../docker-compose.yml), [`qdrant/config.yaml`](../../qdrant/config.yaml) |
| `api` | Backend | NestJS 11 + Prisma 7 | Auth, curriculum, gamification, chat, SSE, BullMQ producers | Postgres, Redis, Arcjet, Resend, Cloudinary | `implemented` | [`cervana-api/src/main.ts`](../../cervana-api/src/main.ts), [`app.module.ts`](../../cervana-api/src/app.module.ts) |
| `ai-api` | AI service | FastAPI 0.121 + LangChain + LangGraph + Celery | RAG embeddings, chat generation, 2 LangGraph pipelines, memory | Qdrant, Redis, Tavily, Gemini | `partial` | [`ai-api-cervana/main.py`](../../ai-api-cervana/main.py) |
| `celery-worker` | Worker | Celery 5.5 | Resource extraction, embedding, LangGraph pipelines | Redis, Qdrant, NestJS API | `implemented` | [`ai-api-cervana/config/celery.py`](../../ai-api-cervana/config/celery.py) |
| `web` | Student frontend | Nuxt 4 | Auth, learning pages, chatbot UI, SSE listeners | NestJS API, AI API via Nginx | `partial` | [`web-cervana/app/pages/**`](../../web-cervana/app/pages/) |
| `nginx` | Reverse proxy | Nginx 1.27 | TLS, `/` → Nuxt, `/api/` → NestJS, `/ai/` → FastAPI | All services | `implemented` | [`nginx/nginx.conf`](../../nginx/nginx.conf) |
| Admin frontend (SvelteKit) | UI | SvelteKit 2 | Per README claims `:3001` | – | `referenced` (no code in repo) | [`readme.md:18`](../../readme.md) |

---

## 4. Microservice audit

Each service has a clear purpose and one backing technology, but the **split between `api` and `ai-api` is artificial**:

- `ai-api` is a thin client to `api` for almost every read path. See [`v1/learning/service.py`](../../ai-api-cervana/v1/learning/service.py) where 80% of the file is `requests.post(...)` back into NestJS.
- This is the textbook **distributed monolith** anti-pattern.

| Issue | Severity | Evidence |
|---|---|---|
| Synchronous HTTP fan-out from `ai-api` Celery into `api` | high | [`ai-api-cervana/v1/learning/workers.py:28-30`](../../ai-api-cervana/v1/learning/workers.py) |
| DTO duplication (Pydantic vs Zod) | medium | [`ai-api-cervana/v1/learning/dto.py`](../../ai-api-cervana/v1/learning/dto.py) vs [`cervana-api/src/v1/chat/contents/contents.dto.ts`](../../cervana-api/src/v1/chat/contents/contents.dto.ts) |
| Two Celery startup paths (subprocess in dev, separate service in prod) | high | [`ai-api-cervana/main.py:28-35`](../../ai-api-cervana/main.py) vs [`docker-compose.prod.yml:236-266`](../../docker-compose.prod.yml) |
| No circuit breaker between services | medium | – |

---

## 5. RAG audit

| Stage | Status | Evidence |
|---|---|---|
| Document creation | ✅ | [`cervana-api/src/v1/material/resources/resources.controller.ts:12-19`](../../cervana-api/src/v1/material/resources/resources.controller.ts) |
| Extraction | ✅ | [`ai-api-cervana/v1/resources/service.py:95-128`](../../ai-api-cervana/v1/resources/service.py) |
| Chunking | ✅ semantic + structural fallback | [`ai-api-cervana/config/embedding_pipeline.py:78-102`](../../ai-api-cervana/config/embedding_pipeline.py) |
| Embedding | ✅ Gemini `models/embedding-001` (768-dim) | [`embedding_pipeline.py:35`](../../ai-api-cervana/config/embedding_pipeline.py) |
| Vector store | ✅ Qdrant | [`embedding_pipeline.py:67-68`](../../ai-api-cervana/config/embedding_pipeline.py) |
| Retrieval | 🟡 works, but `metadata_filter` parameter is constructed but never populated | [`embedding_pipeline.py:238-243`](../../ai-api-cervana/config/embedding_pipeline.py) |
| Reranking | ❌ | – |
| Citations | ❌ hard-coded `[]` | [`v1/learning/content_pipeline.py:212`](../../ai-api-cervana/v1/learning/content_pipeline.py), [`v1/learning/workers.py:75`](../../ai-api-cervana/v1/learning/workers.py) |
| Authority tier | ❌ all docs equal | – |
| Document versioning | ❌ | – |
| Freshness filter | ❌ | – |

**Verdict**: GLOBAL RAG, not learner-aware. Broken in 1 of 3 retrieval paths (see §17).

---

## 6. Memory audit

| Layer | Implementation | Quality |
|---|---|---|
| Working memory | Postgres `chat_messages.text` | raw text, no extraction |
| Episodic memory | ❌ not represented | – |
| Semantic learner memory | Qdrant `cervana-memory` | untyped, no decay, cross-lesson leak (see §17) |
| Procedural memory | ❌ not represented | – |
| External knowledge | Qdrant `cervana-embedding` + Postgres `resources` | mixed with chat content |

**Memory write policy**: every LLM output writes a memory entry — most are not educationally meaningful. The fix is a typed, decay-aware 4-layer schema; see [`docs/02-architecture/target-state.md` §4.3](../02-architecture/target-state.md#43-memory-architecture).

**Cross-lesson leak bug** (CRITICAL):

```python
# ai-api-cervana/utils/tools/memory.py:25-33
filtered = [m for m in items if m.get("metadata", {}).get("lessonId") == lessonId
            or m.get("metadata", {}).get("lesson_id") == lessonId]
if filtered:
    return filtered
return items[:5]   # ← always falls back to cross-lesson memory
```

The `or` condition and unconditional fallback mean cross-lesson memory is always eligible for retrieval.

---

## 7. Gamification audit

| Mechanism | Storage | Code path |
|---|---|---|
| XP / souls / stars | `User.totalPoints/souls/stars` | ❌ no service mutates them |
| Streaks | `User.currentStreak/longestStreak` + `StreakHistory` | ✅ via `ActivityDetectorInterceptor` |
| Daily activity | `DailyActivityLog` | same interceptor |
| Leaderboard | `LeaderboardScore` | ✅ `LeaderboardsRepo.incrementScore` for every 7-day streak |
| Badges / Achievements | `Achievement` + `UserAchievement` | ❌ no evaluator |
| Themes | `Theme` + `ThemeIcon` | cosmetic |

**Streak farming risk**: `ActivityDetectorInterceptor` (`cervana-api/src/common/interceptors/daily-activity.interceptor.ts:44-49`) fires on **every authenticated request**. Any ping mints a streak; leaderboard score increments every 7 days.

---

## 8. Learner model audit

Existing fields per Prisma schema:

| Field | Classification (per audit-style master prompt §7) |
|---|---|
| `User.email`, `User.name` | FACT |
| `LearningStyleProfile.visual/auditory/reading/kinesthetic` | PREFERENCE / INFERENCE (self-report) |
| `PersonalityQuiz.questions/userAttempt/result` | OBSERVATION + INFERENCE (mixed JSON) |
| `LessonProgress.percentage/isDone` | DERIVED METRIC |
| `StepProgress.progress/isDone` | DERIVED METRIC |
| `SubTopicProgress.progress/completed` | DERIVED METRIC |
| `UserTopic.progressPercent` | DERIVED METRIC |
| `User.currentStreak/longestStreak/souls/stars/totalPoints` | DERIVED METRIC |
| `StreakHistory.streakCount` | OBSERVATION |
| `DailyActivityLog.activityType` | OBSERVATION |
| `LeaderboardScore.score` | DERIVED METRIC |
| `QuizAttempt.score/status` | – (never set) |

**Missing entirely**: `goals`, `knowledge/mastery`, `confidence`, `misconceptions`, `strengths/weaknesses`, `preferred_explanation_style`, `error_pattern`, `hint_dependency`, `difficulty_tolerance`, `retention_curve`.

The full target model is in [`docs/02-architecture/learner-state.md`](../02-architecture/learner-state.md).

---

## 9. Accounting domain audit

Curriculum hierarchy (Prisma):

```
Category → Topic → SubTopic → Lesson → Step → Resource
                    └→ UserTopic → UserStep (per-user copy)
                                 → Quiz (per-step, attempts, answers)
                    └→ LessonProgress, StepProgress, SubTopicProgress
```

This 5-level hierarchy is sound. Missing: a `Prerequisite` relation between concepts.

```text
Accounting Equation → Debit/Credit → Journal Entry → Ledger →
Trial Balance → Adjusting Entries → Financial Statements
```

The system does not represent this dependency graph.

---

## 10. Evaluation audit

| Dimension | Status | Evidence |
|---|---|---|
| Correctness (quiz grading) | ❌ `Answer.isCorrect` and `QuizAttempt.score` never set | [`quiz-attempts.service.ts:14-22`](../../cervana-api/src/v1/quiz/quiz-attempts/quiz-attempts.service.ts) is pure CRUD |
| Grounding (RAG citation) | ❌ | – |
| Pedagogical quality | ❌ | – |
| Personalization | ❌ | – |
| Difficulty alignment | ❌ | – |
| Learning gain | ❌ | – |
| Safety | ❌ | – |
| Offline eval set | ❌ | – |
| Online metrics | ❌ | – |
| Frozen benchmark | ❌ | – |
| LLM-as-judge | ❌ | – |

---

## 11. Observability audit

| Aspect | Status |
|---|---|
| Structured JSON logs | ❌ `console.log` only |
| Metrics | ❌ |
| Distributed tracing (OTel) | ❌ |
| Per-task `trace_id` / `run_id` | ❌ |
| Token usage tracking | ❌ |
| Cost tracking | ❌ |
| Evaluation result persistence | ❌ |

---

## 12. Security audit

| Aspect | Status |
|---|---|
| Authentication (JWT + Google OAuth) | ✅ |
| RBAC (RolesGuard) | ✅ |
| Rate limiting (Arcjet fixedWindow) | ✅ on auth routes |
| SSE auth guard | ✅ |
| Ownership checks on chat / learning routes | ❌ |
| CSP / HSTS / Permissions-Policy headers | ❌ |
| Prompt injection defense | 🟡 instruction-only (no input segmentation) |
| RAG URL allow-list | ❌ (`extract_pdf` fetches arbitrary URLs) |
| Multi-tenant isolation | ❌ no `orgId` field anywhere |

---

## 13. Privacy audit

| Aspect | Status |
|---|---|
| Data minimization in prompts | ✅ PII not in prompts |
| Retention policy | ❌ no TTL on chat messages, memory, sessions |
| Export | ❌ |
| Deletion | ❌ no `DELETE /users/me` |

---

## 14. Testing audit

| Test type | Count | Evidence |
|---|---|---|
| Unit tests | 0 | – |
| Integration tests | 0 | – |
| E2E tests | 1 (stale) | [`cervana-api/test/app.e2e-spec.ts:23`](../../cervana-api/test/app.e2e-spec.ts) |
| AI evaluation | 0 | – |
| Contract tests | 0 | – |
| Load tests | 0 | – |
| Security tests | 0 | – |
| Python tests | 0 | – |

---

## 15. Performance audit

| Concern | Status | Evidence |
|---|---|---|
| LLM calls per content generation | ~3 calls (translate, analyze, generate) | [`v1/learning/content_pipeline.py:70-205`](../../ai-api-cervana/v1/learning/content_pipeline.py) |
| Translation flag default `True` | 🟡 doubles embedding cost | [`config/embedding_pipeline.py:111-115`](../../ai-api-cervana/config/embedding_pipeline.py) |
| Sequential chunk embedding | 🟡 20 chunks × N resources = sequential API calls | [`embedding_pipeline.py:209-217`](../../ai-api-cervana/config/embedding_pipeline.py) |
| No prompt caching | 🟡 re-sends full chat history | – |

---

## 16. Architectural debt (classified)

### CRITICAL (must fix before any production deployment)

| ID | Issue | Evidence | Impact |
|---|---|---|---|
| C-001 | `/chat/contents/similarity` endpoint missing | `grep -rn similarity cervana-api/src → 0`; caller: [`v1/learning/service.py:33-51`](../../ai-api-cervana/v1/learning/service.py) | Chat continuation path always fails |
| C-002 | `contents.repo.ts` queries `content_embeddings` table but no such Prisma model | `grep content_embeddings cervana-api/prisma → 0` | Dead code or runtime failure |
| C-003 | `addContentEmbeddingJob` enqueues to `content` queue but no `content.processor.ts` | [`queues/index.ts:3`](../../cervana-api/src/v1/queue/queues/index.ts) vs filesystem | Chat contents never get embedded |
| C-004 | Quiz evaluation missing — `Answer.isCorrect`/`pointsEarned`/`QuizAttempt.score` never set | – | No learning signal flows back |
| C-005 | `tool_semantic_search` cross-lesson leak | [`utils/tools/memory.py:25-33`](../../ai-api-cervana/utils/tools/memory.py) | Wrong user memory in prompts |
| C-006 | No tests; stale `app.e2e-spec.ts` asserts `'Hello World!'` | [`cervana-api/test/app.e2e-spec.ts:23`](../../cervana-api/test/app.e2e-spec.ts) | Cannot ship safely |
| C-007 | No ownership checks on chat/user-step routes | – | UUID-guessing authorization bypass |

### HIGH

| ID | Issue | Evidence |
|---|---|---|
| H-001 | `ActivityDetectorInterceptor` mints streaks on any authenticated ping | [`daily-activity.interceptor.ts:44-49`](../../cervana-api/src/common/interceptors/daily-activity.interceptor.ts) |
| H-002 | RAG citations hard-coded to `[]` | [`v1/learning/content_pipeline.py:212`](../../ai-api-cervana/v1/learning/content_pipeline.py) |
| H-003 | Document URLs fetched from arbitrary hosts (SSRF + RAG poisoning) | [`v1/resources/service.py:115-127`](../../ai-api-cervana/v1/resources/service.py) |
| H-004 | Prompt-injection defense is instruction-only | All prompt templates |
| H-005 | `enable_translation=True` default | [`config/embedding_pipeline.py:111-115`](../../ai-api-cervana/config/embedding_pipeline.py) |
| H-006 | No CSP / HSTS / Permissions-Policy headers | [`nginx/nginx.conf`](../../nginx/nginx.conf) |
| H-007 | Two Celery startup paths | [`ai-api-cervana/main.py:28-35`](../../ai-api-cervana/main.py) vs [`docker-compose.prod.yml:236-266`](../../docker-compose.prod.yml) |
| H-008 | No OpenTelemetry / metrics / traces | – |
| H-009 | No evaluation harness / frozen benchmark | – |
| H-010 | No rate limiting on ai-api endpoints | – |

### MEDIUM

| ID | Issue |
|---|---|
| M-017 | Distributed monolith: ai-api is thin client to api |
| M-018 | DTO duplication (Pydantic vs Zod) |
| M-019 | No metrics / traces / OpenTelemetry |
| M-020 | Learning style submission has no validation |
| M-021 | Streak `incrementScore` only triggers on multiples of 7 |
| M-022 | `notes.md` claims a `daily-stats-sse` cron — doesn't exist (files now deleted) |
| M-023 | `learning-style-profile` form sends raw text `dominantStyle` |
| M-024 | OAuth callback requires Google creds; without them, email/password only |
| M-025 | `notes.md` claims unit tests — none exist (files now deleted) |
| M-026 | `notes.md` claims NestJS BullMQ workers for `ocr`, `video` — comment-out only |
| M-027 | Admin frontend (SvelteKit) referenced by readme but no code in repo |
| M-028 | `@nestjs/platform-socket.io`, `socket.io` in package.json — unused |
| M-029 | `@nestjs/websockets` — unused |
| M-030 | `@langchain/*` in api package — unused |
| M-031 | `langchain` in api package — unused |
| M-032 | `pdf-parse`, `pg`, `multer`, `cloudinary` in api deps but only `cloudinary` referenced |

### LOW

| ID | Issue |
|---|---|
| L-033 | No multi-tenant boundary (`orgId` everywhere) |
| L-034 | No event sourcing / outbox |
| L-035 | Readme says "SvelteKit admin" — no code |
| L-036 | Readme says "8 GB RAM minimum" but `hf_cache` may exceed on first Whisper download |

---

## 17. Critical bugs in detail

### 17.1 `GET /chat/contents/similarity` does not exist

The `ai-api` service calls this endpoint to retrieve chat history for context:

```python
# ai-api-cervana/v1/learning/service.py:33-51
def query_content_history(chatId: str, q: str, token: str) -> Any:
    base_url = f"{ENVS['NEST_API']}/chat/contents/similarity"
    ...
```

A `grep` of the NestJS code shows no controller defines this route. Every chat continuation request fails on this line. The fallback `if except: return []` masks the failure.

**Fix**: implement `GET /chat/contents/similarity?chatId=&query=` in NestJS, OR refactor `ai-api` to read from Qdrant directly (and stop calling NestJS for chat context).

### 17.2 `contents.repo.ts` queries a non-existent table

```typescript
// cervana-api/src/v1/chat/contents/contents.repo.ts:72-86
async findById(id: string) {
  const embeddingsMetadata = await this.prisma.$queryRaw<...>`
    SELECT id, chunk_text as "chunkText", metadata, created_at as "createdAt", updated_at as "updatedAt"
    FROM content_embeddings
    WHERE content_id = ${id}
    ORDER BY created_at
  `;
  return { ...content, embeddingsMetadata };
}
```

The Prisma schema has no `content_embeddings` model. The `contents` table is mapped to `contents` via `@@map`. The query will fail at runtime unless such a table is created out-of-band.

### 17.3 `content` queue has no processor

```typescript
// cervana-api/src/v1/queue/queues/index.ts
export const QUEUES = [
  { name: 'knowledge' },
  { name: 'content' },       // ← declared
  { name: 'user-steps' }
];
```

```typescript
// queue.module.ts
providers: [
  QueueService,
  KnowledgeProcessor,
  UserStepsProcessor,
  StepsRepo
  // ← no ContentProcessor
]
```

The `addContentEmbeddingJob` method exists in `QueueService` ([`cervana-api/src/v1/queue/queue.service.ts:17-27`](../../cervana-api/src/v1/queue/queue.service.ts)) and is called from `contents.repo.ts:128-133`, but no worker consumes the queue. Embeddings for chat contents accumulate forever.

### 17.4 Quiz evaluation is missing

`Answer.isCorrect: Boolean` and `QuizAttempt.score: Float?` exist in the schema but no service ever sets them. Searches:

```
grep -rn "isCorrect\s*=" cervana-api/src --include="*.ts" \
  | grep -v node_modules | grep -v ".dto.ts" | grep -v "doc.ts"
→ 0 results
```

The learner answers are persisted in `Answer.userAnswer` but never graded. The full learning-evaluation loop is missing.

### 17.5 Cross-lesson memory leak

See §6.

### 17.6 No tests

The single e2e test asserts `'Hello World!'` which is not what any controller returns. CI would fail if it ran.

### 17.7 No ownership checks

The chat, content, and user-step controllers do not check `req.user.id === resource.userId`. A student who knows another student's UUID can read or modify their resources.

---

## 18. Verdict

Cervana today is best described as:

> A functional Docker-orchestrated, multi-service web application with a real-but-narrow RAG pipeline, two LangGraph flows, working auth, working queue-based async, and a partially-modeled gamification layer. It is not yet the agentic, self-improving, misconception-tracking accounting tutor that the README describes.

The critical missing piece is the **learning-evaluation loop**: without quiz grading, there is no mastery signal, no misconception model, and no adaptive next-action. These are prerequisites for the "self-improvement" the project aspires to.

The roadmap to close these gaps is in [`docs/03-plans/phased-roadmap.md`](../03-plans/phased-roadmap.md).

---

## 19. Evidence citations

Files inspected during this audit (non-exhaustive):

- [`docker-compose.yml`](../../docker-compose.yml), [`docker-compose.prod.yml`](../../docker-compose.prod.yml)
- [`cervana-api/prisma/schema.prisma`](../../cervana-api/prisma/schema.prisma), [`cervana-api/prisma/seed.ts`](../../cervana-api/prisma/seed.ts)
- [`cervana-api/src/app.module.ts`](../../cervana-api/src/app.module.ts), [`main.ts`](../../cervana-api/src/main.ts)
- [`cervana-api/src/v1/**/*.ts`](../../cervana-api/src/v1/) (all modules)
- [`cervana-api/src/v1/queue/queues/`](../../cervana-api/src/v1/queue/queues/)
- [`cervana-api/src/v1/sse/`](../../cervana-api/src/v1/sse/) (all SSE controllers)
- [`ai-api-cervana/main.py`](../../ai-api-cervana/main.py), [`config/celery.py`](../../ai-api-cervana/config/celery.py)
- [`ai-api-cervana/config/embedding_pipeline.py`](../../ai-api-cervana/config/embedding_pipeline.py), [`memory_embedding.py`](../../ai-api-cervana/config/memory_embedding.py)
- [`ai-api-cervana/v1/learning/*.py`](../../ai-api-cervana/v1/learning/), [`v1/users_steps/*.py`](../../ai-api-cervana/v1/users_steps/), [`v1/resources/*.py`](../../ai-api-cervana/v1/resources/)
- [`web-cervana/app/pages/**`](../../web-cervana/app/pages/), [`components/my-learning/Chatbot.vue`](../../web-cervana/app/components/my-learning/Chatbot.vue), [`PersonalityQuiz.vue`](../../web-cervana/app/components/my-learning/PersonalityQuiz.vue), [`LearningStyleForm.vue`](../../web-cervana/app/components/my-learning/LearningStyleForm.vue)
- [`nginx/nginx.conf`](../../nginx/nginx.conf)
- [`qdrant/config.yaml`](../../qdrant/config.yaml)
- [`postgres/init/01-extensions.sql`](../../postgres/init/01-extensions.sql)