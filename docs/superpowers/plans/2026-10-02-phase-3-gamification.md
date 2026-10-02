# Phase 3 — Gamified Learning Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make ReduCera's gamification layer visible and varied — skill tree that lights up with mastery, named badges issued at deterministic milestones, streak rules already running plus a UI to celebrate them, and a leaderboard that does not shame low-performers. The deterministic engine issues; the LLM only explains (per spec I3 / AI-7).

**Architecture:** Reuse the existing `Achievement` + `UserAchievement` + `StreakHistory` + `DailyActivityLog` + `LeaderboardScore` Prisma models and existing modules. Add a `SkillTree` model only if the golden graph from Phase 1 is insufficient (probably not). The new logic lives in:
- `BadgeIssuanceService` (api) — deterministic rules: `masteryScore(topicId) >= 0.9 → award("trial-balance-hero", topicId)`
- `LevelCalculationService` (api) — XP from activity logs → level integer (threshold table)
- Cohort-scoped leaderboard: enforce `cohortId = current user's cohort` in `LeaderboardsService.list()`
- UI: badge toast, level-up animation, skill tree viewer (extends Phase 1's `/skill-tree` page)

**Tech Stack:** NestJS 11, Prisma 7, Nuxt 4 SSR, Pinia (existing, no new state lib), pnpm.

## Global Constraints

Same as Phase 0-2. Plus:

- Badges, levels, and leaderboard are deterministic (per spec I3 / AI-7). The LLM may congratulate a player; the deterministic engine decides what they earn.
- Skill tree UI ships with mastered/locked topic states in the first HTML byte (per spec I5). No client-side fetch for the tree itself.
- Atmosphere animation is disabled when `prefers-reduced-motion: reduce` (per spec §5.4 risk mitigation).
- Leaderboards are cohort-scoped, never global (per spec §5.4 risk mitigation).

---

## Task 1: Audit current state of gamification

**Files:**
- Read: `services/api/prisma/schema.prisma` (look for Achievement, UserAchievement, StreakHistory, DailyActivityLog, LeaderboardScore, Category)
- Read: `services/api/src/v1/gamify/streaks/streaks.service.ts`
- Read: `services/api/src/v1/gamify/leaderboards/leaderboards.service.ts`
- Read: `apps/web/app/components/` (confirm no `gamification/` folder)
- Create: `docs/progress-tracker.md` (append Phase 3 audit table)

- [ ] **Step 1: Verify existing models**

Run:
```
grep -nE "model Achievement|model UserAchievement|model StreakHistory|model DailyActivityLog|model LeaderboardScore|model Category" services/api/prisma/schema.prisma
```
Expected: all six lines present.

- [ ] **Step 2: Verify streak service can record activity**

Run:
```
grep -n "incrementOrReset\|record" services/api/src/v1/gamify/streaks/streaks.service.ts | head -10
```
Expected: existing method names. Phase 3 reuses them; no rewrite.

- [ ] **Step 3: Verify leaderboard service**

Run:
```
grep -n "list\|cohort" services/api/src/v1/gamify/leaderboards/leaderboards.service.ts | head -10
```
Expected: a `list()` method. Phase 3 confirms whether it accepts a `cohortId` filter today.

- [ ] **Step 4: Verify no SkillTree model exists**

Run:
```
grep -n "model SkillTree\|model SkillNode" services/api/prisma/schema.prisma
```
Expected: no matches. Phase 3 adds `SkillNode` table that links (userId, topicId, state) for "mastered/locked/available" UI badges — separate from the seed golden graph (which describes the *graph shape*, not per-user state).

- [ ] **Step 5: Verify web has no `gamification/` components**

Run:
```
ls apps/web/app/components/gamification 2>/dev/null && echo present || echo missing
```
Expected: `missing`.

- [ ] **Step 6: Write the audit table**

Append to `docs/progress-tracker.md`:

```
## Phase 3 Audit (YYYY-MM-DD)

| Item | Status | Evidence |
|---|---|---|
| Achievement + UserAchievement models | PRESENT / MISSING | grep |
| StreakHistory + DailyActivityLog models | PRESENT / MISSING | grep |
| LeaderboardScore + Category models | PRESENT / MISSING | grep |
| Streak service can record incrementOrReset | PRESENT / MISSING | grep |
| Leaderboard service supports cohort filter | YES / NO / NEEDS WORK | grep |
| SkillTree / SkillNode models | MISSING / PRESENT | grep |
| apps/web/app/components/gamification/ | MISSING / PRESENT | ls |
```

---

## Task 2: Add `SkillNode` per-user state table

**Files:**
- Modify: `services/api/prisma/schema.prisma`
- Create: `services/api/prisma/migrations/<timestamp>_skill_nodes/migration.sql`
- Create: `services/api/prisma/migrations/__tests__/skill-node-invariants.int.spec.ts`

A `SkillNode` row per (userId, topicId) holds the per-user state of a tree node: locked / available / in-progress / mastered. Updated when mastery changes.

- [ ] **Step 1: Read the latest applied migration filename**

Run: `ls services/api/prisma/migrations/ | tail -1`
Expected: a timestamp-named folder.

- [ ] **Step 2: Add the model**

Append to `services/api/prisma/schema.prisma`:

```prisma
model SkillNode {
  id        String   @id @default(cuid())
  userId    String
  topicId   String
  state     SkillNodeState
  progress  Float    @default(0)
  updatedAt DateTime @updatedAt
  createdAt DateTime @default(now())

  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, topicId])
  @@index([userId, state])
}

enum SkillNodeState {
  LOCKED
  AVAILABLE
  IN_PROGRESS
  MASTERED
}
```

Add back-relation to `User`: `skillNodes SkillNode[]`.

- [ ] **Step 3: Generate the migration SQL**

Run:
```
cd services/api && pnpm prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script
```
Save the output to `services/api/prisma/migrations/<timestamp>_skill_nodes/migration.sql` where `<timestamp>` is AFTER the latest applied.

- [ ] **Step 4: Apply on a scratch DB**

Run:
```
TEST_DATABASE_URL=postgresql://... pnpm prisma migrate deploy
```
Expected: applies cleanly.

- [ ] **Step 5: Write the invariant test**

Create `services/api/prisma/migrations/__tests__/skill-node-invariants.int.spec.ts`:

```typescript
import { PrismaService } from '@/common/config/prisma/prisma.service';
import { Test } from '@nestjs/testing';

describe('SkillNode invariants (Phase 3)', () => {
  let prisma: PrismaService;

  beforeAll(async () => {
    const module = await Test.createTestingModule({ providers: [PrismaService] }).compile();
    prisma = module.get(PrismaService);
  });

  it('enforces unique (userId, topicId)', async () => {
    const user = await prisma.user.create({ data: { email: 'sn-uniq@test', role: 'STUDENT' as any } });
    const topic = await prisma.topic.create({ data: { name: 'SN Topic', level: 1 } });
    await prisma.skillNode.create({ data: { userId: user.id, topicId: topic.id, state: 'AVAILABLE' } });
    await expect(prisma.skillNode.create({ data: { userId: user.id, topicId: topic.id, state: 'MASTERED' } })).rejects.toThrow();
    await prisma.user.delete({ where: { id: user.id } });
    await prisma.topic.delete({ where: { id: topic.id } });
  });

  it('cascade deletes SkillNode with User', async () => {
    const user = await prisma.user.create({ data: { email: 'sn-casc@test', role: 'STUDENT' as any } });
    const topic = await prisma.topic.create({ data: { name: 'SN Casc Topic', level: 1 } });
    await prisma.skillNode.create({ data: { userId: user.id, topicId: topic.id, state: 'IN_PROGRESS' } });
    await prisma.user.delete({ where: { id: user.id } });
    const after = await prisma.skillNode.findFirst({ where: { userId: user.id } });
    expect(after).toBeNull();
    await prisma.topic.delete({ where: { id: topic.id } });
  });
});
```

- [ ] **Step 6: Run the test**

Run: `cd services/api && TEST_DATABASE_URL=... pnpm jest prisma/migrations/__tests__/skill-node-invariants.int.spec.ts --silent`
Expected: PASS, 2 tests.

---

## Task 3: Implement deterministic `BadgeIssuanceService`

**Files:**
- Create: `services/api/src/v1/gamify/badges/badge-issuance.service.ts`
- Create: `services/api/src/v1/gamify/badges/badge-issuance.repo.ts`
- Create: `services/api/src/v1/gamify/badges/badge-issuance.module.ts`
- Create: `services/api/src/v1/gamify/badges/__tests__/badge-issuance.service.spec.ts`
- Create: `services/api/src/v1/gamify/badges/__tests__/badge-issuance-on-mastery.int.spec.ts`

A badge is awarded the first time the deterministic rule fires for that user. Re-evaluation is a no-op (idempotent on `(userId, achievementId)`).

The badge catalog is seeded as data. The rules are deterministic.

- [ ] **Step 1: Add seed badges to the catalog**

Modify `services/api/prisma/seed.ts`. Append (or in a new function called by seed):

```typescript
const BADGES = [
  { id: 'badge-first-step', type: 'FIRST_STEP', title: 'First Step', description: 'Selesaikan latihan pertamamu.' },
  { id: 'badge-journal-keeper', type: 'TOPIC_MASTERY', title: 'Journal Keeper', description: 'Kuasai jurnal umum.' },
  { id: 'badge-trial-balance-hero', type: 'TOPIC_MASTERY', title: 'Trial Balance Hero', description: 'Kuasai neraca saldo.' },
  { id: 'badge-streak-7', type: 'STREAK', title: 'Streak 7 Hari', description: 'Latihan 7 hari berturut-turut.' },
];
for (const b of BADGES) {
  await prisma.achievement.upsert({
    where: { id: b.id },
    update: { title: b.title, description: b.description, type: b.type as any },
    create: { id: b.id, title: b.title, description: b.description, type: b.type as any, condition: JSON.stringify(b) },
  });
}
```

The actual `AchievementType` enum values come from the schema. If `FIRST_STEP`, `TOPIC_MASTERY`, `STREAK` are not in the enum, add them (hand-written migration per AGENTS.md).

- [ ] **Step 2: Write the failing test for the deterministic rule**

Create `services/api/src/v1/gamify/badges/__tests__/badge-issuance.service.spec.ts`:

```typescript
import { BadgeIssuanceService } from '../badge-issuance.service';

describe('BadgeIssuanceService.evaluate (deterministic)', () => {
  let service: BadgeIssuanceService;

  beforeEach(() => {
    const repo = { awardIfMissing: jest.fn().mockResolvedValue(null), listMasters: jest.fn().mockResolvedValue([]) };
    service = new BadgeIssuanceService(repo as any);
  });

  it('awards FIRST_STEP after any mastery >= 0', () => {
    const result = service.evaluate({ userId: 'u1', mastery: { 'l1-t01': 0.5 }, streak: 0 });
    expect(result.awarded).toContain('badge-first-step');
  });

  it('awards TOPIC_MASTERY when topic mastery >= 0.9', () => {
    const result = service.evaluate({ userId: 'u1', mastery: { 'l1-t02-journal-keeper': 0.95 }, streak: 0 });
    expect(result.awarded.some((b: string) => b.startsWith('badge-journal'))).toBe(true);
  });

  it('does not award TOPIC_MASTERY below threshold', () => {
    const result = service.evaluate({ userId: 'u1', mastery: { 'l1-t02-journal-keeper': 0.5 }, streak: 0 });
    expect(result.awarded.filter((b: string) => b.startsWith('badge-journal'))).toHaveLength(0);
  });

  it('awards STREAK badge at streak >= 7', () => {
    const result = service.evaluate({ userId: 'u1', mastery: {}, streak: 7 });
    expect(result.awarded).toContain('badge-streak-7');
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd services/api && pnpm jest src/v1/gamify/badges/__tests__/badge-issuance.service.spec.ts --silent`
Expected: FAIL.

- [ ] **Step 4: Implement the service**

Create `services/api/src/v1/gamify/badges/badge-issuance.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { BadgeIssuanceRepo } from './badge-issuance.repo';

const TOPIC_BADGES: Array<{ badgeId: string; topicIdFragment: string }> = [
  { badgeId: 'badge-journal-keeper', topicIdFragment: 'journal' },
  { badgeId: 'badge-trial-balance-hero', topicIdFragment: 'trial-balance' },
];

@Injectable()
export class BadgeIssuanceService {
  constructor(private readonly repo: BadgeIssuanceRepo) {}

  async evaluate(input: { userId: string; mastery: Record<string, number>; streak: number }): Promise<{ awarded: string[] }> {
    const awarded: string[] = [];

    const firstStep = await this.repo.awardIfMissing(input.userId, 'badge-first-step');
    if (Object.values(input.mastery).some((s) => s > 0) && firstStep) awarded.push('badge-first-step');

    for (const t of TOPIC_BADGES) {
      const topicId = Object.keys(input.mastery).find((k) => k.includes(t.topicIdFragment));
      if (!topicId) continue;
      const score = input.mastery[topicId];
      if (score >= 0.9) {
        const got = await this.repo.awardIfMissing(input.userId, t.badgeId);
        if (got) awarded.push(t.badgeId);
      }
    }

    if (input.streak >= 7) {
      const got = await this.repo.awardIfMissing(input.userId, 'badge-streak-7');
      if (got) awarded.push('badge-streak-7');
    }

    return { awarded };
  }
}
```

- [ ] **Step 5: Implement the repo**

Create `services/api/src/v1/gamify/badges/badge-issuance.repo.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/common/config/prisma/prisma.service';

@Injectable()
export class BadgeIssuanceRepo {
  constructor(private readonly prisma: PrismaService) {}

  async awardIfMissing(userId: string, achievementId: string): Promise<boolean> {
    try {
      await this.prisma.userAchievement.create({ data: { userId, achievementId } });
      return true;
    } catch (e: any) {
      if (e?.code === 'P2002') return false;
      throw e;
    }
  }

  async listMasters(userId: string) {
    return this.prisma.userAchievement.findMany({
      where: { userId },
      include: { achievement: true },
    });
  }
}
```

- [ ] **Step 6: Implement the module**

Create `services/api/src/v1/gamify/badges/badge-issuance.module.ts`. Register `BadgeIssuanceService` and `BadgeIssuanceRepo`. Import into `gamify.module.ts`.

- [ ] **Step 7: Run the test**

Run: `cd services/api && pnpm jest src/v1/gamify/badges/__tests__/badge-issuance.service.spec.ts --silent`
Expected: PASS, 4 tests.

- [ ] **Step 8: Wire BadgeIssuanceService into the quiz-attempt hook**

Modify `services/api/src/v1/quiz/quiz-attempts/quiz-attempts.service.ts`. After the mastery update (Phase 2 Task 8), call:

```typescript
const allMastery = await this.mastery.listByUser(userId);
const masteryMap: Record<string, number> = {};
for (const m of allMastery) masteryMap[m.topicId] = m.score;

const streakToday = await this.streaks.currentStreak(userId);
const { awarded } = await this.badges.evaluate({ userId, mastery: masteryMap, streak: streakToday });
if (awarded.length > 0) {
  return { ...persistedAttempt, awardedBadges: awarded };
}
return persistedAttempt;
```

Inject `BadgeIssuanceService` and `StreaksService` into the quiz-attempts service. `currentStreak` is a small helper added in Task 4 if not present.

- [ ] **Step 9: Write the integration test**

Create `services/api/src/v1/gamify/badges/__tests__/badge-issuance-on-mastery.int.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { QuizAttemptsController } from '@/v1/quiz/quiz-attempts/quiz-attempts.controller';

describe('Badge issuance on mastery (Phase 3)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [QuizAttemptsController],
      providers: [
        { provide: 'PrismaService', useValue: {} },
        { provide: 'MasteryService', useValue: { listByUser: async () => [{ topicId: 'l1-t01', score: 0.95 }] } },
        { provide: 'BadgeIssuanceService', useValue: { evaluate: async () => ({ awarded: ['badge-trial-balance-hero'] }) } },
        { provide: 'StreaksService', useValue: { currentStreak: async () => 0 } },
      ],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });

  it('quiz submission returns awardedBadges in response', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/quiz/quiz-attempts')
      .send({ quizId: 'q1', answers: { 'q1-1': 'A' } });
    expect(res.body).toMatchObject({ awardedBadges: ['badge-trial-balance-hero'] });
  });

  afterAll(async () => { await app.close(); });
});
```

- [ ] **Step 10: Run the integration test**

Run: `cd services/api && TEST_DATABASE_URL=... pnpm jest src/v1/gamify/badges/__tests__/badge-issuance-on-mastery.int.spec.ts --silent`
Expected: PASS.

---

## Task 4: Implement `LevelCalculationService`

**Files:**
- Create: `services/api/src/v1/gamify/level/level-calculation.service.ts`
- Create: `services/api/src/v1/gamify/level/level-calculation.module.ts`
- Create: `services/api/src/v1/gamify/level/__tests__/level-calculation.service.spec.ts`

XP comes from `DailyActivityLog` activity types summed. Levels are deterministic integer thresholds.

- [ ] **Step 1: Write the failing test**

Create `services/api/src/v1/gamify/level/__tests__/level-calculation.service.spec.ts`:

```typescript
import { LevelService } from '../level-calculation.service';

describe('LevelService.computeLevel (deterministic)', () => {
  let service: LevelService;

  beforeEach(() => {
    const activityRepo = { sumXpForUser: jest.fn().mockResolvedValue(0) };
    service = new LevelService(activityRepo as any);
  });

  it('returns level 1 when xp = 0', () => {
    expect(service.computeLevel(0)).toBe(1);
  });

  it('returns level 2 at xp >= 100', () => {
    expect(service.computeLevel(100)).toBe(2);
    expect(service.computeLevel(149)).toBe(2);
  });

  it('returns level 3 at xp >= 150', () => {
    expect(service.computeLevel(150)).toBe(3);
  });

  it('returns level 10 at xp >= 4500', () => {
    expect(service.computeLevel(4500)).toBe(10);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd services/api && pnpm jest src/v1/gamify/level/__tests__/level-calculation.service.spec.ts --silent`
Expected: FAIL.

- [ ] **Step 3: Implement the service**

Create `services/api/src/v1/gamify/level/level-calculation.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';

const LEVEL_THRESHOLDS: Array<{ level: number; xp: number }> = [
  { level: 1, xp: 0 },
  { level: 2, xp: 100 },
  { level: 3, xp: 150 },
  { level: 4, xp: 250 },
  { level: 5, xp: 400 },
  { level: 6, xp: 600 },
  { level: 7, xp: 900 },
  { level: 8, xp: 1300 },
  { level: 9, xp: 1800 },
  { level: 10, xp: 2500 },
  { level: 11, xp: 3500 },
  { level: 12, xp: 4500 },
];

@Injectable()
export class LevelService {
  computeLevel(xp: number): number {
    let level = 1;
    for (const t of LEVEL_THRESHOLDS) {
      if (xp >= t.xp) level = t.level;
    }
    return level;
  }

  async levelForUser(userId: string): Promise<{ level: number; xp: number }> {
    const xp = await this.activityRepo.sumXpForUser(userId);
    return { level: this.computeLevel(xp), xp };
  }
}
```

- [ ] **Step 4: Implement `activityRepo.sumXpForUser`**

In `services/api/src/v1/gamify/daily-logs/daily-logs.repo.ts`, add:

```typescript
async sumXpForUser(userId: string): Promise<number> {
  const result = await this.prisma.dailyActivityLog.aggregate({
    where: { userId },
    _sum: { /* no xp column */ },
  });
  return 0;
}
```

This is a placeholder. Phase 3 ships the level service with a static test, and the actual XP table is added in a separate Phase 8 EventLog task. For Phase 3 the level returns the test value.

If an `xp` column exists on `DailyActivityLog`, sum it. Otherwise, sum up `metadata.xp` JSON values.

- [ ] **Step 5: Implement the module**

Create `services/api/src/v1/gamify/level/level-calculation.module.ts`. Register `LevelService`. Import into `gamify.module.ts`.

- [ ] **Step 6: Run the test**

Run: `cd services/api && pnpm jest src/v1/gamify/level/__tests__/level-calculation.service.spec.ts --silent`
Expected: PASS, 4 tests.

---

## Task 5: Cohort-scoped leaderboard

**Files:**
- Modify: `services/api/src/v1/gamify/leaderboards/leaderboards.service.ts`
- Modify: `services/api/src/v1/gamify/leaderboards/leaderboards.controller.ts`
- Create: `services/api/src/v1/gamify/leaderboards/__tests__/leaderboard-cohort-scoped.int.spec.ts`

The existing leaderboard service may already support a category filter; this task adds a hard cohort constraint so no global ranking exists.

- [ ] **Step 1: Read the existing service**

Run: `cat services/api/src/v1/gamify/leaderboards/leaderboards.service.ts`
Expected: a `list()` method. If it accepts a `categoryId` parameter, the cohort scope can layer on top.

- [ ] **Step 2: Write the failing test**

Create `services/api/src/v1/gamify/leaderboards/__tests__/leaderboard-cohort-scoped.int.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { LeaderboardsController } from '../leaderboards.controller';

describe('Leaderboard cohort scoping (Phase 3)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [LeaderboardsController],
      providers: [
        { provide: 'LeaderboardsService', useValue: {
          list: jest.fn().mockImplementation(async (filter) => {
            if (filter.cohortId === 'A') return [{ userId: 'u1', score: 100 }];
            if (filter.cohortId === 'B') return [{ userId: 'u2', score: 200 }];
            return [];
          }),
        } },
      ],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });

  it('returns cohort A scores for cohort=A', async () => {
    const res = await request(app.getHttpServer()).get('/v1/gamify/leaderboards?cohortId=A');
    expect(res.body).toEqual([{ userId: 'u1', score: 100 }]);
  });

  it('rejects request without cohortId with 400', async () => {
    const res = await request(app.getHttpServer()).get('/v1/gamify/leaderboards');
    expect(res.status).toBe(400);
  });

  afterAll(async () => { await app.close(); });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd services/api && pnpm jest src/v1/gamify/leaderboards/__tests__/leaderboard-cohort-scoped.int.spec.ts --silent`
Expected: FAIL — either no `cohortId` param or no rejection.

- [ ] **Step 4: Modify the controller**

Modify `services/api/src/v1/gamify/leaderboards/leaderboards.controller.ts`. Find the `list` handler. Add `cohortId` requirement:

```typescript
@Get()
list(@Query('cohortId') cohortId: string) {
  if (!cohortId) throw new BadRequestException('cohortId is required');
  return this.service.list({ cohortId });
}
```

- [ ] **Step 5: Modify the service**

Modify `services/api/src/v1/gamify/leaderboards/leaderboards.service.ts`. The `list()` method now accepts `{ cohortId }`. If the existing query already filters by category, add a `WHERE cohortId = ?` clause.

If a `cohortId` column does not exist on `LeaderboardScore`, add it (hand-written migration per AGENTS.md):

```prisma
model LeaderboardScore {
  // existing fields
  cohortId String?
  cohort   Category? @relation(fields: [cohortId], references: [id], onDelete: SetNull)

  @@index([cohortId, score])
}
```

The migration adds the column nullable, then a backfill (out of Phase 3 scope: covered by Phase 8 EventLog backfill).

For Phase 3, ship the API contract (`cohortId` required). The backfill is Phase 8.

- [ ] **Step 6: Re-run the test**

Run: `cd services/api && pnpm jest src/v1/gamify/leaderboards/__tests__/leaderboard-cohort-scoped.int.spec.ts --silent`
Expected: PASS.

---

## Task 6: Wire `MasteryService` updates to `SkillNode`

**Files:**
- Modify: `services/api/src/v1/personalization/mastery/mastery.service.ts` (Task 3 from Phase 2)
- Create: `services/api/src/v1/personalization/skill-node/skill-node.service.ts`
- Create: `services/api/src/v1/personalization/skill-node/skill-node.repo.ts`
- Create: `services/api/src/v1/personalization/skill-node/skill-node.module.ts`
- Create: `services/api/src/v1/personalization/skill-node/__tests__/skill-node-update-on-mastery.int.spec.ts`

The skill tree's per-user state (`SkillNode.state`) updates whenever `MasteryScore` changes. State rules:

- `LOCKED`: at least one prerequisite has mastery < threshold
- `AVAILABLE`: all prerequisites met, no progress yet
- `IN_PROGRESS`: mastery between 0 and threshold
- `MASTERED`: mastery >= 0.9

- [ ] **Step 1: Write the failing test**

Create `services/api/src/v1/personalization/skill-node/__tests__/skill-node-update-on-mastery.int.spec.ts`:

```typescript
import { SkillNodeService } from '../skill-node.service';

describe('SkillNodeService.computeState (deterministic)', () => {
  let service: SkillNodeService;

  beforeEach(() => {
    const repo = { upsert: jest.fn().mockResolvedValue({}) };
    service = new SkillNodeService(repo as any);
  });

  it('returns LOCKED when any prerequisite mastery below threshold', () => {
    expect(service.computeState({ mastery: 0, prereqMastery: [0.5, 0.9] })).toBe('LOCKED');
  });

  it('returns AVAILABLE when prereqs met and mastery 0', () => {
    expect(service.computeState({ mastery: 0, prereqMastery: [0.9, 0.8] })).toBe('AVAILABLE');
  });

  it('returns IN_PROGRESS when mastery in (0, 0.9)', () => {
    expect(service.computeState({ mastery: 0.5, prereqMastery: [0.9] })).toBe('IN_PROGRESS');
  });

  it('returns MASTERED at mastery >= 0.9', () => {
    expect(service.computeState({ mastery: 0.95, prereqMastery: [0.9] })).toBe('MASTERED');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd services/api && pnpm jest src/v1/personalization/skill-node/__tests__/skill-node-update-on-mastery.int.spec.ts --silent`
Expected: FAIL.

- [ ] **Step 3: Implement the service**

Create `services/api/src/v1/personalization/skill-node/skill-node.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { SkillNodeRepo } from './skill-node.repo';

const PREREQ_THRESHOLD = 0.7;
const MASTERY_THRESHOLD = 0.9;

@Injectable()
export class SkillNodeService {
  constructor(private readonly repo: SkillNodeRepo) {}

  computeState(input: { mastery: number; prereqMastery: number[] }): 'LOCKED' | 'AVAILABLE' | 'IN_PROGRESS' | 'MASTERED' {
    const allPrereqsMet = input.prereqMastery.every((m) => m >= PREREQ_THRESHOLD);
    if (!allPrereqsMet) return 'LOCKED';
    if (input.mastery === 0) return 'AVAILABLE';
    if (input.mastery < MASTERY_THRESHOLD) return 'IN_PROGRESS';
    return 'MASTERED';
  }

  async upsertForUserTopic(userId: string, topicId: string, mastery: number, prereqMastery: number[]) {
    const state = this.computeState({ mastery, prereqMastery });
    return this.repo.upsert({ userId, topicId, state, progress: mastery });
  }
}
```

- [ ] **Step 4: Implement the repo**

Create `services/api/src/v1/personalization/skill-node/skill-node.repo.ts` with `upsert(input)`.

- [ ] **Step 5: Wire from `MasteryService.updateFromAttempt`**

Modify `services/api/src/v1/personalization/mastery/mastery.service.ts`. After the mastery upsert, call `SkillNodeService.upsertForUserTopic(...)`. Inject `SkillNodeService`.

Need prerequisite mastery: for each prerequisite of `topicId`, fetch its `MasteryScore` for the user. The golden graph is loaded by `AdaptivePolicyService` from Phase 2. Either re-load it here, or extract it into a `GoldenGraphProvider`.

Simplest path: have `AdaptivePolicyService` expose `prereqMasteryOf(userId, topicId)`. Phase 3 adds that method if not present.

- [ ] **Step 6: Run the test**

Run: `cd services/api && pnpm jest src/v1/personalization/skill-node/__tests__/skill-node-update-on-mastery.int.spec.ts --silent`
Expected: PASS, 4 tests.

---

## Task 7: UI components for badges, levels, and skill tree

**Files:**
- Create: `apps/web/app/components/gamification/BadgeToast.vue`
- Create: `apps/web/app/components/gamification/BadgeGrid.vue`
- Create: `apps/web/app/components/gamification/LevelBadge.vue`
- Create: `apps/web/app/components/gamification/SkillTreeLeaf.vue`
- Create: `apps/web/app/components/gamification/SkillTreeBranch.vue`
- Modify: `apps/web/app/pages/skill-tree/index.vue` (Phase 1 page, extend with state)
- Modify: `apps/web/app/pages/my-learning/badges/index.vue` (new page, lists badges + level)
- Create: `apps/web/app/lib/level-up.composable.ts`

- [ ] **Step 1: Add the API helpers**

Modify `apps/web/app/lib/api.ts`. Add:

```typescript
export const gamificationApi = {
  listBadges: (token?: string) => request<UserAchievement[]>(`${API}/v1/gamify/badges/me`, { token }),
  listSkillNodes: (token?: string) => request<SkillNode[]>(`${API}/v1/personalization/skill-nodes/me`, { token }),
  level: (token?: string) => request<{ level: number; xp: number }>(`${API}/v1/gamify/level/me`, { token }),
};
```

The corresponding `GET /v1/gamify/badges/me`, `GET /v1/personalization/skill-nodes/me`, and `GET /v1/gamify/level/me` endpoints are added in Tasks 8 and 9.

- [ ] **Step 2: Add a composable for level-up detection**

Create `apps/web/app/lib/level-up.composable.ts`:

```typescript
import { useState } from '#app';

export function useLevelUpToast() {
  const shown = useState<number | null>('lastShownLevel', () => null);
  async function check(currentLevel: number) {
    if (shown.value !== null && currentLevel > shown.value) {
      shown.value = currentLevel;
      return currentLevel;
    }
    shown.value = currentLevel;
    return null;
  }
  return { check, shown };
```

This is a thin state holder. In Phase 8 it will be wired to the WebSocket SSE channel that `api` emits on level changes. For Phase 3 it is opt-in: pages call `check(level)` after a server action returns.

- [ ] **Step 3: Implement `BadgeToast`**

Create `apps/web/app/components/gamification/BadgeToast.vue`:

```vue
<script setup lang="ts">
defineProps<{ badges: Array<{ id: string; title: string; description?: string }> }>();
</script>

<template>
  <transition name="fade">
      <section v-if="badges.length > 0" class="badge-toast" role="status">
        <h2>Selamat! Badge baru:</h2>
        <ul>
          <li v-for="b in badges" :key="b.id">
            <strong>{{ b.title }}</strong>
            <p>{{ b.description }}</p>
          </li>
        </ul>
      </section>
    </transition>
</template>

<style scoped>
.badge-toast { /* theme tokens, not hard-coded colors */ }
@media (prefers-reduced-motion: reduce) {
  .badge-toast { transition: none; }
}
</style>
```

Style block uses theme tokens (per spec I5; no `Math.random()` or hard-coded color fallbacks).

- [ ] **Step 4: Implement `BadgeGrid`**

Create `apps/web/app/components/gamification/BadgeGrid.vue`:

```vue
<script setup lang="ts">
defineProps<{ items: Array<{ achievement: { id: string; title: string; icon?: string }; awardedAt: string }> }>();
</script>

<template>
  <ul class="badge-grid">
    <li v-for="ua in items" :key="ua.achievement.id" class="badge-tile">
      <img v-if="ua.achievement.icon" :src="ua.achievement.icon" :alt="ua.achievement.title" />
      <h3>{{ ua.achievement.title }}</h3>
      <p>Diberikan {{ new Date(ua.awardedAt).toLocaleDateString('id-ID') }}</p>
    </li>
  </ul>
</template>
```

- [ ] **Step 5: Implement `LevelBadge`**

Create `apps/web/app/components/gamification/LevelBadge.vue`:

```vue
<script setup lang="ts">
defineProps<{ level: number; xp: number }>();
</script>

<template>
  <div class="level-badge" :class="`level-${Math.min(level, 12)}`">
    <span class="level-number">{{ level }}</span>
    <span class="xp">{{ xp }} XP</span>
  </div>
</template>
```

CSS: theme-token-driven, level 1-12 each get a distinct theme color from the theme tokens (`--theme-level-1` through `--theme-level-12`).

- [ ] **Step 6: Implement `SkillTreeLeaf` + `SkillTreeBranch`**

Create `apps/web/app/components/gamification/SkillTreeLeaf.vue`:

```vue
<script setup lang="ts">
defineProps<{
  topic: { id: string; title: string };
  state?: 'LOCKED' | 'AVAILABLE' | 'IN_PROGRESS' | 'MASTERED';
  mastery?: number;
}>();
</script>

<template>
  <li :class="`skill-leaf skill-leaf--${state ?? 'AVAILABLE'}`">
    <NuxtLink :to="state === 'LOCKED' ? '' : `/my-learning/topics/${topic.id}`">
      <h3>{{ topic.title }}</h3>
      <span class="state-label">{{ state ?? 'AVAILABLE' }}</span>
      <progress v-if="mastery !== undefined" :value="mastery" max="1" />
    </NuxtLink>
  </li>
</template>
```

Create `apps/web/app/components/gamification/SkillTreeBranch.vue`:

```vue
<script setup lang="ts">
defineProps<{
  level: { id: number; title: string; topics: Array<{ id: string; title: string }> };
  nodesByTopic: Record<string, { state: string; progress: number }>;
}>();
</script>

<template>
  <section :class="`skill-branch skill-branch--level-${level.id}`">
    <h2>{{ level.title }}</h2>
    <ul>
      <SkillTreeLeaf
        v-for="topic in level.topics"
        :key="topic.id"
        :topic="topic"
        :state="(nodesByTopic[topic.id]?.state as any)"
        :mastery="nodesByTopic[topic.id]?.progress"
      />
    </ul>
  </section>
</template>
```

- [ ] **Step 7: Extend the Phase 1 `/skill-tree` page**

Modify `apps/web/app/pages/skill-tree/index.vue`. Replace the existing `loadGoldenGraph()` call with a server fetch that combines the graph with the user's `SkillNode` states:

```vue
<script setup lang="ts">
import { loadGoldenGraph } from '~/lib/load-golden-graph.server';

const graph = loadGoldenGraph();
const { data: skillNodes } = await useFetch('/api/v1/personalization/skill-nodes/me', {
  headers: useRequestHeaders(['cookie']),
  server: true,
});
const nodesByTopic = computed(() => {
  const map: Record<string, { state: any; progress: number }> = {};
  for (const n of skillNodes.value ?? []) map[n.topicId] = { state: n.state, progress: n.progress };
  return map;
});

useHead({ title: 'Pohon Keterampilan Akuntansi — ReduCera' });
</script>

<template>
  <main>
    <h1>Pohon Keterampilan</h1>
    <p>Setiap level membuka topik baru. Selesaikan prasyarat untuk melanjutkan.</p>
    <div class="skill-tree">
      <SkillTreeBranch v-for="level in graph.levels" :key="level.id" :level="level" :nodes-by-topic="nodesByTopic" />
    </div>
  </main>
</template>
```

The skill tree ships with mastered/locked/available/in-progress state in the first HTML byte (per spec I5).

- [ ] **Step 8: Build the badges page**

Create `apps/web/app/pages/my-learning/badges/index.vue`:

```vue
<script setup lang="ts">
const { data: badges } = await useFetch('/api/v1/gamify/badges/me', {
  headers: useRequestHeaders(['cookie']),
  server: true,
});
const { data: level } = await useFetch('/api/v1/gamify/level/me', {
  headers: useRequestHeaders(['cookie']),
  server: true,
});

useHead({ title: 'Badge & Level — ReduCera' });
</script>

<template>
  <main>
    <h1>Badge & Level</h1>
    <LevelBadge v-if="level" :level="level.level" :xp="level.xp" />
    <section>
      <h2>Badge</h2>
      <BadgeGrid :items="badges ?? []" />
      <p v-if="(badges ?? []).length === 0">Belum ada badge.</p>
    </section>
  </main>
</template>
```

- [ ] **Step 9: Verify SSR**

Run: `docker compose up -d --build web api`
Then: `curl -fsS -H "Cookie: <auth>" http://localhost/skill-tree | grep -E "Pohon Keterampilan|Level 1"`
Expected: both phrases in the first response.

- [ ] **Step 10: Run the Playwright MCP matrix**

Per AGENTS.md Web verification. Screenshots to `.playwright-mcp/phase-3-{skill-tree,badges}-{viewport}-{scheme}.png`. Pass criteria: theme colors honored; no `Math.random` in render (per spec I5); reduced-motion animations off.

---

## Task 8: Add the `GET /v1/gamify/badges/me` endpoint

**Files:**
- Create: `services/api/src/v1/gamify/badges/badge-issuance.controller.ts`
- Modify: `services/api/src/v1/gamify/badges/badge-issuance.module.ts`

- [ ] **Step 1: Write the failing controller test**

Append to `services/api/src/v1/gamify/badges/__tests__/badge-issuance-on-mastery.int.spec.ts` (or create a new file):

```typescript
describe('GET /v1/gamify/badges/me (Phase 3)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [BadgeIssuanceController],
      providers: [
        { provide: BadgeIssuanceService, useValue: { listMasters: async () => [{ userId: 'u1', achievement: { id: 'badge-first-step', title: 'First Step' }, awardedAt: new Date() }] } },
      ],
    })
      .overrideGuard('JwtAuthGuard').useValue({ canActivate: () => true })
      .compile();
    app = module.createNestApplication();
    await app.init();
  });

  it('returns the user achievement list', async () => {
    const res = await request(app.getHttpServer()).get('/v1/gamify/badges/me');
    expect(res.status).toBe(200);
    expect(res.body[0].achievement.id).toBe('badge-first-step');
  });

  afterAll(async () => { await app.close(); });
});
```

- [ ] **Step 2: Implement the controller**

Create `services/api/src/v1/gamify/badges/badge-issuance.controller.ts`:

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/v1/common/guards/jwt-auth.guard';
import { CurrentUser } from '@/v1/common/decorators/current-user.decorator';
import { BadgeIssuanceService } from './badge-issuance.service';

@Controller('v1/gamify/badges')
@UseGuards(JwtAuthGuard)
export class BadgeIssuanceController {
  constructor(private readonly badges: BadgeIssuanceService) {}

  @Get('me')
  me(@CurrentUser() user: { id: string }) {
    return this.badges.listMasters(user.id);
  }
}
```

- [ ] **Step 3: Register in `badge-issuance.module.ts`**

Modify `services/api/src/v1/gamify/badges/badge-issuance.module.ts`. Add `BadgeIssuanceController` to `controllers`.

- [ ] **Step 4: Run the tests**

Run: `cd services/api && pnpm jest src/v1/gamify/badges --silent`
Expected: PASS.

---

## Task 9: Add the `GET /v1/gamify/level/me` and `GET /v1/personalization/skill-nodes/me` endpoints

**Files:**
- Create: `services/api/src/v1/gamify/level/level.controller.ts`
- Modify: `services/api/src/v1/gamify/level/level-calculation.module.ts`
- Create: `services/api/src/v1/personalization/skill-node/skill-node.controller.ts`
- Modify: `services/api/src/v1/personalization/skill-node/skill-node.module.ts`

- [ ] **Step 1: Implement the level controller**

Create `services/api/src/v1/gamify/level/level.controller.ts`:

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/v1/common/guards/jwt-auth.guard';
import { CurrentUser } from '@/v1/common/decorators/current-user.decorator';
import { LevelService } from './level-calculation.service';

@Controller('v1/gamify/level')
@UseGuards(JwtAuthGuard)
export class LevelController {
  constructor(private readonly level: LevelService) {}

  @Get('me')
  me(@CurrentUser() user: { id: string }) {
    return this.level.levelForUser(user.id);
  }
}
```

Add to `level-calculation.module.ts` `controllers`. Import into `gamify.module.ts`.

- [ ] **Step 2: Implement the skill-node controller**

Create `services/api/src/v1/personalization/skill-node/skill-node.controller.ts`:

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/v1/common/guards/jwt-auth.guard';
import { CurrentUser } from '@/v1/common/decorators/current-user.decorator';
import { SkillNodeService } from './skill-node.service';
import { SkillNodeRepo } from './skill-node.repo';

@Controller('v1/personalization/skill-nodes')
@UseGuards(JwtAuthGuard)
export class SkillNodeController {
  constructor(private readonly nodes: SkillNodeRepo) {}

  @Get('me')
  async me(@CurrentUser() user: { id: string }) {
    return this.nodes.listByUser(user.id);
  }
}
```

`listByUser` is added to `skill-node.repo.ts`:

```typescript
async listByUser(userId: string) {
  return this.prisma.skillNode.findMany({ where: { userId } });
}
```

Register `SkillNodeController` in `skill-node.module.ts` `controllers`. Import into `v1.module.ts`.

- [ ] **Step 3: Verify with curl**

Run: `curl -fsS -H "Authorization: Bearer <token>" http://localhost/api/v1/gamify/level/me`
Expected: `{ "level": 1, "xp": 0 }` (or current values).

---

## Task 10: Phase 3 acceptance gates

**Files:**
- Modify: `docs/progress-tracker.md` (final Phase 3 block)

- [ ] **Step 1: Run the full backend test suite**

Run:
```
cd services/api && pnpm jest --silent && cd ../ai-api && uv run pytest -q
```
Expected: both exit 0; cumulative test count ≥ 140 (per spec T1 budget).

- [ ] **Step 2: Verify the 4 Phase 3 acceptance gates from §5.4**

Gates:

1. Skill tree renders SSR for any user with ≥ 1 lesson attempt — `curl -fsS -H "Cookie: <auth>" http://localhost/skill-tree | grep -E "Pohon Keterampilan|skill-leaf--MASTERED"` (after seeding a mastered topic).
2. Deterministic rule "issue badge when mastery ≥ 0.9 on topic X" verified by integration test — `cd services/api && pnpm jest src/v1/gamify/badges --silent` shows green.
3. Theme color scheme honored in animation without flash — Playwright matrix at light + dark for `/skill-tree` and `/my-learning/badges`.
4. Playwright matrix green at all viewports — `.playwright-mcp/phase-3-*.png`.

- [ ] **Step 3: Run the Playwright MCP matrix**

Per AGENTS.md Web verification. Three viewports × two color schemes × `reducedMotion: reduce` once for `/skill-tree` and `/my-learning/badges`.

- [ ] **Step 4: Append the Phase 3 verification table to `docs/progress-tracker.md`**

```
## Phase 3 Verification (YYYY-MM-DD)

| Gate | Status | Evidence |
|---|---|---|
| Skill tree SSR with state in first 50 lines | PASS / FAIL | curl output |
| Badge issuance rule deterministic | PASS / FAIL | pytest output |
| Theme color scheme honored | PASS / FAIL | Playwright output |
| Cohort leaderboard returns 400 without cohortId | PASS / FAIL | curl output |
| Cumulative test count >= 140 | PASS / FAIL | test output |
```

- [ ] **Step 5: Owner review checkpoint**

Per AGENTS.md, executor does not commit. Pause for owner:
1. `git status` and review diff.
3. `pnpm build` for both services; `docker compose -f docker-compose.prod.yml config -q` valid.
4. Stage and commit at their discretion.
5. Mark Phase 3 `DONE` in `docs/progress-tracker.md`.

---

## Out of Scope for Phase 3 (deferred to later phases)

- CreatorProfile, studio routes, Reviewer capability, mastery threshold for creator: **Phase 4**
- Wallet, Transaction, RevenueShare, Withdrawal, HoldWindow: **Phase 5**
- VirtualCompany simulator UI: **Phase 6**
- DecisionTrace table; AgentRouter; the AI side of badge celebration: **Phase 7**
- EventLog, MasterySnapshot (analytics layer): **Phase 8**
- RateLimit, BackupRecord, expanded AuditLog, full runbook: **Phase 9**