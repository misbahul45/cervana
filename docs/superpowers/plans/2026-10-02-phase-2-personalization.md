# Phase 2 — Personalized AI Learning Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move ReduCera from "deliver lessons" to "deliver the right next lesson for this learner" via deterministic mastery tracking, rule-based misconception detection, short + long memory, and an adaptive policy that picks the next activity. The LLM explains, never decides.

**Architecture:** Four new Prisma models (`MasteryScore`, `MisconceptionPattern`, `MemoryRecord`, `AdaptivePolicy`) with hand-written migrations. Four deterministic services in `api` (`MasteryService`, `MisconceptionDetector`, `MemoryService`, `AdaptivePolicyService`) that hook into the existing quiz-attempt flow. One new agent in `ai-api` (`CurriculumAgent`) that calls `AdaptivePolicyService` over HTTP with the user's bearer token. Mastery dashboard widgets in `web` consume server-rendered mastery data (no waterfall).

**Tech Stack:** NestJS 11, Prisma 7, FastAPI 0.121+, LangGraph (existing), Nuxt 4 SSR, pnpm + uv, BullMQ (no new queues).

## Global Constraints

Same global constraints as Phases 0 and 1. Plus:

- Mastery, misconception detection, and adaptive policy are deterministic (per spec I1 / AI-7 / §5.3 Notable Risks mitigation). The LLM explains the misconception; the deterministic engine classifies it.
- Memory retrieval is `lessonId`-strict (per spec §4.3 AI-3 + Phase 0 fix). Cross-lesson recall only via explicit `allowCrossLesson: true` from `AdaptivePolicyService`.
- `ai-api` has no `DATABASE_URL`; it calls `api` over HTTP for mastery, misconception, and adaptive-policy reads (per spec I2).
- Service-to-service calls forward the user's bearer token (per spec I1 + AGENTS.md cross-service boundaries rule 5).
- Schema additions follow the FK `SetNull` rule from Phase 0 BL-01 mitigation (per spec §3.2 #3).
- `WebhookService.addMemoryJob` exists in the existing content queue (referenced by Phase 0 Task 5). The memory extraction task in Phase 2 enqueues jobs there; the consumer is the existing content processor or a new `memory.processor.ts` added in this phase.

---

## Task 1: Audit current state of personalization

**Files:**
- Read: `services/api/src/v1/learning/` (existing progress services)
- Read: `services/api/prisma/schema.prisma` (look for `MasteryScore`, `MisconceptionPattern`, `MemoryRecord`, `AdaptivePolicy`)
- Read: `services/api/src/v1/quiz/quiz-attempts/quiz-attempts.service.ts` (the quiz submission hook point)
- Read: `services/ai-api/v1/learning/router.py` (existing learning endpoints)
- Create: `docs/progress-tracker.md` (append Phase 2 audit table)

- [ ] **Step 1: Verify the four target tables do not exist yet**

Run:
```
grep -nE "model MasteryScore|model MisconceptionPattern|model MemoryRecord|model AdaptivePolicy" \
  services/api/prisma/schema.prisma
```
Expected: no matches.

- [ ] **Step 2: Verify the existing progress services track attempt-level data**

Run:
```
ls services/api/src/v1/learning/lesson-progresses/ && \
  ls services/api/src/v1/learning/step-progresses/ && \
  grep -n "score\|isCorrect" services/api/src/v1/learning/step-progresses/step-progresses.service.ts | head -10
```
Expected: progress services write per-step-percentage or per-step-correctness data. This is the input to MasteryService in Task 3.

- [ ] **Step 3: Verify the quiz submission hook point**

Run:
```
grep -n "create\|submit" services/api/src/v1/quiz/quiz-attempts/quiz-attempts.service.ts | head -10
```
Expected: a method like `submitAttempt(quizAttemptId)` or `create(quizAttemptInput)` that persists `QuizAttempt` + `Answer` rows and sets `QuizAttempt.score`.

The mastery update hook in Task 3 attaches to the existing service.

- [ ] **Step 4: Verify `ai-api` has no direct DB access**

Run:
```
grep -rn "DATABASE_URL\|prisma\." services/ai-api/ 2>/dev/null
```
Expected: no matches (per Phase 0 detection-grep gate + spec I2).

- [ ] **Step 5: Verify the existing chat pipeline**

Run:
```
grep -rn "extract\|memory" services/ai-api/utils/tools/ 2>/dev/null | head
```
Expected: `memory.py` exists (per Phase 0 Task 1 Step 2 confirmation). Phase 2 adds an HTTP call to `api /v1/memory` for distillation.

- [ ] **Step 6: Write the audit table**

Append to `docs/progress-tracker.md`:

```
## Phase 2 Audit (YYYY-MM-DD)

| Item | Status | Evidence |
|---|---|---|
| MasteryScore, MisconceptionPattern, MemoryRecord, AdaptivePolicy models | MISSING / PARTIAL | grep output |
| Existing progress services (lesson-progress, step-progress) | PRESENT / BROKEN | ls + grep output |
| Quiz submission hook point | IDENTIFIED | grep output |
| ai-api DATABASE_URL absent | PASS / FAIL | grep output |
| ai-api memory.py exists | PASS / FAIL | grep output |
```

---

## Task 2: Add Prisma models + hand-written migrations

**Files:**
- Modify: `services/api/prisma/schema.prisma` (add 4 models)
- Create: `services/api/prisma/migrations/<timestamp>_personalization_foundation/migration.sql`
- Create: `services/api/prisma/migrations/__tests__/personalization-invariants.int.spec.ts`

Per spec §3.1, Phase 2 schema adds `MasteryScore`, `MisconceptionPattern`, `MemoryRecord`, `AdaptivePolicy`. Hand-written per the AGENTS.md Prisma rule.

- [ ] **Step 1: Read the existing `User` and `QuizAttempt` models for relation references**

Run:
```
grep -nE "model User|model QuizAttempt|model Lesson|model Topic" services/api/prisma/schema.prisma
```
Note the field names for `id`, `userId`, `quizId`, `lessonId`, etc., so the new models reference them correctly.

- [ ] **Step 2: Add the four models to schema.prisma**

Append to `services/api/prisma/schema.prisma` after the `QuizAttempt` model:

```prisma
model MasteryScore {
  id           String   @id @default(cuid())
  userId       String
  topicId      String
  score        Float
  attempts     Int      @default(0)
  lastSeenAt   DateTime @default(now())
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, topicId])
  @@index([userId, score])
}

model MisconceptionPattern {
  id           String   @id @default(cuid())
  userId       String
  topicId      String
  patternCode  String
  evidence     Json
  confidence   Float
  resolvedAt   DateTime?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, topicId, resolvedAt])
}

model MemoryRecord {
  id           String   @id @default(cuid())
  userId       String
  lessonId     String?
  kind         MemoryKind
  payload      Json
  decayAt      DateTime?
  createdAt    DateTime @default(now())

  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, kind, createdAt])
  @@index([userId, lessonId, kind])
}

enum MemoryKind {
  SHORT_TERM
  LONG_TERM_PROFILE
  LONG_TERM_MISCONCEPTION
}

model AdaptivePolicy {
  id             String   @id @default(cuid())
  userId         String
  topicId        String
  nextActivityId String?
  rationale      Json
  appliedAt      DateTime @default(now())

  user           User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, appliedAt])
}
```

Also add the back-relations to the `User` model:

```prisma
model User {
  // ... existing fields ...
  masteryScores        MasteryScore[]
  misconceptions       MisconceptionPattern[]
  memoryRecords        MemoryRecord[]
  adaptivePolicies     AdaptivePolicy[]
}
```

If the actual relation field name on `User` differs (e.g., `mastery`), adapt. The skill says "If the actual route shapes from the controller files. The intent..." — same principle: read the existing model and match.

- [ ] **Step 3: Generate the migration SQL**

Run:
```
cd services/api && pnpm prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script
```
Expected: SQL for the four `CREATE TABLE` statements + the enum + back-relations.

Save the output to `services/api/prisma/migrations/<timestamp>_personalization_foundation/migration.sql`. The timestamp must come AFTER the most recent applied migration. Run `ls services/api/prisma/migrations/ | tail -1` to find the latest.

- [ ] **Step 4: Apply on a scratch DB (per AGENTS.md)**

Run:
```
TEST_DATABASE_URL=postgresql://... pnpm prisma migrate deploy
```
Expected: applies cleanly.

Verify the four tables exist:
```
TEST_DATABASE_URL=postgresql://... psql -c "\dt" | grep -E "MasteryScore|MisconceptionPattern|MemoryRecord|AdaptivePolicy"
```

- [ ] **Step 5: Write the failing invariant test**

Create `services/api/prisma/migrations/__tests__/personalization-invariants.int.spec.ts`:

```typescript
import { PrismaService } from '@/common/config/prisma/prisma.service';
import { Test } from '@nestjs/testing';

describe('Personalization schema invariants (Phase 2)', () => {
  let prisma: PrismaService;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      providers: [PrismaService],
    }).compile();
    prisma = module.get(PrismaService);
  });

  it('enforces unique (userId, topicId) on MasteryScore', async () => {
    const user = await prisma.user.create({ data: { email: 'ms-uniq@test', role: 'STUDENT' as any } });
    const topic = await prisma.topic.create({ data: { name: 'Topic MS Uniq', level: 1 } });
    await prisma.masteryScore.create({ data: { userId: user.id, topicId: topic.id, score: 0.5 } });
    await expect(
      prisma.masteryScore.create({ data: { userId: user.id, topicId: topic.id, score: 0.6 } })
    ).rejects.toThrow();
    await prisma.user.delete({ where: { id: user.id } });
    await prisma.topic.delete({ where: { id: topic.id } });
  });

  it('cascade deletes MemoryRecord when User is deleted', async () => {
    const user = await prisma.user.create({ data: { email: 'mr-casc@test', role: 'STUDENT' as any } });
    await prisma.memoryRecord.create({
      data: { userId: user.id, kind: 'SHORT_TERM', payload: { note: 'hello' } },
    });
    await prisma.user.delete({ where: { id: user.id } });
    const after = await prisma.memoryRecord.findFirst({ where: { userId: user.id } });
    expect(after).toBeNull();
  });

  it('cascades MisconceptionPattern with User deletion', async () => {
    const user = await prisma.user.create({ data: { email: 'mc-casc@test', role: 'STUDENT' as any } });
    const topic = await prisma.topic.create({ data: { name: 'Topic MC Casc', level: 1 } });
    await prisma.misconceptionPattern.create({
      data: { userId: user.id, topicId: topic.id, patternCode: 'debit_credit_swap', evidence: {}, confidence: 0.7 },
    });
    await prisma.user.delete({ where: { id: user.id } });
    const after = await prisma.misconceptionPattern.findFirst({ where: { userId: user.id } });
    expect(after).toBeNull();
    await prisma.topic.delete({ where: { id: topic.id } });
  });
});
```

- [ ] **Step 6: Run the test**

Run: `cd services/api && TEST_DATABASE_URL=... pnpm jest prisma/migrations/__tests__/personalization-invariants.int.spec.ts --silent`
Expected: PASS, 3 tests.

---

## Task 3: Implement `MasteryService` (deterministic)

**Files:**
- Create: `services/api/src/v1/personalization/mastery/mastery.service.ts`
- Create: `services/api/src/v1/personalization/mastery/mastery.repo.ts`
- Create: `services/api/src/v1/personalization/mastery/mastery.controller.ts`
- Create: `services/api/src/v1/personalization/mastery/mastery.module.ts`
- Create: `services/api/src/v1/personalization/mastery/__tests__/mastery.service.spec.ts`
- Create: `services/api/src/v1/personalization/mastery/__tests__/mastery-update-on-attempt.int.spec.ts`

The mastery score for a (user, topic) pair updates deterministically when a quiz attempt completes. The update rule: weighted exponential moving average (EMA) of attempt scores. The EMA weight `α = 0.3` is configurable.

- [ ] **Step 1: Write the failing unit test for the deterministic rule**

Create `services/api/src/v1/personalization/mastery/__tests__/mastery.service.spec.ts`:

```typescript
import { MasteryService } from '../mastery.service';

describe('MasteryService.updateScore (deterministic EMA)', () => {
  let service: MasteryService;

  beforeEach(() => {
    const repo = { upsert: jest.fn().mockImplementation(async (input) => ({ id: 'm1', ...input })) };
    service = new MasteryService(repo as any, 0.3);
  });

  it('first attempt initializes score to attempt score', () => {
    const next = service.computeNextScore({ previousScore: null, previousAttempts: 0, attemptScore: 0.8, alpha: 0.3 });
    expect(next).toBeCloseTo(0.8);
  });

  it('second attempt blends: 0.3 * new + 0.7 * previous', () => {
    const next = service.computeNextScore({ previousScore: 0.5, previousAttempts: 1, attemptScore: 0.9, alpha: 0.3 });
    expect(next).toBeCloseTo(0.3 * 0.9 + 0.7 * 0.5);
  });

  it('clamps to [0, 1]', () => {
    expect(service.computeNextScore({ previousScore: null, previousAttempts: 0, attemptScore: 1.5, alpha: 0.3 })).toBe(1);
    expect(service.computeNextScore({ previousScore: null, previousAttempts: 0, attemptScore: -0.2, alpha: 0.3 })).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd services/api && pnpm jest src/v1/personalization/mastery/__tests__/mastery.service.spec.ts --silent`
Expected: FAIL — service doesn't exist.

- [ ] **Step 3: Implement the service**

Create `services/api/src/v1/personalization/mastery/mastery.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { MasteryRepo } from './mastery.repo';

@Injectable()
export class MasteryService {
  constructor(private readonly repo: MasteryRepo, private readonly alpha: number = 0.3) {}

  computeNextScore(input: { previousScore: number | null; previousAttempts: number; attemptScore: number; alpha?: number }): {
    const a = input.alpha ?? this.alpha;
    const score = input.attemptScore;
    const clamped = Math.max(0, Math.min(1, score));
    if (input.previousScore === null || input.previousAttempts === 0) {
      return clamped;
    }
    return Math.max(0, Math.min(1, a * clamped + (1 - a) * input.previousScore));
  }

  async updateFromAttempt(userId: string, topicId: string, attemptScore: number): Promise<{ score: number }> {
    const existing = await this.repo.findByUserAndTopic(userId, topicId);
    const next = this.computeNextScore({
      previousScore: existing?.score ?? null,
      previousAttempts: existing?.attempts ?? 0,
      attemptScore,
    });
    const upserted = await this.repo.upsert({
      userId,
      topicId,
      score: next,
      attempts: (existing?.attempts ?? 0) + 1,
      lastSeenAt: new Date(),
    });
    return { score: upserted.score };
  }

  async listByUser(userId: string) {
    return this.repo.listByUser(userId);
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd services/api && pnpm jest src/v1/personalization/mastery/__tests__/mastery.service.spec.ts --silent`
Expected: PASS.

- [ ] **Step 5: Implement the repo**

Create `services/api/src/v1/personalization/mastery/mastery.repo.ts` with `findByUserAndTopic(userId, topicId)`, `upsert(input)`, `listByUser(userId)`. Wraps `prisma.masteryScore`. Follow the pattern in `services/api/src/v1/chat/contents/contents.repo.ts`.

- [ ] **Step 6: Implement the controller + module**

Create `services/api/src/v1/personalization/mastery/mastery.controller.ts`:

```typescript
import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/v1/common/guards/jwt-auth.guard';
import { OwnershipGuard } from '@/v1/common/guards/ownership.guard';
import { CurrentUser } from '@/v1/common/decorators/current-user.decorator';
import { MasteryService } from './mastery.service';

@Controller('v1/personalization/mastery')
@UseGuards(JwtAuthGuard)
export class MasteryController {
  constructor(private readonly mastery: MasteryService) {}

  @Get('me')
  list(@CurrentUser() user: { id: string }) {
    return this.mastery.listByUser(user.id);
  }

  @Get('user/:userId')
  @UseGuards(OwnershipGuard)
  listForUser(@Param('userId') userId: string) {
    return this.mastery.listByUser(userId);
  }
}
```

Create `services/api/src/v1/personalization/mastery/mastery.module.ts`. Add to `v1.module.ts` imports.

- [ ] **Step 7: Write the failing integration test for the quiz-attempt hook**

Create `services/api/src/v1/personalization/mastery/__tests__/mastery-update-on-attempt.int.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { QuizAttemptsService } from '@/v1/quiz/quiz-attempts/quiz-attempts.service';
import { MasteryService } from '../mastery.service';

describe('Mastery update on quiz attempt (Phase 2)', () => {
  it('MasteryService.updateFromAttempt is called from quiz submit', async () => {
    const masteryMock = { updateFromAttempt: jest.fn().mockResolvedValue({ score: 0.7 }) };
    const module = await Test.createTestingModule({
      providers: [
        QuizAttemptsService,
        { provide: MasteryService, useValue: masteryMock },
        { provide: 'PrismaService', useValue: {} },
        { provide: 'QuizRepo', useValue: {} },
        { provide: 'AnswersRepo', useValue: {} },
        { provide: 'QuizAttemptsRepo', useValue: {} },
      ],
    }).compile();
    const quizSvc = module.get(QuizAttemptsService);
    await quizSvc.submitAttempt('u1', 'q1', { 'q1-1': 'A' }, 't1');
    expect(masteryMock.updateFromAttempt).toHaveBeenCalledWith('u1', 't1', expect.any(Number));
  });
});
```

The actual `submitAttempt` signature depends on the existing service. Read it first and adapt the test call.

- [ ] **Step 8: Wire the hook into quiz-attempts.service**

Modify `services/api/src/v1/quiz/quiz-attempts/quiz-attempts.service.ts`. Inject `MasteryService`. After persisting `QuizAttempt.score` and `Answer` rows, look up the quiz's `topicId` (via `prisma.quiz.findUnique({ where: { id }, include: { topic: true } })` or via the `Lesson` relation), then call `mastery.updateFromAttempt(userId, topicId, score)`.

If the existing service does not have a clean submit method, add a thin wrapper that the existing controller calls.

- [ ] **Step 9: Re-run the integration test**

Run: `cd services/api && TEST_DATABASE_URL=... pnpm jest src/v1/personalization/mastery/__tests__/mastery-update-on-attempt.int.spec.ts --silent`
Expected: PASS.

- [ ] **Step 10: Run the full suite**

Run: `cd services/api && pnpm jest --silent 2>&1 | tail -3`
Expected: no new failures.

---

## Task 4: Implement `MisconceptionDetector` (deterministic rule-based)

**Files:**
- Create: `services/api/src/v1/personalization/misconception/misconception.service.ts`
- Create: `services/api/src/v1/personalization/misconception/misconception.repo.ts`
- Create: `services/api/src/v1/personalization/misconception/misconception.module.ts`
- Create: `services/api/src/v1/personalization/misconception/__tests__/misconception.service.spec.ts`

The detector classifies misconceptions by pattern code. The pattern codes are deterministic: the wrong-answer's `questionId` + the student's chosen `userAnswer` map to a known misconception via a static table. The LLM explains the misconception; the deterministic engine classifies it (per spec §5.3 Notable Risks mitigation).

- [ ] **Step 1: Read the existing `Answer` model to confirm fields**

Run: `grep -nE "model Answer|userAnswer|isCorrect" services/api/prisma/schema.prisma | head -10`
Expected: `Answer` has `userAnswer`, `isCorrect`, `questionId`, etc.

- [ ] **Step 2: Write the failing unit test**

Create `services/api/src/v1/personalization/misconception/__tests__/misconception.service.spec.ts`:

```typescript
import { MisconceptionService } from '../misconception.service';

describe('MisconceptionService.classify (deterministic)', () => {
  let service: MisconceptionService;

  beforeEach(() => {
    const repo = { upsert: jest.fn().mockResolvedValue({}) };
    service = new MisconceptionService(repo as any);
  });

  it('classifies debit-credit swap when wrong answer is the inverse', () => {
    const code = service.classifyPattern({
      questionId: 'q-journal-debit-credit',
      userAnswer: 'credit',
      correctAnswer: 'debit',
    });
    expect(code).toBe('debit_credit_swap');
  });

  it('classifies trial-balance imbalance when wrong answer omits an entry', () => {
    const code = service.classifyPattern({
      questionId: 'q-trial-balance',
      userAnswer: '',
      correctAnswer: 'debit Cash 100 / credit Service Revenue 100',
    });
    expect(code).toBe('trial_balance_imbalance');
  });

  it('returns null for an unrecognized pattern', () => {
    const code = service.classifyPattern({
      questionId: 'q-unknown',
      userAnswer: 'x',
      correctAnswer: 'y',
    });
    expect(code).toBeNull();
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd services/api && pnpm jest src/v1/personalization/misconception/__tests__/misconception.service.spec.ts --silent`
Expected: FAIL.

- [ ] **Step 4: Implement the service**

Create `services/api/src/v1/personalization/misconception/misconception.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { MisconceptionRepo } from './misconception.repo';

const PATTERNS: Array<{ code: string; match: (input: { questionId: string; userAnswer: string; correctAnswer: string }) => boolean }> = [
  {
    code: 'debit_credit_swap',
    match: ({ questionId, userAnswer, correctAnswer }) => {
      const isJournal = questionId.startsWith('q-journal');
      return isJournal && /debit|credit/i.test(correctAnswer) && userAnswer.trim() === correctAnswer.replace(/debit/i, 'credit').replace(/credit/i, 'debit');
    },
  },
  {
    code: 'trial_balance_imbalance',
    match: ({ questionId, userAnswer }) => questionId.startsWith('q-trial-balance') && (userAnswer.trim() === '' || !/credit/i.test(userAnswer)),
  },
];

@Injectable()
export class MisconceptionService {
  constructor(private readonly repo: MisconceptionRepo) {}

  classifyPattern(input: { questionId: string; userAnswer: string; correctAnswer: string }): string | null {
    for (const p of PATTERNS) {
      if (p.match(input)) return p.code;
    }
    return null;
  }

  async recordFromAnswer(input: { userId: string; topicId: string; questionId: string; userAnswer: string; correctAnswer: string; isCorrect: boolean }): Promise<{ patternCode: string | null }> {
    if (input.isCorrect) return { patternCode: null };
    const code = this.classifyPattern(input);
    if (!code) return { patternCode: null };
    await this.repo.upsert({
      userId: input.userId,
      topicId: input.topicId,
      patternCode: code,
      evidence: { questionId: input.questionId, userAnswer: input.userAnswer },
      confidence: 0.7,
    });
    return { patternCode: code };
  }

  async listActiveByUser(userId: string) {
    return this.repo.listActiveByUser(userId);
  }
}
```

- [ ] **Step 5: Implement the repo**

Create `services/api/src/v1/personalization/misconception/misconception.repo.ts` with `upsert(input)`, `listActiveByUser(userId)` (filters `resolvedAt: null`).

- [ ] **Step 6: Implement the module**

Create `services/api/src/v1/personalization/misconception/misconception.module.ts`. Import and export `MisconceptionService`.

- [ ] **Step 7: Wire into the quiz-attempt hook**

Modify `services/api/src/v1/quiz/quiz-attempts/quiz-attempts.service.ts`. Inject `MisconceptionService`. After the existing mastery hook, for each wrong `Answer`, call `misconception.recordFromAnswer({...})`.

- [ ] **Step 8: Run the test**

Run: `cd services/api && pnpm jest src/v1/personalization/misconception/__tests__/misconception.service.spec.ts --silent`
Expected: PASS, 3 tests.

---

## Task 5: Implement `MemoryService` (short + long term)

**Files:**
- Create: `services/api/src/v1/personalization/memory/memory.service.ts`
- Create: `services/api/src/v1/personalization/memory/memory.repo.ts`
- Create: `services/api/src/v1/personalization/memory/memory.controller.ts`
- Create: `services/api/src/v1/personalization/memory/memory.module.ts`
- Create: `services/api/src/v1/personalization/memory/__tests__/memory-service.int.spec.ts`

Per spec §4.3 AI-3, memory has two slices:
- `SHORT_TERM`: recent conversation turns, capped at last N (default 20), `decayAt` = createdAt + 90 days
- `LONG_TERM_PROFILE`: distilled learner profile, written by a nightly distillation job
- `LONG_TERM_MISCONCEPTION`: persistent misconception summary, written by `MisconceptionService` after N occurrences

- [ ] **Step 1: Write the failing test**

Create `services/api/src/v1/personalization/memory/__tests__/memory-service.int.spec.ts`:

```typescript
import { MemoryService } from '../memory.service';

describe('MemoryService (Phase 2)', () => {
  let service: MemoryService;

  beforeEach(() => {
    const repo = {
      create: jest.fn().mockImplementation(async (input) => ({ id: 'mem1', ...input })),
      listByKind: jest.fn().mockResolvedValue([]),
      trim: jest.fn().mockResolvedValue(undefined),
    };
    service = new MemoryService(repo as any, 90);
  });

  it('records a short-term item with decayAt 90 days out', () => {
    const before = Date.now();
    const out = service.create({ userId: 'u1', lessonId: 'l1', kind: 'SHORT_TERM', payload: { note: 'hi' } });
    expect(out.decayAt).toBeDefined();
    expect(new Date(out.decayAt!).getTime() - before).toBeGreaterThan(89 * 86_400_000);
  });

  it('trims to last 20 short-term items per (user, lesson)', async () => {
    const items = Array.from({ length: 25 }, (_, i) => ({ id: `m${i}`, userId: 'u1', lessonId: 'l1', kind: 'SHORT_TERM', payload: { i } }));
    (service as any).repo.listByKind.mockResolvedValue(items);
    await service.record({ userId: 'u1', lessonId: 'l1', kind: 'SHORT_TERM', payload: { newest: true } });
    expect((service as any).repo.trim).toHaveBeenCalledWith('u1', 'l1', 'SHORT_TERM', 5);
  });

  it('lists lesson-scoped memory with no cross-lesson leakage by default', async () => {
    (service as any).repo.listByKind.mockResolvedValue([
      { id: 'm1', userId: 'u1', lessonId: 'l1', kind: 'SHORT_TERM' },
      { id: 'm2', userId: 'u1', lessonId: 'l2', kind: 'SHORT_TERM' },
    ]);
    const out = await service.listForLesson({ userId: 'u1', lessonId: 'l1', kind: 'SHORT_TERM' });
    expect(out.every((m: any) => m.lessonId === 'l1')).toBe(true);
  });

  it('allows cross-lesson only when allowCrossLesson is true', async () => {
    (service as any).repo.listByKind.mockResolvedValue([
      { id: 'm1', userId: 'u1', lessonId: 'l1', kind: 'SHORT_TERM' },
      { id: 'm2', userId: 'u1', lessonId: 'l2', kind: 'SHORT_TERM' },
    ]);
    const out = await service.listForLesson({ userId: 'u1', lessonId: 'l1', kind: 'SHORT_TERM', allowCrossLesson: true });
    expect(out.length).toBe(2);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd services/api && pnpm jest src/v1/personalization/memory/__tests__/memory-service.int.spec.ts --silent`
Expected: FAIL.

- [ ] **Step 3: Implement the service**

Create `services/api/src/v1/personalization/memory/memory.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { MemoryRepo } from './memory.repo';

const SHORT_TERM_CAP = 20;
const SHORT_TERM_TTL_DAYS = 90;

@Injectable()
export class MemoryService {
  constructor(private readonly repo: MemoryRepo, private readonly ttlDays: number = SHORT_TERM_TTL_DAYS) {}

  create(input: { userId: string; lessonId?: string; kind: 'SHORT_TERM' | 'LONG_TERM_PROFILE' | 'LONG_TERM_MISCONCEPTION'; payload: unknown }) {
    const decayAt = input.kind === 'SHORT_TERM' ? new Date(Date.now() + this.ttlDays * 86_400_000) : null;
    return this.repo.create({ ...input, decayAt });
  }

  async record(input: { userId: string; lessonId?: string; kind: 'SHORT_TERM' | 'LONG_TERM_PROFILE' | 'LONG_TERM_MISCONCEPTION'; payload: unknown }) {
    const created = await this.create(input);
    if (input.kind === 'SHORT_TERM' && input.lessonId) {
      const all = await this.repo.listByKind(input.userId, input.kind);
      const sameLesson = all.filter((m) => m.lessonId === input.lessonId);
      const excess = sameLesson.length - SHORT_TERM_CAP;
      if (excess > 0) {
        await this.repo.trim(input.userId, input.lessonId, input.kind, excess);
      }
    }
    return created;
  }

  async listForLesson(input: { userId: string; lessonId: string; kind: 'SHORT_TERM' | 'LONG_TERM_PROFILE' | 'LONG_TERM_MISCONCEPTION'; allowCrossLesson?: boolean }) {
    const items = await this.repo.listByKind(input.userId, input.kind);
    if (input.allowCrossLesson) return items;
    return items.filter((m) => m.lessonId === input.lessonId);
  }

  async listLongTermProfile(userId: string) {
    return this.repo.listByKind(userId, 'LONG_TERM_PROFILE');
  }

  async distillProfile(userId: string) {
    const all = await this.repo.listByKind(userId, 'SHORT_TERM');
    const summary = { count: all.length, lastActiveAt: all[0]?.createdAt ?? null, themes: this.extractThemes(all) };
    await this.repo.upsertLongTerm({ userId, payload: summary, kind: 'LONG_TERM_PROFILE' });
    return summary;
  }

  private extractThemes(items: unknown[]): string[] {
    const set = new Set<string>();
    for (const item of items) {
      const payload = (item as any).payload ?? {};
      const theme = payload.theme ?? payload.topicId;
      if (typeof theme === 'string') set.add(theme);
    }
    return [...set];
  }
}
```

- [ ] **Step 4: Implement the repo**

Create `services/api/src/v1/personalization/memory/memory.repo.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/common/config/prisma/prisma.service';

@Injectable()
export class MemoryRepo {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: any) {
    return this.prisma.memoryRecord.create({ data: input });
  }

  async listByKind(userId: string, kind: 'SHORT_TERM' | 'LONG_TERM_PROFILE' | 'LONG_TERM_MISCONCEPTION') {
    return this.prisma.memoryRecord.findMany({
      where: { userId, kind, OR: [{ decayAt: null }, { decayAt: { gt: new Date() } }] },
      orderBy: { createdAt: 'desc' },
    });
  }

  async trim(userId: string, lessonId: string, kind: string, count: number) {
    const oldest = await this.prisma.memoryRecord.findMany({
      where: { userId, lessonId, kind },
      orderBy: { createdAt: 'asc' },
      take: count,
    });
    await this.prisma.memoryRecord.deleteMany({ where: { id: { in: oldest.map((m) => m.id) } } });
  }

  async upsertLongTerm(input: { userId: string; kind: 'LONG_TERM_PROFILE' | 'LONG_TERM_MISCONCEPTION'; payload: unknown }) {
    return this.prisma.memoryRecord.upsert({
      where: { id: `${input.userId}-${input.kind}` },
      update: { payload: input.payload as any, createdAt: new Date() },
      create: { id: `${input.userId}-${input.kind}`, userId: input.userId, kind: input.kind, payload: input.payload as any },
    });
  }
}
```

The `where: { id: '...' }` upsert is a simplification; in practice use a unique index. The repo layer is the place to refine that. The intent: one long-term profile row per user.

- [ ] **Step 5: Implement the controller + module**

Create `services/api/src/v1/personalization/memory/memory.controller.ts`:

```typescript
import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/v1/common/guards/jwt-auth.guard';
import { MemoryService } from './memory.service';
import { CurrentUser } from '@/v1/common/decorators/current-user.decorator';

@Controller('v1/personalization/memory')
@UseGuards(JwtAuthGuard)
export class MemoryController {
  constructor(private readonly memory: MemoryService) {}

  @Get()
  list(@CurrentUser() user: { id: string }, @Query('lessonId') lessonId?: string) {
    if (lessonId) {
      return this.memory.listForLesson({ userId: user.id, lessonId, kind: 'SHORT_TERM' });
    }
    return this.memory.listLongTermProfile(user.id);
  }

  @Post()
  record(@CurrentUser() user: { id: string }, @Body() body: { lessonId?: string; kind: any; payload: unknown }) {
    return this.memory.record({ userId: user.id, ...body });
  }

  @Post('distill')
  distill(@CurrentUser() user: { id: string }) {
    return this.memory.distillProfile(user.id);
  }
}
```

- [ ] **Step 6: Re-run the test**

Run: `cd services/api && pnpm jest src/v1/personalization/memory/__tests__/memory-service.int.spec.ts --silent`
Expected: PASS, 4 tests.

- [ ] **Step 7: Wire the chat pipeline to record short-term memory**

Modify `services/ai-api/v1/learning/service.py` (the existing chat pipeline). After generating a tutor response, call `api /v1/personalization/memory` with the conversation turn. Forward the user's bearer token (per spec I1).

Use `requests.post(f"{NEST_API}/v1/personalization/memory", json={...}, headers={"Authorization": f"Bearer {token}"})`.

- [ ] **Step 8: Run the full suite**

Run: `cd services/api && pnpm jest --silent && cd ../ai-api && uv run pytest -q`
Expected: no new failures.

---

## Task 6: Implement `AdaptivePolicyService` (deterministic next activity)

**Files:**
- Create: `services/api/src/v1/personalization/policy/adaptive-policy.service.ts`
- Create: `services/api/src/v1/personalization/policy/adaptive-policy.repo.ts`
- Create: `services/api/src/v1/personalization/policy/adaptive-policy.controller.ts`
- Create: `services/api/src/v1/personalization/policy/adaptive-policy.module.ts`
- Create: `services/api/src/v1/personalization/policy/__tests__/adaptive-policy.service.spec.ts`

The policy picks the next activity deterministically based on mastery and active misconceptions. If mastery on the current topic is below 0.7, recommend a remediation lesson on the active misconception. Otherwise recommend the next to the current topic. If the user has completed all current topics, recommend a topic in the next level whose prerequisites are met.

- [ ] **Step 1: Write the failing test**

Create `services/api/src/v1/personalization/policy/__tests__/adaptive-policy.service.spec.ts`:

```typescript
import { AdaptivePolicyService } from '../adaptive-policy.service';

describe('AdaptivePolicyService.decideNext (deterministic)', () => {
  let service: AdaptivePolicyService;

  beforeEach(() => {
    const masteryRepo = { listByUser: jest.fn().mockResolvedValue([]) };
    const misconceptionRepo = { listActiveByUser: jest.fn().mockResolvedValue([]) };
    const policyRepo = { upsert: jest.fn().mockResolvedValue({ id: 'p1' }) };
    const goldenGraph = {
      levels: [
        { id: 1, title: 'L1', topics: [
          { id: 'l1-t01', title: 'Eq', prerequisites: [] },
          { id: 'l1-t02', title: 'Journals', prerequisites: ['l1-t01'] },
        ] },
        { id: 2, title: 'L2', topics: [
          { id: 'l2-t01', title: 'Adjusting', prerequisites: ['l1-t02'] },
        ] },
      ],
    };
    service = new AdaptivePolicyService(masteryRepo as any, misconceptionRepo as any, policyRepo as any, goldenGraph);
  });

  it('recommends starting topic l1-t01 when user has no mastery', async () => {
    const decision = await service.decideNext('u1');
    expect(decision).toMatchObject({ topicId: 'l1-t01', level: 1, rationaleKind: 'no_exploration' });
  });

  it('recommends remediation on misconception when mastery below threshold', async () => {
    (service as any).masteryRepo.listByUser.mockResolvedValue([
      { topicId: 'l1-t02', score: 0.5 },
    ]);
    (service as any).misconceptionRepo.listActiveByUser.mockResolvedValue([
      { topicId: 'l1-t02', patternCode: 'debit_credit_swap', confidence: 0.7 },
    ]);
    const decision = await service.decideNext('u1');
    expect(decision.topicId).toBe('l1-t02');
    expect(decision.rationaleKind).toBe('remediation');
  });

  it('recommends next topic when mastery above threshold and no misconception', async () => {
    (service as any).masteryRepo.listByUser.mockResolvedValue([
      { topicId: 'l1-t01', score: 0.9 },
    ]);
    const decision = await service.decideNext('u1');
    expect(decision.topicId).toBe('l1-t02');
    expect(decision.rationaleKind).toBe('progression');
  });

  it('does not recommend a topic whose prerequisites are unmet', async () => {
    (service as any).masteryRepo.listByUser.mockResolvedValue([
      { topicId: 'l1-t01', score: 0.9 },
      { topicId: 'l1-t02', score: 0.9 },
    ]);
    const decision = await service.decideNext('u1');
    expect(decision.topicId).toBe('l2-t01');
    expect(decision.rationaleKind).toBe('progression');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd services/api && pnpm jest src/v1/personalization/policy/__tests__/adaptive-policy.service.spec.ts --silent`
Expected: FAIL.

- [ ] **Step 3: Implement the service**

Create `services/api/src/v1/personalization/policy/adaptive-policy.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { MasteryRepo } from '../mastery/mastery.repo';
import { MisconceptionRepo } from '../misconception/misconception.repo';
import { AdaptivePolicyRepo } from './adaptive-policy.repo';

const MASTERY_THRESHOLD = 0.7;
const REMEDIATION_THRESHOLD = 0.5;

@Injectable()
export class AdaptivePolicyService {
  constructor(
    private readonly masteryRepo: MasteryRepo,
    private readonly misconceptionRepo: MisconceptionRepo,
    private readonly policyRepo: AdaptivePolicyRepo,
    private readonly goldenGraph: { levels: Array<{ id: number; title: string; topics: Array<{ id: string; title: string; prerequisites: string[] }> }> },
  ) {}

  async decideNext(userId: string): Promise<{ topicId: string; level: number; rationaleKind: 'no_exploration' | 'remediation' | 'progression' }> {
    const mastery = await this.masteryRepo.listByUser(userId);
    const misconceptions = await this.misconceptionRepo.listActiveByUser(userId);
    const masteryMap = new Map(mastery.map((m) => [m.topicId, m.score]));

    if (mastery.length === 0) {
      const first = this.goldenGraph.levels[0].topics[0];
      return { topicId: first.id, level: 1, rationaleKind: 'no_exploration' };
    }

    const active = misconceptions.find((mc) => (masteryMap.get(mc.topicId) ?? 0) < REMEDIATION_THRESHOLD);
    if (active) {
      return { topicId: active.topicId, level: this.levelOf(active.topicId), rationaleKind: 'remediation' };
    }

    for (const level of this.goldenGraph.levels) {
      for (const topic of level.topics) {
        const met = topic.prerequisites.every((p) => (masteryMap.get(p) ?? 0) >= MASTERY_THRESHOLD);
        const passed = (masteryMap.get(topic.id) ?? 0) >= MASTERY_THRESHOLD;
        if (met && !passed) {
          return { topicId: topic.id, level: level.id, rationaleKind: 'progression' };
        }
      }
    }

    return { topicId: this.goldenGraph.levels[0].topics[0].id, level: 1, rationaleKind: 'no_exploration' };
  }

  async recordDecision(userId: string, decision: { topicId: string; level: number; rationaleKind: string }) {
    return this.policyRepo.upsert({
      userId,
      topicId: decision.topicId,
      rationale: { level: decision.level, rationaleKind: decision.rationaleKind },
    });
  }

  private levelOf(topicId: string): number {
    for (const level of this.goldenGraph.levels) {
      if (level.topics.some((t) => t.id === topicId)) return level.id;
    }
    return 1;
  }
}
```

- [ ] **Step 4: Implement the repo, controller, module**

Create `services/api/src/v1/personalization/policy/adaptive-policy.repo.ts` with `upsert(input)`. Create `adaptive-policy.controller.ts`:

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/v1/common/guards/jwt-auth.guard';
import { CurrentUser } from '@/v1/common/decorators/current-user.decorator';
import { AdaptivePolicyService } from './adaptive-policy.service';

@Controller('v1/personalization/policy')
@UseGuards(JwtAuthGuard)
export class AdaptivePolicyController {
  constructor(private readonly policy: AdaptivePolicyService) {}

  @Get('next')
  async next(@CurrentUser() user: { id: string }) {
    const decision = await this.policy.decideNext(user.id);
    await this.policy.recordDecision(user.id, decision);
    return decision;
  }
}
```

- [ ] **Step 5: Run the test**

Run: `cd services/api && pnpm jest src/v1/personalization/policy/__tests__/adaptive-policy.service.spec.ts --silent`
Expected: PASS, 4 tests.

---

## Task 7: Add `CurriculumAgent` in `ai-api`

**Files:**
- Create: `services/ai-api/v1/agents/curriculum_agent.py`
- Create: `services/ai-api/v1/agents/__init__.py`
- Create: `services/ai-api/v1/agents/__tests__/test_curriculum_agent.py`

The `CurriculumAgent` is the LLM-side counterpart that:
1. Receives a user's tutor query and current `lessonId`
2. Calls `api /v1/personalization/policy/next` to get the next-activity recommendation
3. Calls `api /v1/personalization/memory?lessonId=...` to retrieve lesson-scoped memory
4. Streams a LangGraph response that explains the misconception or progression
5. Persists the conversation turn to short-term memory via `api /v1/personalization/memory`

Per spec AI-2, the agent router is deterministic; the CurriculumAgent is one of several agents. Per spec AI-4, all tool calls go through `api` over HTTP with the user's bearer token.

- [ ] **Step 1: Write the failing test**

Create `services/ai-api/v1/agents/__tests__/test_curriculum_agent.py`:

```python
import os
from unittest.mock import AsyncMock, MagicMock
import pytest


async def test_curriculum_agent_calls_api_policy_and_memory():
    os.environ["NEST_API"] = "http://api:3002"

    fetch = MagicMock()
    fetch.get = AsyncMock(side_effect=[
        MagicMock(json=lambda: {"topicId": "l1-t02", "level": 1, "rationaleKind": "progression"}, raise_for_status=42),
        MagicMock(json=lambda: [], raise_for_status=42),
    ])
    fetch.post = AsyncMock(return_value=MagicMock(json=lambda: {"id": "mem1"}, raise_for_status=42))

    from v1.agents.curriculum_agent import run_curriculum
    out = await run_curriculum(user_id="u1", lesson_id="l1-t01", query="what next?", token="Bearer t", fetcher=fetch)
    assert out["decision"]["topicId"] == "l1-t02"
    assert fetch.get.await_count == 2
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd services/ai-api && uv run pytest v1/agents/__tests__/test_curriculum_agent.py -v`
Expected: FAIL.

- [ ] **Step 3: Implement the agent**

Create `services/ai-api/v1/agents/__init__.py` (empty) and `services/ai-api/v1/agents/curriculum_agent.py`:

```python
import os
from typing import Any


async def run_curriculum(user_id: str, lesson_id: str, query: str, token: str, fetcher) -> dict[str, Any]:
    api_base = os.environ["NEST_API"]
    headers = {"Authorization": token}

    policy_resp = await fetcher.get(f"{api_base}/v1/personalization/policy/next", headers=headers)
    policy_resp.raise_for_status()
    decision = policy_resp.json()

    memory_resp = await fetcher.get(f"{api_base}/v1/personalization/memory?lessonId={lesson_id}", headers=headers)
    memory_resp.raise_for_status()
    memory = memory_resp.json()

    body = {"lessonId": lesson_id, "kind": "SHORT_TERM", "payload": {"query": query, "decision": decision}}
    persist_resp = await fetcher.post(f"{api_base}/v1/personalization/memory", json=body, headers=headers)
    persist_resp.raise_for_status()

    return {"decision": decision, "memory": memory, "stored": persist_resp.json()}
```

The LangGraph graph for streaming the LLM explanation is added in Task 8 (Phase 7). For Phase 2, the agent scaffolds the deterministic fetch + memory write path.

- [ ] **Step 4: Re-run the test**

Run: `cd services/ai-api && uv run pytest v1/agents/__tests__/test_curriculum_agent.py -v`
Expected: PASS.

---

## Task 8: Add mastery dashboard widgets (SSR-first)

**Files:**
- Create: `apps/web/app/pages/my-learning/mastery/index.vue`
- Create: `apps/web/app/components/my-learning/MasteryProgressBar.vue`
- Create: `apps/web/app/components/my-learning/MisconceptionList.vue`
- Create: `apps/web/app/components/my-learning/NextActivityCard.vue`
- Modify: `apps/web/app/lib/api.ts` (add mastery + misconception + next-activity helpers)

The dashboard shows mastery per topic, active misconceptions, and the next activity. Server-rendered with the user's data on the first byte.

- [ ] **Step 1: Add the API helpers**

Modify `apps/web/app/lib/api.ts`. Add:

```typescript
export const personalizationApi = {
  listMastery: (token?: string) => request<MasteryScore[]>(`${API}/v1/personalization/mastery/me`, { token }),
  listMisconceptions: (token?: string) => request<MisconceptionPattern[]>(`${API}/v1/personalization/misconceptions/active`, { token }),
  nextActivity: (token?: string) => request<{ topicId: string; level: number; rationaleKind: string }>(`${API}/v1/personalization/policy/next`, { token }),
};
```

The misconceptions endpoint is added in Task 4 if not present. If absent, add `GET /v1/personalization/misconceptions/active` to `MisconceptionController`.

- [ ] **Step 2: Implement the dashboard page**

Create `apps/web/app/pages/my-learning/mastery/index.vue`:

```vue
<script setup lang="ts">
const { data: mastery } = await useFetch('/api/v1/personalization/mastery/me', {
  headers: useRequestHeaders(['cookie']),
  server: true,
});
const { data: misconceptions } = await useFetch('/api/v1/personalization/misconceptions/active', {
  headers: useRequestHeaders(['cookie']),
  server: true,
});
const { data: next } = await useFetch('/api/v1/personalization/policy/next', {
  headers: useRequestHeaders(['cookie']),
  server: true,
});

useHead({ title: 'Profil Belajar Saya — ReduCera' });
</script>

<template>
  <main>
    <h1>Profil Belajar</h1>

    <section class="mastery">
      <h2>Penguasaan per Topik</h2>
      <MasteryProgressBar v-for="m in mastery ?? []" :key="m.topicId" :mastery="m" />
      <p v-if="(mastery ?? []).length === 0">Belum ada data penguasaan. Mulai dari latihan.</p>
    </section>

    <section class="misconceptions">
      <h2>Miskonsepsi Aktif</h2>
      <MisconceptionList :items="misconceptions ?? []" />
    </section>

    <section class="next">
      <h2>Aktivitas Berikutnya</h2>
      <NextActivityCard :decision="next" />
    </section>
  </main>
</template>
```

- [ ] **Step 3: Implement the components**

Create `apps/web/app/components/my-learning/MasteryProgressBar.vue`:

```vue
<script setup lang="ts">
defineProps<{ mastery: { topicId: string; score: number; attempts: number } }>();
</script>

<template>
  <div class="mastery-row">
    <span class="topic">{{ mastery.topicId }}</span>
    <progress :value="mastery.score" max="1" />
    <span class="attempts">{{ mastery.attempts }} percobaan</span>
  </div>
</template>
```

Create `apps/web/app/components/my-learning/MisconceptionList.vue`:

```vue
<script setup lang="ts">
defineProps<{ items: Array<{ topicId: string; patternCode: string; confidence: number }> }>();
</script>

<template>
  <ul v-if="items.length > 0">
    <li v-for="item in items" :key="`${item.topicId}-${item.patternCode}`">
      <strong>{{ item.patternCode }}</strong> pada topik {{ item.topicId }}
      ({{ Math.round(item.confidence * 100) }}% confidence)
    </li>
  </ul>
  <p v-else>Tidak ada miskonsepsi aktif.</p>
</template>
```

Create `apps/web/app/components/my-learning/NextActivityCard.vue`:

```vue
<script setup lang="ts">
defineProps<{ decision: { topicId: string; level: number; rationaleKind: string } | null }>();
</script>

<template>
  <div v-if="decision" class="next-card">
    <h3>Topik {{ decision.topicId }}</h3>
    <p>Level {{ decision.level }} · {{ decision.rationaleKind }}</p>
    <NuxtLink :to="`/my-learning/topics/${decision.topicId}`">Mulai aktivitas</NuxtLink>
  </div>
  <p v-else>Tidak ada rekomendasi saat ini.</p>
</template>
```

- [ ] **Step 4: Verify SSR**

Run: `docker compose up -d --build web api ai-api`
Then: `curl -fsS -H "Cookie: <auth>" http://localhost/my-learning/mastery | grep -E "Profil Belajar|Penguasaan per Topik"`
Expected: both phrases present in the first response.

- [ ] **Step 5: Run the Playwright MCP matrix**

Per AGENTS.md Web verification. Screenshots to `.playwright-mcp/phase-2-mastery-{viewport}-{scheme}.png`.

---

## Task 9: Phase 2 acceptance gates

**Files:**
- Modify: `docs/progress-tracker.md` (final Phase 2 block)

- [ ] **Step 1: Run the full backend test suite**

Run:
```
cd services/api && pnpm jest --silent && cd ../ai-api && uv run pytest -q
```
Expected: both exit 0; cumulative test count ≥ 100 (per spec T1 budget).

- [ ] **Step 2: Verify the 4 Phase 2 acceptance gates from §5.3**

Gates:

1. `MasteryScore` table populated from real quiz attempts — submit a quiz in the seed `api`, then `psql ... -c "select count(*) from \"MasteryScore\";"` returns ≥ 1.
2. `MisconceptionDetector` returns known patterns with confidence ≥ 0.6 — `pytest src/v1/personalization/misconception/` via the file picks a known pattern; verify the column.
3. `AdaptivePolicyService` returns "next activity" with deterministic rationale trace — `curl -fsS -H "Authorization: Bearer <token>" http://localhost/api/v1/personalization/policy/next | jq` shows `{ topicId, level, rationaleKind }`.
4. Tutor streaming includes memory recall scoped to current lesson (lesson-scope test from Phase 0 must remain green) — `cd services/ai-api && uv run pytest v1/learning/__tests__/test_tutor_citation.py` PASS.
5. Integration test `test_mastery_updates_on_attempt` green — already in Task 3 Step 9.

- [ ] **Step 3: Run the Playwright MCP matrix**

Per AGENTS.md Web verification. Run the matrix for `/my-learning/mastery` at all three viewports, both color schemes, `reducedMotion: reduce` once.

- [ ] **Step 4: Append the Phase 2 verification table to `docs/progress-tracker.md`**

```
## Phase 2 Verification (YYYY-MM-DD)

| Gate | Status | Evidence |
|---|---|---|
| MasteryScore populated from real attempts | PASS / FAIL | psql output |
| MisconceptionDetector classifies known patterns | PASS / FAIL | pytest output |
| AdaptivePolicyService returns deterministic next | PASS / FAIL | curl output |
| Tutor memory recall lesson-scoped | PASS / FAIL | pytest output |
| Playwright matrix green for /my-learning/mastery | PASS / FAIL | screenshot list |
| Cumulative test count >= 100 | PASS / FAIL | test output |
```

- [ ] **Step 5: Owner review checkpoint**

Per AGENTS.md, executor does not commit. Pause for owner:
1. `git status` and review diff.
2. `pnpm build` for both services; `docker compose -f docker-compose.prod.yml config -q` valid.
3. Stage and commit at their discretion.
4. Mark Phase 2 `DONE` in `docs/progress-tracker.md`.

---

## Out of Scope for Phase 2 (deferred to later phases)

- SkillTree, Achievement, StreakRule, badge issuance: **Phase 3**
- CreatorProfile, studio routes, Reviewer capability: **Phase 4**
- Wallet, Transaction, RevenueShare, Withdrawal, HoldWindow: **Phase 5**
- VirtualCompany simulator UI (multi-period closing): **Phase 6**
- AgentRegistry, AgentTool, DecisionTrace (Phase 2 routing only, **no** trace table yet): **Phase 7**
- EventLog, MasterySnapshot, EngagementMetric, CreatorOutcomeMetric: **Phase 8**
- RateLimit, BackupRecord, expanded AuditLog, full runbook: **Phase 9**