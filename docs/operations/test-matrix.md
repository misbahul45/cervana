# Test Matrix

> **Status**: `planned` · **Owner**: `qa` · **Last reviewed**: `2026-09-30`
>
> Required test coverage per layer, with current state, gap, and minimum passing criteria.

---

## 1. Current state

```bash
find /home/misbahul45/code/reducera -type f \( -name "*.spec.ts" -o -name "*_test.py" -o -name "test_*.py" \) \
  -not -path "*/node_modules/*" 2>/dev/null
→ /home/misbahul45/code/reducera/services/api/test/app.e2e-spec.ts (stale; expects "Hello World!")
```

**Total: 1 test, currently failing** (no controller returns "Hello World!" in the real app).

---

## 2. Per-layer test matrix

### 2.1 Application API (NestJS)

| Capability | Test type | Count target | Status |
|---|---|---|---|
| Auth: register / login / refresh / logout / verify-email / forgot-password / reset-password | supertest integration | ≥ 6 | [ ] |
| Auth: Arcjet rate limit | supertest integration | ≥ 3 (one per route) | [ ] |
| RolesGuard | unit + integration | ≥ 3 (ADMIN, TEACHER, STUDENT) | [ ] |
| Ownership guard | supertest integration | ≥ 5 (chat, content, user-step, learning-style, lesson-progress) | [ ] |
| Curriculum: topic / subtopic / lesson / step CRUD | supertest | ≥ 4 (one per entity) | [ ] |
| Categories | supertest | ≥ 2 | [ ] |
| Materials: upload + retrieval + callback | supertest + mocks | ≥ 3 | [ ] |
| Quiz: quiz / question / attempt / answer CRUD | supertest | ≥ 4 | [ ] |
| **Quiz evaluation** | unit + integration with golden answers | ≥ 8 (MCQ, free-text, partial credit, edge cases) | [ ] CRITICAL |
| Chat: chat / message / content CRUD | supertest | ≥ 3 | [ ] |
| Learning progress: lesson / step / subtopic / user-step | supertest | ≥ 4 | [ ] |
| Learning style / personality quiz | supertest | ≥ 2 | [ ] |
| Notifications | supertest | ≥ 2 | [ ] |
| Gamification: streak / leaderboard / daily-log | supertest | ≥ 3 | [ ] |
| Orders / Stripe webhook | supertest + signature verification | ≥ 3 | [ ] |
| Teacher application / certification / experience | supertest | ≥ 3 | [ ] |
| Users: create / read / update / delete | supertest | ≥ 4 | [ ] |
| SSE: each controller | supertest + EventSource client | ≥ 8 | [ ] |

**Subtotal target**: ≥ 70 tests.

### 2.2 Database (Prisma)

| Test | Status |
|---|---|
| Migration applies on a clone of production | [ ] |
| Migration rolls back cleanly | [ ] |
| Constraint enforcement (e.g., `@@unique([userId, date])`) | [ ] |
| Cascade deletes (`onDelete: Cascade`) | [ ] |
| Indexes present for hot queries | [ ] |

**Subtotal target**: ≥ 5 tests.

### 2.3 AI service (FastAPI)

| Capability | Test type | Count target | Status |
|---|---|---|---|
| LangGraph #1 (content material pipeline) | pytest with golden input | ≥ 5 | [ ] |
| LangGraph #2 (user-steps pipeline) | pytest with golden input | ≥ 5 | [ ] |
| Personality quiz pipeline | pytest with golden input | ≥ 3 | [ ] |
| Chat continuation pipeline | pytest with golden input | ≥ 3 | [ ] |
| PDF extraction | pytest with sample PDF | ≥ 2 | [ ] |
| YouTube transcript extraction | pytest with sample URL | ≥ 1 | [ ] |
| Whisper fallback | pytest (mocked) | ≥ 1 | [ ] |

**Subtotal target**: ≥ 20 tests.

### 2.4 RAG retrieval

| Test | Status |
|---|---|
| Retrieval precision@5 on labeled set | [ ] |
| Retrieval recall@10 on labeled set | [ ] |
| Retrieval is filtered by `metadata_filter` when set | [ ] |
| Retrieval returns empty list gracefully when no chunks match | [ ] |
| RAG with no Qdrant access fails open (no fabricated citations) | [ ] |

**Subtotal target**: ≥ 5 tests.

### 2.5 Memory

| Test | Status |
|---|---|
| `should_store` policy (≥ 15 cases) | [ ] |
| Retrieval scoring formula (golden vectors) | [ ] |
| Cross-lesson leak returns `[]` (strict mode) | [ ] |
| Decay reduces `last_used_at` weight over time | [ ] |
| Memory isolation: learner A cannot read learner B | [ ] |
| Memory poisoning: instruction-like text rejected | [ ] |
| Memory write rate limit per session | [ ] |

**Subtotal target**: ≥ 7 tests.

### 2.6 Learner Model

| Test | Status |
|---|---|
| Elo golden vectors (8 cases from [`learner-state.md`](../02-architecture/learner-state.md) §3.5) | [ ] |
| Hint usage penalty | [ ] |
| Streak factor (3 correct → 2.0; 3 incorrect → 0.5) | [ ] |
| Time decay (1% per day) | [ ] |
| Misconception resolution after 5 consecutive correct | [ ] |
| Confidence calibration (sigmoid curve) | [ ] |

**Subtotal target**: ≥ 6 tests.

### 2.7 Adaptive Policy

| Test | Status |
|---|---|
| `difficulty` always in `[0, 1]` | [ ] |
| `difficulty` inside `ZoneOfProximalDevelopment` | [ ] |
| `scaffolding = "high"` when open misconceptions ≥ 2 | [ ] |
| 100 random learner-state fixtures produce sensible strategies | [ ] |

**Subtotal target**: ≥ 4 tests.

### 2.8 DSPy optimization

| Test | Status |
|---|---|
| DSPy module compiles | [ ] |
| Optimizer runs against 10 sample episodes | [ ] |
| First `BootstrapFewShot` run improves `overall_score` by ≥ 5% vs baseline | [ ] |
| Candidate prompts persisted with version + metrics | [ ] |
| Optimizer cannot write to frozen benchmark (DB-level constraint) | [ ] |

**Subtotal target**: ≥ 5 tests.

### 2.9 Evaluation

| Test | Status |
|---|---|
| Frozen benchmark has ≥ 50 scenarios with `isFrozen = true` | [ ] |
| Grader agreement with human labels ≥ 0.85 Cohen's κ | [ ] |
| Per-component metric exposed (not opaque aggregate) | [ ] |

**Subtotal target**: ≥ 3 tests.

### 2.10 Authorization / tenant isolation

| Test | Status |
|---|---|
| User A cannot read user B's chat by UUID | [ ] |
| User A cannot patch user B's lesson progress | [ ] |
| User A cannot read user B's memory | [ ] |
| Non-TEACHER cannot create `Resource` | [ ] |
| Non-ADMIN cannot create user | [ ] |
| SSE auth: token required | [ ] |

**Subtotal target**: ≥ 6 tests.

### 2.11 Security / injection

| Test | Status |
|---|---|
| Prompt injection via chat rejected / sandboxed | [ ] |
| Prompt injection via RAG chunk rejected / sandboxed | [ ] |
| Prompt injection via web search result rejected / sandboxed | [ ] |
| Memory poisoning: instruction-like text rejected | [ ] |
| Resource URL not in allow-list rejected | [ ] |
| Resource in quarantine not retrievable | [ ] |
| Stripe webhook signature verification | [ ] |

**Subtotal target**: ≥ 7 tests.

### 2.12 Concurrency

| Test | Status |
|---|---|
| Two simultaneous streak increments yield correct count | [ ] |
| Two simultaneous daily-log writes do not duplicate | [ ] |
| Two simultaneous mastery updates do not lose data | [ ] |
| Two simultaneous quiz submissions do not corrupt attempt | [ ] |

**Subtotal target**: ≥ 4 tests.

### 2.13 End-to-end (Playwright / Cypress)

| Flow | Status |
|---|---|
| Register → login → enroll → take quiz → see result | [ ] |
| Purchase course → access lesson → complete | [ ] |
| Creator publishes course → learner purchases → learner accesses | [ ] |

**Subtotal target**: ≥ 3 flows.

### 2.14 Performance / load

| Test | Status |
|---|---|
| `GET /learning/lesson-progresses` < 100ms p95 with 1k records | [ ] |
| AI service tutor endpoint < 4s p95 (excluding LLM) | [ ] |
| 100 concurrent quiz submissions, no data corruption | [ ] |

**Subtotal target**: ≥ 3 tests.

---

## 3. Total target

| Layer | Count |
|---|---|
| Application API | 70 |
| Database | 5 |
| AI service | 20 |
| RAG | 5 |
| Memory | 7 |
| Learner Model | 6 |
| Adaptive Policy | 4 |
| DSPy | 5 |
| Evaluation | 3 |
| Authorization | 6 |
| Security | 7 |
| Concurrency | 4 |
| E2E | 3 |
| Performance | 3 |
| **Total** | **148** |

Current: **1**. Target: **148**.

---

## 4. CI pipeline

Required gates on every PR:

```
[ ] Lint (eslint on services/api, ruff on ai-api)
[ ] Type check (tsc, mypy)
[ ] Unit tests (Jest, pytest)
[ ] Integration tests (supertest, pytest with containers)
[ ] Migration dry-run (prisma migrate diff)
[ ] AI eval smoke (frozen benchmark on PR change to prompt files)
[ ] Security lint (no prisma in ai-api, no direct LLM call in api, etc.)
[ ] docker compose config valid
[ ] API contract diff review (manual for breaking changes)
```

The `AI eval smoke` gate is critical: any PR touching a prompt file must run the frozen benchmark against the new prompt and post the delta to the PR.

---

## 5. Coverage gates

For a PR to merge, the following must be true for any changed file:

| File type | Coverage floor |
|---|---|
| `services/api/src/v1/**/*.service.ts` | ≥ 70% lines, ≥ 50% branches |
| `services/api/src/v1/**/*.controller.ts` | ≥ 60% lines |
| `services/ai-api/v1/**/*.py` (services, workers) | ≥ 60% lines |
| `services/ai-api/config/*.py` | ≥ 70% lines |
| `services/api/src/common/lib/*.ts` | ≥ 80% lines |
| New Prisma model | migration test + 1 integration test |

---

## 6. Cross-reference

- Where tests fit in the roadmap: [`phased-roadmap.md`](../03-plans/phased-roadmap.md) (each phase has its own test suite)
- Definition of done: [`acceptance-criteria.md`](./acceptance-criteria.md)