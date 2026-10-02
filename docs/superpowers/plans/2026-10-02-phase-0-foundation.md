# Phase 0 — Foundation Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stabilize ReduCera's existing service boundaries and harden cross-cutting rules (SSR, ownership, AI safety) so Phase 1+ work cannot quietly violate them.

**Architecture:** Close every CRITICAL and selected HIGH finding from the verification-delta that still has a real gap. Add the detection-grep CI gate from the 10-phase spec §5.1 so AGENTS.md ownership rules are enforceable in CI.

**Tech Stack:** NestJS 11 (`api`), FastAPI 0.121+ (`ai-api`), Nuxt 4 (`web`), PostgreSQL 15 + Prisma 7, Redis 7 (BullMQ + Celery broker), Qdrant 1.12+, BullMQ, Docker Compose v2, Nginx 1.27.

## Global Constraints

These are project-wide rules that every task's requirements implicitly include.

- All service-to-service HTTP calls forward the original user's bearer token (`AGENTS.md` cross-service boundaries rule 5).
- `ai-api` has no `DATABASE_URL`; `api` has no LLM or Qdrant client (`AGENTS.md` cross-service boundaries).
- One root `.env`. No per-service `.env`. Reference via `${VAR}` in compose with sensible defaults.
- Code, identifiers, and docs in English. User-facing web copy in Indonesian.
- No comments in code, Dockerfiles, compose, nginx, or config files.
- Never `git add`, `git commit`, `git push`, `git reset --hard`, `git rebase`, `git stash drop`. The owner performs stage and commit.
- Never `prisma format`. Never edit an applied migration. Write new migrations by hand using `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script`.
- Test only on a scratch database, never the dev one.
- Never print values from `.env`. Never write a token into a tracked file, a doc, or a log.
- Per `AGENTS.md` Code audit: any structural claim (callers, ownership, removals) is backed by `codebase-memory-mcp` evidence.
- Per `AGENTS.md` Web verification: every change under `apps/web` runs the Playwright MCP matrix at viewports 375x812, 768x1024, 1280x800, both color schemes, `reducedMotion: reduce` once. Screenshots to `.playwright-mcp/`.
- Per `AGENTS.md` AI providers: only `ai-api` and `celery-worker` receive `OPENAI_API_KEY`, `HF_TOKEN`, `HF_EMBEDDING_*`. No LLM/Qdrant credentials in `api`.
- Per `AGENTS.md` Forbidden Actions: never run `docker compose down -v` in production, never edit files inside a running container, never use `latest` in production images, never bypass healthcheck with `condition: service_started` for critical dependencies, never commit `.env` or `infra/nginx/certs/`.

---

## Task 1: Audit current state of Phase 0 acceptance gates

**Files:**
- Read: `docs/strategy/01-verification-delta.md`
- Read: `docs/plans/phased-roadmap.md` (Phase 0 section)
- Create: `docs/progress-tracker.md` (append Phase 0 audit table)

This task verifies the actual current state of every Phase 0 acceptance gate before any code is changed. It prevents the plan from running on stale assumptions.

- [ ] **Step 1: Verify CSP/HSTS headers in nginx response**

Run:
```
curl -fsSI http://localhost/ 2>/dev/null | grep -iE "content-security-policy|strict-transport-security|x-frame-options|permissions-policy"
```
Expected (once `docker compose up -d --build` is running): all six headers present.

If any header is missing, note it in the audit table — Task 3 will add it.

- [ ] **Step 2: Verify tool_semantic_search is lesson-scoped**

Read `services/ai-api/utils/tools/memory.py`. Confirm line ~13-20 contains `tool_semantic_search(userId, lessonId, top_k=15)` calling `_semantic_search(..., allow_fallback=False)`. Run:
```
grep -n "allow_fallback" services/ai-api/utils/tools/memory.py
```
Expected: `allow_fallback=False` on the strict path; `allow_fallback=True` only on the `_with_fallback` variant.

- [ ] **Step 3: Verify QuizEvaluationService exists and is wired**

Run:
```
ls services/api/src/v1/quiz/services/quiz-evaluation.service.ts && \
  grep -n "QuizEvaluationService" services/api/src/v1/quiz/quiz.module.ts
```
Expected: file exists and is registered in the module's providers.

- [ ] **Step 4: Verify ActivityDetectorInterceptor has the intercept bug**

Run:
```
grep -n "intercept\|detect" services/api/src/common/interceptors/daily-activity.interceptor.ts
```
Expected: `intercept(context, next)` does NOT call `this.detect()` — only `next.handle().pipe(...)` is returned. This is the H-001 bug from the verification-delta.

- [ ] **Step 5: Verify ownership checks across all controllers**

Run:
```
grep -rln "@UseGuards(OwnershipGuard)" services/api/src/v1/
```
Expected output includes at minimum:
- `services/api/src/v1/chat/chat-messages/chat-messages.controller.ts`
- `services/api/src/v1/chat/contents/contents.controller.ts`
- `services/api/src/v1/learning/user-steps/user-steps.controller.ts`
- `services/api/src/v1/material/material.module.ts` (or its controller if present)
- `services/api/src/v1/personality-quizzes/` controller (if module exists)
- `services/api/src/v1/learning/user-topics/` controller (if module exists)

Any missing controller is a C-007 gap to fix in Task 4.

- [ ] **Step 6: Verify Celery subprocess spawn is in main.py**

Run:
```
grep -n "subprocess\|celery_app" services/ai-api/main.py
```
Expected: subprocess.Popen call around line 31. This is H-007 to fix in Task 5.

- [ ] **Step 7: Verify ≥30 tests are green today**

Run from repo root:
```
cd services/api && pnpm jest --silent 2>&1 | tail -5
cd services/ai-api && uv run pytest -q 2>&1 | tail -5
```
Expected: both exit 0; report current count to the audit table.

- [ ] **Step 8: Write the audit table**

Append to `docs/progress-tracker.md`:

```
## Phase 0 Audit (YYYY-MM-DD)

| Gate | Status | Evidence |
|---|---|---|
| CSP/HSTS in nginx | PASS / FAIL | curl -I output |
| tool_semantic_search strict | PASS / FAIL | grep output |
| QuizEvaluationService wired | PASS / FAIL | grep output |
| ActivityDetectorInterceptor bug (H-001) | BUG / FIXED | grep output |
| Ownership checks across controllers | PASS / GAPS | grep output |
| Celery subprocess spawn in main.py (H-007) | BUG / FIXED | grep output |
| Test count today | N tests green | test output |
| Detection-grep CI gate | MISSING / PRESENT | grep output |
```

Owner reviews the audit table before Task 2 begins.

---

## Task 2: Add detection-grep CI gate

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `scripts/check-ownership-rules.sh`
- Modify: `.pre-commit-config.yaml` (if it exists; create if not)

This task makes AGENTS.md ownership rules enforceable in CI per spec §5.1 mitigation.

- [ ] **Step 1: Write the failing-script test**

Create `scripts/check-ownership-rules.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

violations=0

grep -rn "prisma\." services/ai-api/ 2>/dev/null && violations=$((violations+1)) || true
grep -rn "DATABASE_URL" services/ai-api/ 2>/dev/null && violations=$((violations+1)) || true
grep -rn "import.*prisma" services/ai-api/ 2>/dev/null && violations=$((violations+1)) || true
grep -rnE "openai|anthropic|google" services/api/src 2>/dev/null && violations=$((violations+1)) || true
grep -rn "qdrant_client\|QdrantClient" services/api/src 2>/dev/null && violations=$((violations+1)) || true
grep -rnE "ChatOpenAI|ChatGoogleGenerativeAI|ChatAnthropic" services/api/src 2>/dev/null && violations=$((violations+1)) || true
grep -rniE "GEMINI_API_KEY|generativelanguage|google.generativeai|langchain_google|GeminiEmbedding|ChatGoogleGenerativeAI" \
  --exclude-dir=node_modules --exclude-dir=.venv --exclude-dir=__tests__ --exclude=*lock* \
  services/ apps/ .env.example docker-compose.yml docker-compose.prod.yml 2>/dev/null \
  && violations=$((violations+1)) || true

if [ "$violations" -gt 0 ]; then
  echo "Ownership rule violations: $violations"
  exit 1
fi
echo "Ownership rules: PASS"
```

- [ ] **Step 2: Run the script to confirm it works**

Run: `chmod +x scripts/check-ownership-rules.sh && ./scripts/check-ownership-rules.sh`
Expected: exits 0 with `Ownership rules: PASS` (no violations today because the known violations were already removed).

- [ ] **Step 3: Add CI workflow**

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  ownership-rules:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Check service ownership rules
        run: bash scripts/check-ownership-rules.sh

  api-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15-alpine
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: test
        ports: ["5432:5432"]
        options: --health-cmd pg_isready --health-interval 10s
      redis:
        image: redis:7-alpine
        ports: ["6379:6379"]
        options: --health-cmd "redis-cli ping" --health-interval 10s
    env:
      TEST_DATABASE_URL: postgresql://test:test@localhost:5432/test
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
          cache-dependency-path: services/api/pnpm-lock.yaml
      - run: pnpm install --frozen-lockfile
        working-directory: services/api
      - run: pnpm prisma migrate deploy
        working-directory: services/api
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/test
      - run: pnpm jest --silent
        working-directory: services/api
```

Note: the example above is the minimum Phase 0 scope. The owner may add `ai-api-tests`, `web-tests`, `build` jobs in a later phase.

- [ ] **Step 4: Verify the workflow YAML parses**

Run: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))" && echo OK`
Expected: prints `OK`.

- [ ] **Step 5: Verify the script still passes after workflow file added**

Run: `./scripts/check-ownership-rules.sh`
Expected: still `Ownership rules: PASS`.

---

## Task 3: Fix ActivityDetectorInterceptor (H-001)

**Files:**
- Modify: `services/api/src/common/interceptors/daily-activity.interceptor.ts`
- Modify: `services/api/src/main.ts` (move interceptor from global to per-handler)
- Create: `services/api/src/v1/__tests__/daily-activity.int.spec.ts`

The interceptor currently calls `intercept(context, next)` but never invokes `this.detect(userId)`. The fix is twofold: only attach the interceptor on handlers that opt in, and call `detect` once per request.

- [ ] **Step 1: Write the failing test**

Create `services/api/src/v1/__tests__/daily-activity.int.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { ActivityDetectorInterceptor } from '@/common/interceptors/daily-activity.interceptor';
import { DailylogsRepo } from '@/v1/gamify/daily-logs/daily-logs.repo';
import { StreaksRepo } from '@/v1/gamify/streaks/streaks.repo';
import { of } from 'rxjs';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { StreakActivity } from '@prisma/client';

describe('ActivityDetectorInterceptor', () => {
  let interceptor: ActivityDetectorInterceptor;
  let dailyLogRepo: { findToday: jest.Mock; create: jest.Mock };
  let streaksRepo: { incrementOrReset: jest.Mock };

  beforeEach(async () => {
    dailyLogRepo = { findToday: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({}) };
    streaksRepo = { incrementOrReset: jest.fn().mockResolvedValue({}) };
    const module = await Test.createTestingModule({
      providers: [
        ActivityDetectorInterceptor,
        { provide: DailylogsRepo, useValue: dailyLogRepo },
        { provide: StreaksRepo, useValue: streaksRepo },
      ],
    }).compile();
    interceptor = module.get(ActivityDetectorInterceptor);
  });

  it('mints a daily activity on first request of the day', async () => {
    const ctx = { switchToHttp: () => ({ getRequest: () => ({ user: { id: 'u1' } }) }) } as unknown as ExecutionContext;
    const next: CallHandler = { handle: () => of('ok') };
    await new Promise<void>((resolve, reject) => {
      interceptor.intercept(ctx, next).subscribe({ next: () => undefined, error: reject, complete: resolve });
    });
    expect(dailyLogRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u1', activityType: StreakActivity.DAILY_LOGIN }),
    );
    expect(streaksRepo.incrementOrReset).toHaveBeenCalledWith('u1', StreakActivity.DAILY_LOGIN);
  });

  it('does not double-mint when daily log already exists', async () => {
    dailyLogRepo.findToday.mockResolvedValue({ id: 'log1' });
    const ctx = { switchToHttp: () => ({ getRequest: () => ({ user: { id: 'u1' } }) }) } as unknown as ExecutionContext;
    const next: CallHandler = { handle: () => of('ok') };
    await new Promise<void>((resolve) => {
      interceptor.intercept(ctx, next).subscribe({ complete: resolve });
    });
    expect(dailyLogRepo.create).not.toHaveBeenCalled();
    expect(streaksRepo.incrementOrReset).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd services/api && pnpm jest src/v1/__tests__/daily-activity.int.spec.ts --silent`
Expected: FAIL. The current `intercept` returns `next.handle()` without reading the user or minting activity.

- [ ] **Step 3: Implement the fix in the interceptor**

Modify `services/api/src/common/interceptors/daily-activity.interceptor.ts`. Replace the `intercept` method body and add the user extraction:

```typescript
intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
  const req = context.switchToHttp().getRequest();
  const userId = req?.user?.id as string | undefined;
  return next.handle().pipe(
    tap({
      next: async () => {
        if (!userId) return;
        const today = new Date();
        const { start, end } = this.getDayRange(today);
        const existingLog = await this.dailyLogRepo.findToday(userId, start, end);
        if (existingLog) return;
        await this.dailyLogRepo.create({
          userId,
          date: today,
          activityType: StreakActivity.DAILY_LOGIN,
        });
        await this.streaksRepo.incrementOrReset(userId, StreakActivity.DAILY_LOGIN);
      },
    }),
  );
}
```

Add `import { tap } from 'rxjs';` at the top with the other rxjs imports.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd services/api && pnpm jest src/v1/__tests__/daily-activity.int.spec.ts --silent`
Expected: PASS, 2 tests.

- [ ] **Step 5: Remove the global binding in main.ts**

Read `services/api/src/main.ts`. If `ActivityDetectorInterceptor` is registered via `app.useGlobalInterceptors(new ActivityDetectorInterceptor(...))` or `APP_INTERCEPTOR`, remove that line. The interceptor is now opt-in per handler.

If it IS registered globally, the failing test from Step 2 already proved the bug. Removal here is the H-001 mitigation.

- [ ] **Step 6: Wire opt-in to the high-signal endpoints**

Pick the high-signal endpoints that SHOULD mint daily activity: `GET /learning/steps`, `POST /quiz/quiz-attempts`, `POST /chat/messages`. Use `@UseInterceptors(ActivityDetectorInterceptor)` decorator on each handler.

If the interceptor needs `DailylogsRepo` and `StreaksRepo` in those modules, register the interceptor via each module's `providers` array (not globally).

- [ ] **Step 7: Verify the full suite still passes**

Run: `cd services/api && pnpm jest --silent 2>&1 | tail -3`
Expected: exits 0, no new failures.

---

## Task 4: Fill ownership-check gaps (C-007)

**Files:**
- Modify: any controller missing `@UseGuards(OwnershipGuard)` per Task 1 Step 5 audit
- Create or extend: `services/api/src/v1/__tests__/ownership.int.spec.ts`

- [ ] **Step 1: Read the audit table**

Open `docs/progress-tracker.md` Phase 0 audit section. Identify the controllers listed as missing `@UseGuards(OwnershipGuard)`.

- [ ] **Step 2: Read the existing guard to confirm its API**

Run:
```
cat services/api/src/v1/common/guards/ownership.guard.ts 2>/dev/null || \
  cat services/api/src/common/guards/ownership.guard.ts 2>/dev/null
```
Expected: a `CanActivate` that compares the request's authenticated user id against the resource's owner id via a route param like `:id` or `:userId`.

If the file path differs, follow the import chain from the chat module (which already uses the guard) to find it.

- [ ] **Step 3: Write the failing cross-user test**

Append to `services/api/src/v1/__tests__/ownership.int.spec.ts`:

```typescript
describe('cross-user ownership (Phase 0)', () => {
  it.each([
    ['chat-messages', 'GET', '/v1/chat/chat-messages/other-user-msg-id'],
    ['contents', 'GET', '/v1/chat/contents/other-user-content-id'],
    ['user-steps', 'GET', '/v1/learning/user-steps/other-user-step-id'],
    ['material', 'GET', '/v1/material/resources/other-user-resource-id'],
  ])('%s rejects cross-user access with 403', async (name, method, path) => {
    const res = await request(app.getHttpServer())
      [method.toLowerCase()](path)
      .set('Authorization', `Bearer ${userAToken}`);
    expect(res.status).toBe(403);
  });
});
```

Adapt the actual route shapes from the controller files. The pattern: each test calls a route that targets a resource owned by `userB` while authenticated as `userA`, and asserts 403.

- [ ] **Step 4: Run the test to verify it fails on the missing controllers**

Run: `cd services/api && TEST_DATABASE_URL=... pnpm jest src/v1/__tests__/ownership.int.spec.ts --silent`
Expected: FAIL on at least the controllers missing the guard.

- [ ] **Step 5: Apply the guard**

For each controller in the failing list:
- Add `@UseGuards(OwnershipGuard)` (and `JwtAuthGuard` if not already present) on the controller class or per-route.
- Register `OwnershipGuard` in the controller's module's `providers` array if it isn't already imported.
- Make sure the route param or DTO carries the resource's `userId` so the guard can compare.

- [ ] **Step 6: Re-run the test**

Run: `cd services/api && TEST_DATABASE_URL=... pnpm jest src/v1/__tests__/ownership.int.spec.ts --silent`
Expected: PASS, all rows green.

---

## Task 5: Remove Celery subprocess spawn from main.py (H-007)

**Files:**
- Modify: `services/ai-api/main.py`
- Create: `services/ai-api/__tests__/main_no_subprocess_spawn.py`

The current `services/ai-api/main.py` calls `subprocess.Popen(["celery", ...])` inside the FastAPI startup. This conflicts with the dedicated `celery-worker` service in `docker-compose.yml`. The fix: remove the subprocess spawn; rely on the dedicated service.

- [ ] **Step 1: Write the failing test**

Create `services/ai-api/__tests__/main_no_subprocess_spawn.py`:

```python
import ast
from pathlib import Path

MAIN = Path(__file__).resolve().parent.parent / "main.py"
source = MAIN.read_text()
tree = ast.parse(source)

spawned = []
for node in ast.walk(tree):
    if isinstance(node, ast.Call):
        func = node.func
        if isinstance(func, ast.Attribute) and func.attr == "Popen":
            spawned.append(ast.unparse(node))

assert not spawned, f"main.py must not call subprocess.Popen; found: {spawned}"
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd services/ai-api && uv run pytest __tests__/main_no_subprocess_spawn.py -v`
Expected: FAIL with `main.py must not call subprocess.Popen; found: [...]`.

- [ ] **Step 3: Remove the subprocess spawn block**

In `services/ai-api/main.py`:
- Remove `import subprocess` (if unused elsewhere).
- Remove the function or block that calls `subprocess.Popen(["celery", ...])` (typically a `start_celery_worker` or `lifespan` startup hook).
- Remove any `print("Celery worker started in background.")` lines associated with it.

Confirm `from contextlib import asynccontextmanager` or FastAPI's `@asynccontextmanager` lifespan is preserved if the app uses one. Do not break unrelated startup logic.

- [ ] **Step 4: Re-run the test**

Run: `cd services/ai-api && uv run pytest __tests__/main_no_subprocess_spawn.py -v`
Expected: PASS.

- [ ] **Step 5: Verify the dedicated celery-worker service is healthy**

Run: `docker compose ps celery-worker`
Expected: `reducera_celery_worker` is `running` and `healthy`.

- [ ] **Step 6: Verify a real embedding job still runs end-to-end**

Trigger an embedding through the API (or the existing dev seed flow). Wait 5 seconds. Run:
```
docker compose logs celery-worker --tail=20 | grep -E "task.*succeeded|content_embeddings"
```
Expected: a `task ... succeeded` line or `content_embeddings` row insert confirmation.

---

## Task 6: Verify quiz evaluation writes isCorrect and score (C-004 verification)

**Files:**
- Read: `services/api/src/v1/quiz/services/quiz-evaluation.service.ts`
- Read: `services/api/src/v1/quiz/quiz-attempts/quiz-attempts.service.ts`
- Create: `services/api/src/v1/__tests__/quiz-evaluation.int.spec.ts`

C-004 may already be implemented (file exists). This task verifies it works end-to-end and locks the wiring with a test.

- [ ] **Step 1: Read the evaluation service**

Run: `cat services/api/src/v1/quiz/services/quiz-evaluation.service.ts`
Expected: a `QuizEvaluationService` with methods for `MULTIPLE_CHOICE` (string compare), `TEXT` (calls ai-api `/ai/v1/evaluator/grade`), `CASE_STUDY` (same).

- [ ] **Step 2: Verify the service is wired**

Run: `grep -n "QuizEvaluationService\|quiz-evaluation" services/api/src/v1/quiz/quiz.module.ts`
Expected: `QuizEvaluationService` is in `providers` and exported.

- [ ] **Step 3: Write the failing integration test**

Create `services/api/src/v1/__tests__/quiz-evaluation.int.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { QuizEvaluationService } from '@/v1/quiz/services/quiz-evaluation.service';

describe('QuizEvaluationService (Phase 0)', () => {
  let service: QuizEvaluationService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [QuizEvaluationService],
    }).compile();
    service = module.get(QuizEvaluationService);
  });

  it('marks MULTIPLE_CHOICE correct on exact match', () => {
    const result = service.evaluate({
      type: 'MULTIPLE_CHOICE',
      correctAnswer: 'A',
      userAnswer: 'A',
    });
    expect(result.isCorrect).toBe(true);
  });

  it('marks MULTIPLE_CHOICE incorrect on mismatch', () => {
    const result = service.evaluate({
      type: 'MULTIPLE_CHOICE',
      correctAnswer: 'A',
      userAnswer: 'B',
    });
    expect(result.isCorrect).toBe(false);
  });

  it('falls back to ai-api evaluator for TEXT', async () => {
    fetchMock.mockResponseOnce(JSON.stringify({ isCorrect: true, score: 0.9, feedback: 'good' }));
    const result = await service.evaluateAsync({
      type: 'TEXT',
      correctAnswer: 'Debit Cash, Credit Service Revenue',
      userAnswer: 'Cash Dr, Service Revenue Cr',
    });
    expect(result.isCorrect).toBe(true);
    expect(result.score).toBe(0.9);
  });
});
```

If the actual service has different method names or signatures, adapt the test to match. The intent: lock the deterministic + LLM-fallback behavior with a test.

- [ ] **Step 4: Run the test**

Run: `cd services/api && TEST_DATABASE_URL=... pnpm jest src/v1/__tests__/quiz-evaluation.int.spec.ts --silent`
Expected: PASS, 3 tests.

If the test fails because of missing methods or wrong signatures, the C-004 gap is real. Implement the missing methods in `QuizEvaluationService` to match the test expectations, then re-run.

- [ ] **Step 5: Verify the QuizAttempt score is updated**

In `services/api/src/v1/quiz/quiz-attempts/quiz-attempts.service.ts`, find where a quiz attempt is submitted. Confirm `quizAttempt.score` is updated from `evaluation.score` and persisted. If not, fix and add a test.

---

## Task 7: Add ≥30 cumulative tests across required coverage areas

**Files:**
- Create or extend: tests in `services/api/src/v1/__tests__/`, `services/api/src/v1/*/__tests__/`, `services/ai-api/utils/tools/__tests__/`, `services/ai-api/v1/learning/__tests__/`

The spec requires ≥30 added tests for Phase 0. They must cover (per phased-roadmap.md Phase 0 acceptance): auth, evaluation, memory, RAG retrieval, streak, leaderboard.

- [ ] **Step 1: Count current tests**

Run:
```
cd services/api && pnpm jest --listTests 2>/dev/null | wc -l
cd services/ai-api && uv run pytest --collect-only -q 2>/dev/null | tail -3
```
Expected output gives a baseline count.

- [ ] **Step 2: Identify coverage gaps**

Read each existing test file briefly. For each of the six areas (auth, evaluation, memory, RAG retrieval, streak, leaderboard), list what's covered and what isn't. The audit from Task 1 lists current state.

- [ ] **Step 3: Add tests to reach ≥30**

For each uncovered area, write a focused integration test. Use existing fixture helpers (`pg-fixtures.ts`, `pg-test-db.ts`, etc.) where they exist. If a fixture helper doesn't exist, copy an existing test that uses one and adapt.

Specific tests to add (each one is a real scenario, not a placeholder):

1. **Auth**: `tests/auth/refresh-token-reuse.spec.ts` — refresh token reuse within the reuse-detection window fails.
2. **Auth**: `tests/auth/jwt-rotation.spec.ts` — access token issued with old JWT_ACCESS_SECRET after rotation fails.
3. **Evaluation**: covered in Task 6.
4. **Memory**: `services/ai-api/utils/tools/__tests__/test_memory_lesson_scope.py` — multi-lesson dataset, `tool_semantic_search` returns only items where `metadata.lessonId` matches.
5. **Memory**: same file — `tool_semantic_search_with_fallback` returns ≤ fallback_limit items when no lesson match, logs at WARNING.
6. **RAG retrieval**: `services/ai-api/v1/learning/__tests__/test_rag_recall.py` — recall ≥ 0.7 on a frozen benchmark of 20 questions × golden chunks.
7. **Streak**: `services/api/src/v1/__tests__/streak-once-per-day.int.spec.ts` — two requests same day increment streak by 1, not 2.
8. **Streak**: `streak-resets-on-missed-day.int.spec.ts` — gap > 24h resets streak to 1.
9. **Leaderboard**: `services/api/src/v1/__tests__/leaderboard-cohort.int.spec.ts` — leaderboard is cohort-scoped, not global.
10. **Ownership**: covered in Task 4.

Each test must be independently runnable and must exit 0 on green.

- [ ] **Step 4: Run the full suite**

Run: `cd services/api && pnpm jest --silent && cd ../ai-api && uv run pytest -q`
Expected: both exit 0; total cumulative test count (existing + new) ≥ 30.

- [ ] **Step 5: Update the audit table**

Append the final test count to `docs/progress-tracker.md` Phase 0 section.

---

## Task 8: Verify the production health gate end-to-end

**Files:**
- Modify: none (verification only)
- Update: `docs/progress-tracker.md`

This task confirms Phase 0's health-gate claims from spec §2.7 / §7.2 actually hold.

- [ ] **Step 1: Bring the dev stack up**

Run: `docker compose up -d --build`
Expected: every service starts.

- [ ] **Step 2: Verify all services healthy**

Run: `docker compose ps --format json | jq -r '.[] | "\(.Name)\t\(.Health)"'`
Expected: every service shows `healthy`. If any shows `starting` or `unhealthy`, wait 30s and retry once. If still unhealthy, note in the audit table and fix before declaring Phase 0 done.

- [ ] **Step 3: Run the four curl gates**

Run:
```
curl -fsS -o /dev/null -w "nginx-health: %{http_code}\n" http://localhost/nginx-health
curl -fsS -o /dev/null -w "api-docs: %{http_code}\n" http://localhost/api/v1/docs
curl -fsS -o /dev/null -w "web-root: %{http_code}\n" http://localhost/
curl -fsSI http://localhost/ 2>/dev/null | grep -iE "content-security-policy|strict-transport-security|x-frame-options|permissions-policy" | wc -l
```
Expected:
- nginx-health: 200
- api-docs: 200
- web-root: 200
- security headers count: 4

- [ ] **Step 4: Verify SSR first-byte theme**

Run: `curl -fsS http://localhost/ | head -50 | grep -iE "theme-color|color-scheme|data-theme"`
Expected: at least one theme-related attribute is present in the first 50 lines of HTML.

If absent, this is a Phase 1 task, not Phase 0. Note it and continue.

- [ ] **Step 5: Verify prod compose config**

Run: `docker compose -f docker-compose.yml -f docker-compose.build.yml config -q`
Expected: exits 0.

Run: `docker compose -f docker-compose.prod.yml config -q`
Expected: exits 0.

- [ ] **Step 6: Update the audit table**

Append a final block to `docs/progress-tracker.md` Phase 0 section:

```
## Phase 0 Verification (YYYY-MM-DD)
- All services healthy: PASS
- nginx-health: 200 / api-docs: 200 / web-root: 200
- Security headers count: 4
- SSR theme present in first 50 lines: PASS / FAIL
- Prod compose config: PASS
```

- [ ] **Step 7: Owner review checkpoint**

Per AGENTS.md, the executor does not commit. Pause here for owner to:
1. Run `git status` and review the diff.
2. Confirm the audit table matches reality.
3. Stage (`git add`) and commit (`git commit`) at their discretion.
4. Confirm Phase 0 is `DONE` in `docs/progress-tracker.md`.

---

## Out of Scope for Phase 0 (deferred to later phases)

- Sandbox route + journal workspace UI: **Phase 1**
- MasteryService, MisconceptionDetector, AdaptivePolicyService: **Phase 2**
- SkillTree, Achievement, StreakRule, badge issuance: **Phase 3**
- CreatorProfile, studio routes, Reviewer capability: **Phase 4**
- Wallet, Transaction, RevenueShare, Withdrawal, HoldWindow: **Phase 5**
- VirtualCompany, JournalEntry, Ledger, FinancialStatement: **Phase 6**
- AgentRegistry, AgentTool, AgentMemory, DecisionTrace: **Phase 7**
- EventLog, MasterySnapshot, EngagementMetric, CreatorOutcomeMetric: **Phase 8**
- RateLimit, BackupRecord, expanded AuditLog, full runbook: **Phase 9**