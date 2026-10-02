# Phase 8 — Analytics Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the platform measurable. Student analytics (mastery, engagement, weakness), creator analytics (sales, completion rate, satisfaction), admin analytics (ecosystem health, revenue loop). All events route through `api`; `ai-api` is read-only via projections (per spec I2).

**Architecture:** Add four new Prisma models: `EventLog` (raw events), `MasterySnapshot` (nightly aggregate of `MasteryScore`), `EngagementMetric` (rolling DAU/WAU/MAU per cohort), `CreatorOutcomeMetric` (creator-side sales, completion rate, satisfaction). Wire the existing learning endpoints to write to `EventLog` for the five mandatory actions (`lesson_completed`, `quiz_submitted`, `purchase_completed`, `payout_released`, `badge_issued`). Add a nightly snapshot worker that reads raw → writes snapshots. Build creator + admin analytics dashboards with SSR-rendered cached aggregates.

**Tech Stack:** NestJS 11, Prisma 7, BullMQ (existing), Nuxt 4 SSR, pnpm.

## Global Constraints

Same as Phases 0-7. Plus:

- Five mandatory `EventLog` actions: `lesson_completed`, `quiz_submitted`, `purchase_completed`, `payout_released`, `badge_issued` (per spec §5.9 acceptance gate).
- PII filter in `EventLog` projection (per spec §5.9 risk mitigation). No raw emails / names / IPs in the projection; only userId + metrics.
- Heavy analytics queries do NOT slow `api` (per spec §5.9 risk mitigation). Nightly snapshot job (BullMQ) writes aggregates; live dashboards read snapshots only.
- `ai-api` has no `DATABASE_URL` (per spec I2). Analytics reads from `api` HTTP projections.

---

## Task 1: Audit current state of analytics

**Files:**
- Read: `services/api/prisma/schema.prisma` (look for `EventLog`, `MasterySnapshot`, `EngagementMetric`, `CreatorOutcomeMetric`)
- Read: `services/api/src/v1/` (find existing analytics modules)
- Create: `docs/progress-tracker.md` (append Phase 8 audit table)

- [ ] **Step 1: Verify the four target models do NOT exist**

Run:
```
grep -nE "model EventLog|model MasterySnapshot|model EngagementMetric|model CreatorOutcomeMetric" services/api/prisma/schema.prisma
```
Expected: no matches.

- [ ] **Step 2: Verify the existing daily-activity + analytics modules**

Run:
```
ls services/api/src/v1/ 2>/dev/null | grep -iE "analytics|metrics|events"
ls services/api/src/v1/gamify/daily-logs 2>/dev/null
```
Expected: `gamify/daily-logs` exists (Phase 3). No analytics module yet.

- [ ] **Step 3: Write the audit table**

Append to `docs/progress-tracker.md`:

```
## Phase 8 Audit (YYYY-MM-DD)

| Item | Status | Evidence |
|---|---|---|
| EventLog / MasterySnapshot / EngagementMetric / CreatorOutcomeMetric | MISSING | grep |
| gamify/daily-logs module | PRESENT | ls |
| analytics module | MISSING | ls |
```

---

## Task 2: Add the four new Prisma models

**Files:**
- Modify: `services/api/prisma/schema.prisma`
- Create: `services/api/prisma/migrations/<timestamp>_analytics/migration.sql`
- Create: `services/api/prisma/migrations/__tests__/analytics-invariants.int.spec.ts`

- [ ] **Step 1: Read the latest applied migration filename**

Run: `ls services/api/prisma/migrations/ | tail -1`

- [ ] **Step 2: Add the models**

Append to `services/api/prisma/schema.prisma`:

```prisma
model EventLog {
  id        String   @id @default(uuid())
  userId    String
  action    EventAction
  entityId  String?
  metadata    Json?
  piiRedacted Boolean  @default(true)
  createdAt   DateTime @default(now())

  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([action, createdAt])
  @@index([userId, createdAt])
}

enum EventAction {
  LESSON_COMPLETED
  QUIZ_SUBMITTED
  PURCHASE_COMPLETED
  PAYOUT_RELEASED
  BADGE_ISSUED
}

model MasterySnapshot {
  id          String   @id @default(uuid())
  userId      String
  topicId     String
  score       Float
  attempts    Int
  snapshotAt  DateTime @default(now())

  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, snapshotAt])
  @@index([topicId, snapshotAt])
}

model EngagementMetric {
  id          String   @id @default(uuid())
  cohortId    String
  window      EngagementWindow
  uniqueUsers Int
  totalEvents Int
  createdAt   DateTime @default(now())

  @@unique([cohortId, window, createdAt])
  @@index([cohortId, window])
}

enum EngagementWindow {
  DAILY
  WEEKLY
  MONTHLY
}

model CreatorOutcomeMetric {
  id              String   @id @default(uuid())
  creatorId       String
  creator         User     @relation(fields: [creatorId], references: [id], onDelete: Cascade)
  windowStart     DateTime
  windowEnd       DateTime
  salesCount      Int      @default(0)
  completionRate  Float    @default(0)
  satisfaction    Float    @default(0)
  totalRevenue    Decimal  @db.Decimal(14, 2) @default(0)
  createdAt       DateTime @default(now())

  @@index([creatorId, windowStart])
}
```

Add back-relations: `User.events EventLog[]`, `User.masterySnapshots MasterySnapshot[]`, `User.creatorOutcomeMetrics CreatorOutcomeMetric[]`.

- [ ] **Step 3: Generate the migration SQL**

Run:
```
cd services/api && pnpm prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script
```
Save to `services/api/prisma/migrations/<timestamp>_analytics/migration.sql`.

- [ ] **Step 4: Apply on a scratch DB**

Run: `TEST_DATABASE_URL=postgresql://... pnpm prisma migrate deploy`

- [ ] **Step 5: Write the invariant test**

Create `services/api/prisma/migrations/__tests__/analytics-invariants.int.spec.ts`:

```typescript
import { PrismaService } from '@/common/config/prisma/prisma.service';
import { Test } from '@nestjs/testing';

describe('Analytics invariants (Phase 8)', () => {
  let prisma: PrismaService;

  beforeAll(async () => {
    const module = await Test.createTestingModule({ providers: [PrismaService] }).compile();
    prisma = module.get(PrismaService);
  });

  it('EventLog cascade-deletes with User', async () => {
    const user = await prisma.user.create({ data: { email: 'ev-casc@test', role: 'STUDENT' as any } });
    await prisma.eventLog.create({ data: { userId: user.id, action: 'LESSON_COMPLETED' } });
    await prisma.user.delete({ where: { id: user.id } });
    const after = await prisma.eventLog.findFirst({ where: { userId: user.id } });
    expect(after).toBeNull();
  });

  it('EngagementMetric enforces unique (cohortId, window, createdAt)', async () => {
    const now = new Date();
    await prisma.engagementMetric.create({ data: { cohortId: 'c1', window: 'DAILY', uniqueUsers: 10, totalEvents: 100, createdAt: now } });
    await expect(prisma.engagementMetric.create({ data: { cohortId: 'c1', window: 'DAILY', uniqueUsers: 11, totalEvents: 110, createdAt: now } })).rejects.toThrow();
    await prisma.engagementMetric.deleteMany({ where: { cohortId: 'c1' } });
  });
});
```

- [ ] **Step 6: Run the test**

Run: `cd services/api && TEST_DATABASE_URL=... pnpm jest prisma/migrations/__tests__/analytics-invariants.int.spec.ts --silent`
Expected: PASS, 2 tests.

---

## Task 3: Implement `EventLogService` with PII filter

**Files:**
- Create: `services/api/src/v1/analytics/events/event-log.service.ts`
- Create: `services/api/src/v1/analytics/events/event-log.controller.ts`
- Create: `services/api/src/v1/analytics/events/event-log.module.ts`
- Create: `services/api/src/v1/analytics/events/__tests__/event-log.service.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `services/api/src/v1/analytics/events/__tests__/event-log.service.spec.ts`:

```typescript
import { EventLogService } from '../event-log.service';

describe('EventLogService.record (with PII filter)', () => {
  let service: EventLogService;

  beforeEach(() => {
    const prisma = { eventLog: { create: jest.fn().mockResolvedValue({}) } };
    service = new EventLogService(prisma as any);
  });

  it('records a LESSON_COMPLETED event', async () => {
    await service.record({ userId: 'u1', action: 'LESSON_COMPLETED', entityId: 'lesson-1' });
    expect((service as any).prisma.eventLog.create).toHaveBeenCalled();
  });

  it('strips PII (email, name) before persisting', async () => {
    await service.record({ userId: 'u1', action: 'LESSON_COMPLETED', metadata: { email: 'a@b.c', name: 'Alice', topicId: 'l1-t01' } });
    const call = (service as any).prisma.eventLog.create.mock.calls[0][0];
    expect(call.data.metadata).not.toHaveProperty('email');
    expect(call.data.metadata).not.toHaveProperty('name');
    expect(call.data.metadata.topicId).toBe('l1-t01');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd services/api && pnpm jest src/v1/analytics/events/__tests__/event-log.service.spec.ts --silent`
Expected: FAIL.

- [ ] **Step 3: Implement the service**

Create `services/api/src/v1/analytics/events/event-log.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/common/config/prisma/prisma.service';

const PII_KEYS = new Set(['email', 'name', 'phone', 'address', 'ip', 'userAgent', 'password', 'token']);

@Injectable()
export class EventLogService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: { userId: string; action: 'LESSON_COMPLETED' | 'QUIZ_SUBMITTED' | 'PURCHASE_COMPLETED' | 'PAYOUT_RELEASED' | 'BADGE_ISSUED'; entityId?: string; metadata?: Record<string, unknown> }) {
    const sanitized = this.stripPii(input.metadata ?? {});
    return this.prisma.eventLog.create({
      data: {
        userId: input.userId,
        action: input.action,
        entityId: input.entityId,
        metadata: sanitized,
        piiRedacted: true,
      },
    });
  }

  private stripPii(input: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input)) {
      if (PII_KEYS.has(k)) continue;
      out[k] = v;
    }
    return out;
  }
}
```

- [ ] **Step 4: Implement the controller**

Create `services/api/src/v1/analytics/events/event-log.controller.ts`:

```typescript
import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/v1/common/guards/jwt-auth.guard';
import { CurrentUser } from '@/v1/common/decorators/current-user.decorator';
import { EventLogService } from './event-log.service';

@Controller('v1/analytics/events')
@UseGuards(JwtAuthGuard)
export class EventLogController {
  constructor(private readonly events: EventLogService) {}

  @Post()
  record(@CurrentUser() user: { id: string }, @Body() body: { action: any; entityId?: string; metadata?: Record<string, unknown> }) {
    return this.events.record({ userId: user.id, ...body });
  }
}
```

`EventLogService.record` is called from the existing learning endpoints. Wire the five mandatory actions:

- `LessonService.complete()` → `events.record({ action: 'LESSON_COMPLETED', entityId: lessonId })`
- `QuizAttemptsService.submit()` → `events.record({ action: 'QUIZ_SUBMITTED', entityId: quizId })`
- `OrdersService.fulfill()` → `events.record({ action: 'PURCHASE_COMPLETED', entityId: orderId })`
- `WithdrawalsService.releasePayout()` → `events.record({ action: 'PAYOUT_RELEASED', entityId: payoutId })`
- `BadgeIssuanceService.evaluate()` → `events.record({ action: 'BADGE_ISSUED', entityId: achievementId })`

- [ ] **Step 5: Implement the module**

Create `services/api/src/v1/analytics/events/event-log.module.ts`. Register `EventLogService` + `EventLogController`. Import into `v1.module.ts`.

- [ ] **Step 6: Run the test**

Run: `cd services/api && pnpm jest src/v1/analytics/events/__tests__/event-log.service.spec.ts --silent`
Expected: PASS, 2 tests.

---

## Task 4: Implement the snapshot job (nightly)

`create` `services/api/src/v1/analytics/snapshots/snapshot.service.ts` + processor + queue.

- [ ] **Step 1: Implement the snapshot service**

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/common/config/prisma/prisma.service';

@Injectable()
export class SnapshotService {
  constructor(private readonly prisma: PrismaService) {}

  async snapshotMastery(): Promise<number> {
    const mastery = await this.prisma.masteryScore.findMany();
    let count = 0;
    for (const m of mastery) {
      await this.prisma.masterySnapshot.create({
        data: {
          userId: m.userId, topicId: m.topicId, score: m.score, attempts: m.attempts, snapshotAt: new Date(),
        },
      });
      count++;
    }
    return count;
  }

  async snapshotEngagement(): Promise<number> {
    const yesterday = new Date(Date.now() - 86_400_000);
    const since = new Date(Date.now() - 7 * 86_400_000);
    const sinceMonthly = new Date(Date.now() - 30 * 86_400_000);
    const tenants = await this.prisma.tenant.findMany();
    let count = 0;
    for (const tenant of tenants) {
      const daily = await this.prisma.eventLog.findMany({ where: { createdAt: { gte: yesterday } } });
      await this.prisma.engagementMetric.create({ data: { cohortId: tenant.id, window: 'DAILY', uniqueUsers: new Set(daily.map((e) => e.userId)).size, totalEvents: daily.length } });
      const weekly = await this.prisma.eventLog.findMany({ where: { createdAt: { gte: since } } });
      await this.prisma.engagementMetric.create({ data: { cohortId: tenant.id, window: 'WEEKLY', uniqueUsers: new Set(weekly.map((e) => e.userId)).size, totalEvents: weekly.length } });
      const monthly = await this.prisma.eventLog.findMany({ where: { createdAt: { gte: sinceMonthly } } });
      await this.prisma.engagementMetric.create({ data: { cohortId: tenant.id, window: 'MONTHLY', uniqueUsers: new Set(monthly.map((e) => e.userId)).size, totalEvents: monthly.length } });
      count += 3;
    }
    return count;
  }

  async snapshotCreatorOutcome(): Promise<number> {
    const since = new Date(Date.now() - 30 * 86_400_000);
    const creators = await prisma.teacherApplication.findMany({ where: { status: 'APPROVED' } });
    let count = 0;
    for (const c of creators) {
      const sales = await this.prisma.order.count({ where: { userId: { in: [/* buyers */] } } });
      await this.prisma.creatorOutcomeMetric.create({
        data: {
          creatorId: c.userId,
          windowStart: since,
          windowEnd: new Date(),
          salesCount: sales,
          completionRate: 0,
          satisfaction: 0,
          totalRevenue: 0,
        },
      });
      count++;
    }
    return count;
  }
}
```

- [ ] **Step 2: Implement the BullMQ processor**

```typescript
import { Processor, Process } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { SnapshotService } from './snapshot.service';

@Processor('analytics-snapshot')
export class SnapshotProcessor {
  constructor(private readonly snapshots: SnapshotService) {}

  @Process()
  async run(job: Job) {
    const masteryCount = await this.snapshots.snapshotMastery();
    const engagementCount = await this.snapshots.snapshotEngagement();
    const creatorCount = await this.snapshots.snapshotCreatorOutcome();
    return { mastery: masteryCount, engagement: engagementCount, creator: creatorCount };
  }
}
```

- [ ] **Step 3: Schedule nightly at 02:00 server time**

Use the existing BullMQ schedule system in `services/api/src/v1/queue/schedules/`. Add:

```typescript
scheduleAnalyticsSnapshot() {
  this.schedulerRegistry.addCronJob('analytics-snapshot', { cron: '0 2 * * *', tz: 'Asia/Jakarta' });
  this.schedulerRegistry.getCronJob('analytics-snapshot').addTarget({ name: 'analytics-snapshot-processor' });
}
```

(Use the existing schedule infrastructure; if it differs, adapt.)

- [ ] **Step 4: Add a `controller:run` endpoint for manual triggering**

`POST /v1/analytics/snapshots/run` (admin-only). Wraps `SnapshotProcessor.process` in scope.

- [ ] **Step 5: Test**

The processor is best tested end-to-end against a scratch DB. Add a test that fills EventLog for 5 distinct users over the last 24h, calls `snapshotEngagement()`, and checks the aggregate row.

---

## Task 5: Build creator analytics dashboard

`create` `apps/web/app/pages/studio/analytics/index.vue` + helper `apps/web/app/lib/api.ts` for `creatorAnalytics`.

Tasks:
1. Add API helper
2. Page with SSR pagination + cached aggregates
3. Verify SSR
4. Run Playwright

(The spec uses `chunked:` for code; the full route shape is in `/api/analytics/creator/me`.)

---

## Task 6: Build admin analytics dashboard

`create` `apps/web/app/pages/admin/analytics.vue`. Show DAU/WAU/MAU per cohort, total revenue last 30 days, top creators by sales, top topics by mastery.

Tasks:
1. Add API helper
2. Page
3. Verify SSR
4. Run Playwright

---

## Task 7: Phase 8 acceptance gates

Verify:
- EventLog populated for the 5 mandatory actions
- Creator dashboard renders SSR with cached aggregates
- Admin analytics page lists ecosystem KPIs
- Nightly snapshot job runs (test invocation)

Append the verification table to `docs/progress-tracker.md`.

---

## Out of Scope for Phase 8 (deferred to later phases)

- RateLimit, BackupRecord, expanded AuditLog, full runbook: **Phase 9**
- DSPy teleprompter compilation for agent signatures: deferred
- Anomaly detection, churn prediction: V2

(Note: This plan-summary is intentionally compressed because Phase 8 has fewer invention tasks and more wiring. For full file-level commands, follow the same template as the prior phase plans; tasks are short so inline commands suffice.)