# Phase 1 — Accounting Learning MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Accounting Sandbox reachable end-to-end (the deterministic engine is implemented and unit-tested; the controller/route wiring, UI pages, and golden graph seed are not). Add the diagnostic + onboarding + skill-tree surface so a new learner can place themselves and start.

**Architecture:** Wire the existing `AccountingSandboxService` (deterministic, pure-logic, golden-tested) into a NestJS controller + module. Expose journal validation + scenario listing over HTTP behind auth + ownership checks. Build a sandbox UI page that lists scenarios and validates student journal entries deterministically. Add a placement diagnostic + onboarding page and a skill-tree viewer. Seed the golden accounting graph (4 levels × 15+ topics per `docs/strategy/06-accounting-domain.md`).

**Tech Stack:** NestJS 11, Prisma 7, Fastify (NestJS adapter), Nuxt 4 SSR, BullMQ (existing content queue), Zod (DTO validation), pnpm + uv workspaces. No new dependencies unless Task 1 explicitly requires.

## Global Constraints

Same global constraints as Phase 0. Plus:

- The deterministic accounting engine MUST NOT be replaced or wrapped by an LLM call (spec invariant I3). Journal validity is enforced in `api` code.
- The LLM may explain a student's correct/incorrect entry but cannot change the validity result (spec invariant I4).
- Web rendering: SSR first; sandbox + onboarding + skill-tree pages ship meaningful content in the first HTML byte (spec invariant I5).
- Sandbox route lives at `/api/v1/sandbox/*` behind `JwtAuthGuard`. Scenario listing is open to any authenticated user. Journal validation requires the user to own the scenario (OwnershipGuard).
- Seed data format: JSON files under `services/api/prisma/seed-data/`, loaded by `prisma db seed`. JSON must pass a structural validator: every `prerequisite` field points to an existing `topicId`.

---

## Task 1: Audit current state of Phase 1 acceptance gates

**Files:**
- Read: `services/api/src/v1/sandbox/accounting-sandbox.service.ts`
- Read: `services/api/src/v1/sandbox/__tests__/accounting-sandbox.service.spec.ts`
- Read: `apps/web/app/pages/` (confirm no `sandbox/`, `onboarding/`, `skill-tree/`)
- Read: `services/api/prisma/seed-data/` (confirm only theme seed exists)
- Create: `docs/progress-tracker.md` (append Phase 1 audit table)

- [ ] **Step 1: Verify deterministic engine exists and is golden-tested**

Run:
```
ls services/api/src/v1/sandbox/accounting-sandbox.service.ts && \
  grep -n "validateJournal\|isBalanced\|debitEqualsCredit" services/api/src/v1/sandbox/accounting-sandbox.service.ts && \
  pnpm jest src/v1/sandbox --silent
```
Expected: file exists, validation method names present, all tests green.

- [ ] **Step 2: Verify the sandbox service is NOT wired to a controller**

Run:
```
grep -rln "AccountingSandboxService" services/api/src/v1/
```
Expected: only `sandbox/accounting-sandbox.service.ts`, `sandbox/__tests__/...`, possibly `sandbox.module.ts` (if it exists). No `sandbox.controller.ts`.

If a `sandbox.module.ts` exists but doesn't register a controller, note it. The fix is in Task 2.

- [ ] **Step 3: Verify no sandbox UI pages exist**

Run:
```
find apps/web/app/pages -type d -name "sandbox" -o -name "onboarding" -o -name "skill-tree"
```
Expected: no matches.

- [ ] **Step 4: Verify golden graph seed is missing**

Run:
```
ls services/api/prisma/seed-data/ && \
  grep -lE "golden.accounting|accounting.graph|fundamentals.*financial" services/api/prisma/seed-data/*.json services/api/prisma/seed.ts 2>/dev/null
```
Expected: only `reducera-ocean.theme.json` (or no golden graph file).

- [ ] **Step 5: Verify Tutor endpoint streams with citation**

Run:
```
grep -rn "lessonId" services/ai-api/v1/learning/ 2>/dev/null | head -5
```
Expected: tutor pipeline includes `lessonId` in retrieval filter (per spec §4.3 AI-3 lesson-scope rule).

- [ ] **Step 6: Write the audit table**

Append to `docs/progress-tracker.md`:

```
## Phase 1 Audit (YYYY-MM-DD)

| Gate | Status | Evidence |
|---|---|---|
| Deterministic engine exists + golden tests green | PASS / FAIL | grep + jest output |
| Sandbox service wired to controller | MISSING / PRESENT | grep output |
| Sandbox UI pages exist | MISSING / PRESENT | find output |
| Onboarding UI pages exist | MISSING / PRESENT | find output |
| Skill-tree UI page exists | MISSING / PRESENT | find output |
| Golden accounting graph seed | MISSING / PRESENT | ls + grep output |
| Tutor endpoint streams with lessonId citation | PASS / FAIL | grep output |
```

Owner reviews the audit before Task 2 begins.

---

## Task 2: Wire `AccountingSandboxService` to a NestJS controller

**Files:**
- Create: `services/api/src/v1/sandbox/sandbox.controller.ts`
- Create: `services/api/src/v1/sandbox/sandbox.module.ts`
- Create: `services/api/src/v1/sandbox/dto/sandbox.dto.ts`
- Modify: `services/api/src/v1/sandbox/accounting-sandbox.service.ts` (add `listScenarios` and `getScenarioById` methods that operate on the golden graph)
- Create: `services/api/src/v1/sandbox/__tests__/sandbox.controller.int.spec.ts`

The deterministic engine exists but is pure-logic. To be reachable via HTTP, it needs a controller that:
1. Lists scenarios from the golden graph
2. Validates a journal entry from the student

- [ ] **Step 1: Read the existing service to confirm its public methods**

Run: `cat services/api/src/v1/sandbox/accounting-sandbox.service.ts | head -80`
Expected: a class with at least one method that validates journal entries (e.g., `validateJournal`, `isBalanced`).

If the service only has methods that operate on inputs and not on stored scenarios, you may need to add `listScenarios()` and `getScenarioById()` that read from a `GoldenScenario` table or from the seed data loaded into memory.

For Phase 1, prefer reading scenarios from seed data loaded at module init (no DB write). Add a `GoldenScenarioProvider` that reads the golden accounting graph JSON at module init.

- [ ] **Step 2: Add `listScenarios` and `getScenarioById` to the service**

Modify `services/api/src/v1/sandbox/accounting-sandbox.service.ts` to accept a list of scenarios in its constructor:

```typescript
export interface GoldenScenario {
  id: string;
  title: string;
  description: string;
  difficulty: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  level: 1 | 2 | 3 | 4;
  topicId: string;
  transactions: Array<{
    label: string;
    debitAccount: string;
    creditAccount: string;
    amount: number;
  }>;
}

export class AccountingSandboxService {
  constructor(private readonly scenarios: GoldenScenario[]) {}
  
  listScenarios(filter?: { level?: number; topicId?: string }): GoldenScenario[] { ... }
  getScenarioById(id: string): GoldenScenario | undefined { ... }
  validateJournal(input: JournalProposalInput): { isBalanced: boolean; ... } { ... }
}
```

The existing validation method's signature stays unchanged.

- [ ] **Step 3: Write the failing test for the controller**

Create `services/api/src/v1/sandbox/__tests__/sandbox.controller.int.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { SandboxController } from '../sandbox.controller';
import { AccountingSandboxService } from '../accounting-sandbox.service';
import { JwtAuthGuard } from '@/v1/common/guards/jwt-auth.guard';

describe('SandboxController (Phase 1)', () => {
  let app: INestApplication;
  const userToken = 'Bearer valid-user-token';

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [SandboxController],
      providers: [
        AccountingSandboxService,
        { provide: 'GOLDEN_SCENARIOS', useValue: [
          { id: 's1', title: 'Buy inventory $100', description: '...', difficulty: 'BEGINNER', level: 1, topicId: 't1',
            transactions: [{ label: 'Buy inventory', debitAccount: 'Inventory', creditAccount: 'Cash', amount: 100 }] },
        ] },
      ],
    })
      .overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })
      .compile();
    app = module.createNestApplication();
    await app.init();
  });

  it('GET /sandbox/scenarios returns the scenario list', async () => {
    const res = await request(app.getHttpServer()).get('/sandbox/scenarios').set('Authorization', userToken);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ id: 's1', level: 1 });
  });

  it('POST /sandbox/journal validates balanced entry', async () => {
    const res = await request(app.getHttpServer())
      .post('/sandbox/journal')
      .set('Authorization', userToken)
      .send({ scenarioId: 's1', entries: [{ debitAccount: 'Inventory', creditAccount: 'Cash', amount: 100 }] });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ isBalanced: true });
  });

  it('POST /sandbox/journal rejects unbalanced entry with 400', async () => {
    const res = await request(app.getHttpServer())
      .post('/sandbox/journal')
      .set('Authorization', userToken)
      .send({ scenarioId: 's1', entries: [{ debitAccount: 'Inventory', creditAccount: 'Cash', amount: 50 }] });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ isBalanced: false });
  });

  afterAll(async () => { await app.close(); });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `cd services/api && pnpm jest src/v1/sandbox/__tests__/sandbox.controller.int.spec.ts --silent`
Expected: FAIL — controller doesn't exist yet.

- [ ] **Step 5: Implement the DTO**

Create `services/api/src/v1/sandbox/dto/sandbox.dto.ts`:

```typescript
import { z } from 'zod';

export const ListScenariosQuerySchema = z.object({
  level: z.coerce.number().int().min(1).max(4).optional(),
  topicId: z.string().min(1).optional(),
});
export type ListScenariosQuery = z.infer<typeof ListScenariosQuerySchema>;

export const ValidateJournalSchema = z.object({
  scenarioId: z.string().min(1),
  entries: z.array(z.object({
    debitAccount: z.string().min(1),
    creditAccount: z.string().min(1),
    amount: z.number().positive(),
  })).min(1),
});
export type ValidateJournalDto = z.infer<typeof ValidateJournalSchema>;
```

- [ ] **Step 6: Implement the controller**

Create `services/api/src/v1/sandbox/sandbox.controller.ts`:

```typescript
import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/v1/common/guards/jwt-auth.guard';
import { AccountingSandboxService } from './accounting-sandbox.service';
import { ListScenariosQuerySchema, ValidateJournalSchema } from './dto/sandbox.dto';

@Controller('v1/sandbox')
@UseGuards(JwtAuthGuard)
export class SandboxController {
  constructor(private readonly sandbox: AccountingSandboxService) {}

  @Get('scenarios')
  list(@Query() raw: unknown) {
    const { level, topicId } = ListScenariosQuerySchema.parse(raw);
    return this.sandbox.listScenarios({ level, topicId });
  }

  @Post('journal')
  validate(@Body() raw: unknown) {
    const dto = ValidateJournalSchema.parse(raw);
    const scenario = this.sandbox.getScenarioById(dto.scenarioId);
    if (!scenario) {
      return { isBalanced: false, reason: 'scenario_not_found' };
    }
    return this.sandbox.validateJournal({
      scenario,
      entries: dto.entries,
    });
  }
}
```

If `validateJournal` in the service has a different signature than shown above, adapt the controller call to match (the existing golden test in `accounting-sandbox.service.spec.ts` is the source of truth).

- [ ] **Step 7: Implement the module**

Create `services/api/src/v1/sandbox/sandbox.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { SandboxController } from './sandbox.controller';
import { AccountingSandboxService } from './accounting-sandbox.service';
import { join } from 'path';

@Module({
  controllers: [SandboxController],
  providers: [
    AccountingSandboxService,
    {
      provide: 'GOLDEN_SCENARIOS',
      useFactory: () => {
        // Loaded from seed-data; populated in Task 4.
        // For now, an empty array so the service constructs without error.
        return [];
      },
    },
  ],
})
export class SandboxModule {}
```

In Task 4 this useFactory is replaced with a JSON loader.

- [ ] **Step 8: Register the module**

Find the root module (likely `services/api/src/v1/v1.module.ts` or `services/api/src/app.module.ts`). Add `SandboxModule` to the `imports` array.

- [ ] **Step 9: Run the controller test**

Run: `cd services/api && pnpm jest src/v1/sandbox/__tests__/sandbox.controller.int.spec.ts --silent`
Expected: PASS, 3 tests.

- [ ] **Step 10: Run the full suite**

Run: `cd services/api && pnpm jest --silent 2>&1 | tail -3`
Expected: no new failures.

---

## Task 3: Add journal workspace persistence

**Files:**
- Modify: `services/api/src/v1/sandbox/accounting-sandbox.service.ts` (add optional `journalRepo` injection)
- Create: `services/api/src/v1/sandbox/sandbox-journal.repo.ts`
- Create: `services/api/src/v1/sandbox/__tests__/sandbox-journal.repo.int.spec.ts`

A journal validation that the student can't save and review is a dead end. Add a `SandboxJournal` table to persist the student's attempt.

- [ ] **Step 1: Write the failing schema test**

The new Prisma model `SandboxJournal`:
```
model SandboxJournal {
  id           String   @id @default(cuid())
  userId       String
  scenarioId   String
  entries      Json
  isBalanced   Boolean
  score        Float
  feedback     String?
  createdAt    DateTime @default(now())

  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  scenarioRef  GoldenScenario? @relation(fields: [scenarioId], references: [id], onDelete: SetNull)

  @@index([userId, createdAt])
}
```

Verify the model is in `services/api/prisma/schema.prisma`. If not, add it.

- [ ] **Step 2: Write the migration by hand**

Run (per AGENTS.md):
```
cd services/api && pnpm prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script
```
Expected: a SQL diff containing `CREATE TABLE "SandboxJournal" ...`.

Save the output to `services/api/prisma/migrations/<timestamp>_sandbox_journal/migration.sql`. Apply on a scratch DB only, not the dev one:

```
TEST_DATABASE_URL=postgresql://... pnpm prisma migrate deploy
```

- [ ] **Step 3: Write the failing repo test**

Create `services/api/src/v1/sandbox/__tests__/sandbox-journal.repo.int.spec.ts`:

```typescript
import { SandboxJournalRepo } from '../sandbox-journal.repo';
import { PrismaService } from '@/common/config/prisma/prisma.service';
import { Test } from '@nestjs/testing';

describe('SandboxJournalRepo (Phase 1)', () => {
  let repo: SandboxJournalRepo;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      providers: [SandboxJournalRepo, PrismaService],
    }).compile();
    repo = module.get(SandboxJournalRepo);
  });

  it('persists a journal attempt and reads it back', async () => {
    const userId = 'test-user-journal-1';
    const created = await repo.create({
      userId,
      scenarioId: 's1',
      entries: [{ debitAccount: 'Inventory', creditAccount: 'Cash', amount: 100 }],
      isBalanced: true,
      score: 1.0,
    });
    const found = await repo.findById(created.id);
    expect(found).toMatchObject({ userId, scenarioId: 's1', isBalanced: true });
  });

  it('lists journals by user, scoped to userId', async () => {
    const list = await repo.listByUser('test-user-journal-1');
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((j) => j.userId === 'test-user-journal-1')).toBe(true);
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `cd services/api && TEST_DATABASE_URL=... pnpm jest src/v1/sandbox/__tests__/sandbox-journal.repo.int.spec.ts --silent`
Expected: FAIL — repo doesn't exist yet.

- [ ] **Step 5: Implement the repo**

Create `services/api/src/v1/sandbox/sandbox-journal.repo.ts` with `create(input)`, `findById(id)`, `listByUser(userId)` methods that wrap Prisma `sandboxJournal` calls. Follow the pattern in `services/api/src/v1/chat/contents/contents.repo.ts`.

- [ ] **Step 6: Re-run the test**

Run: `cd services/api && TEST_DATABASE_URL=... pnpm jest src/v1/sandbox/__tests__/sandbox-journal.repo.int.spec.ts --silent`
Expected: PASS.

- [ ] **Step 7: Wire the repo into the controller**

Modify `SandboxController.validate()` so that, after deterministic validation, it persists the journal attempt via `SandboxJournalRepo`. Return the persisted row id in the response.

Add `SandboxJournalRepo` to `SandboxModule.providers`. Add the import.

- [ ] **Step 8: Run the full suite**

Run: `cd services/api && pnpm jest --silent 2>&1 | tail -3`
Expected: no new failures.

---

## Task 4: Add golden accounting graph seed data

**Files:**
- Create: `services/api/prisma/seed-data/golden-accounting-graph.json`
- Create: `services/api/prisma/seed-data/golden-scenarios.json`
- Modify: `services/api/src/v1/sandbox/sandbox.module.ts` (load the JSON)
- Modify: `services/api/prisma/seed.ts` (call the JSON validator)
- Create: `services/api/prisma/seed-data/__tests__/golden-graph-validator.spec.ts`

Per `docs/strategy/06-accounting-domain.md`, the golden graph has 4 levels × 15+ topics. Every `prerequisite` field must point to an existing `topicId` (the structural validator).

- [ ] **Step 1: Read the strategy doc to find the golden graph schema**

Run: `head -100 docs/strategy/06-accounting-domain.md`
Expected: a description of the levels (Fundamentals → Financial Accounting → Managerial → Advanced / Audit / Tax) and topic structure.

- [ ] **Step 2: Write the failing validator test**

Create `services/api/prisma/seed-data/__tests__/golden-graph-validator.spec.ts`:

```typescript
import { readFileSync } from 'fs';
import { join } from 'path';

const GRAPH_PATH = join(__dirname, '..', 'golden-accounting-graph.json');

describe('golden-accounting-graph.json (Phase 1)', () => {
  const graph = JSON.parse(readFileSync(GRAPH_PATH, 'utf-8'));

  it('has 4 levels', () => {
    expect(graph.levels.map((l: any) => l.id)).toEqual([1, 2, 3, 4]);
  });

  it('each level has >= 15 topics', () => {
    for (const level of graph.levels) {
      expect(level.topics.length).toBeGreaterThanOrEqual(15);
    }
  });

  it('every prerequisite points to an existing topicId in the same level or earlier', () => {
    const allIds = new Set<string>();
    for (const level of graph.levels) {
      for (const topic of level.topics) {
        allIds.add(topic.id);
      }
    }
    for (const level of graph.levels) {
      for (const topic of level.topics) {
        for (const prereqId of topic.prerequisites ?? []) {
          expect(allIds.has(prereqId)).toBe(true);
        }
      }
    }
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd services/api && pnpm jest prisma/seed-data/__tests__/golden-graph-validator.spec.ts --silent`
Expected: FAIL — file does not exist.

- [ ] **Step 4: Author the golden graph JSON**

Create `services/api/prisma/seed-data/golden-accounting-graph.json`. Author 4 levels × 15+ topics following the strategy doc. Use real accounting concepts (e.g., Level 1 — Accounting Equation, Debits & Credits, Journals, Ledgers, Trial Balance, Adjusting Entries, Closing Entries, etc.).

Each topic shape:
```json
{
  "id": "l1-t01-accounting-equation",
  "title": "The Accounting Equation",
  "description": "...",
  "level": 1,
  "prerequisites": [],
  "estimatedMinutes": 30
}
```

The validator test enforces structural integrity, not content correctness. Aim for accurate accounting titles and prerequisite chains (e.g., Journal Entries require Debits & Credits; Trial Balance requires Ledgers).

- [ ] **Step 5: Re-run the validator test**

Run: `cd services/api && pnpm jest prisma/seed-data/__tests__/golden-graph-validator.spec.ts --silent`
Expected: PASS.

- [ ] **Step 6: Author `golden-scenarios.json`**

Create `services/api/prisma/seed-data/golden-scenarios.json` with at least one scenario per level, ~6+ scenarios total. Each scenario references a `topicId` from the golden graph.

Scenario shape:
```json
{
  "id": "s-buy-inventory-100",
  "topicId": "l1-t02-debits-credits",
  "level": 1,
  "title": "Buy inventory for $100 cash",
  "description": "A small shop buys $100 of inventory with cash. Record the journal entry.",
  "difficulty": "BEGINNER",
  "expectedEntries": [
    { "debitAccount": "Inventory", "creditAccount": "Cash", "amount": 100 }
  ]
}
```

The validator test (next step) checks that `topicId` exists in the golden graph.

- [ ] **Step 7: Add a scenarios validator test**

Append to the same test file:

```typescript
const SCENARIOS_PATH = join(__dirname, '..', 'golden-scenarios.json');

describe('golden-scenarios.json (Phase 1)', () => {
  const graph = JSON.parse(readFileSync(GRAPH_PATH, 'utf-8'));
  const scenarios = JSON.parse(readFileSync(SCENARIOS_PATH, 'utf-8'));
  const topicIds = new Set<string>();
  for (const level of graph.levels) {
    for (const topic of level.topics) {
      topicIds.add(topic.id);
    }
  }

  it('has at least 6 scenarios', () => {
    expect(scenarios.length).toBeGreaterThanOrEqual(6);
  });

  it('every scenario topicId exists in the golden graph', () => {
    for (const s of scenarios) {
      expect(topicIds.has(s.topicId)).toBe(true);
    }
  });

  it('every scenario has at least 1 expected entry', () => {
    for (const s of scenarios) {
      expect(s.expectedEntries.length).toBeGreaterThanOrEqual(1);
      const total = s.expectedEntries.reduce((sum: number, e: any) => sum + e.amount, 0);
      const totalDebit = s.expectedEntries.filter((e: any) => e.debitAccount).reduce((sum: number, e: any) => sum + e.amount, 0);
      const totalCredit = s.expectedEntries.filter((e: any) => e.creditAccount).reduce((sum: number, e: any) => sum + e.amount, 0);
      expect(totalDebit).toBe(totalCredit);
    }
  });
});
```

- [ ] **Step 8: Wire the seed loader**

Modify `services/api/src/v1/sandbox/sandbox.module.ts` to load `golden-scenarios.json`:

```typescript
{
  provide: 'GOLDEN_SCENARIOS',
  useFactory: () => {
    const path = join(process.cwd(), 'prisma', 'seed-data', 'golden-scenarios.json');
    return JSON.parse(readFileSync(path, 'utf-8'));
  },
}
```

Add `import { readFileSync } from 'fs';` and `import { join } from 'path';`.

- [ ] **Step 9: Wire the seed into prisma db seed**

Modify `services/api/prisma/seed.ts` (or create it if missing) to:
1. Run the validator tests on both JSON files before any DB write.
2. Call `prisma.topic.createMany(...)` for the topics in the golden graph (or upsert into existing `Topic` model — check the schema).

If the existing seed only handles theme + a few entities, extend it.

- [ ] **Step 10: Run prisma db seed on a scratch DB**

Run (per AGENTS.md Prisma rule — scratch only):
```
TEST_DATABASE_URL=postgresql://... pnpm prisma migrate deploy && \
  TEST_DATABASE_URL=postgresql://... pnpm db seed
```
Expected: seed completes; `prisma topic.findMany` returns the golden graph topics.

- [ ] **Step 11: Verify the controller returns the seeded scenarios**

Restart `docker compose up -d --build api`. Run:
```
curl -fsS -H "Authorization: Bearer <test-token>" http://localhost/api/v1/sandbox/scenarios | jq 'length'
```
Expected: `>= 6`.

---

## Task 5: Build the sandbox UI page (SSR-first)

**Files:**
- Create: `apps/web/app/pages/sandbox/index.vue`
- Create: `apps/web/app/pages/sandbox/[scenarioId].vue`
- Modify: `apps/web/app/lib/api.ts` (add `sandbox` API helper)
- Create: `apps/web/app/components/sandbox/ScenarioCard.vue`
- Create: `apps/web/app/components/sandbox/JournalEntryForm.vue`

- [ ] **Step 1: Add the API helper**

Modify `apps/web/app/lib/api.ts`. Find the section with request helpers (likely `get`, `post`, `request`). Add:

```typescript
export const sandboxApi = {
  listScenarios: (token?: string) => request<SandboxScope[]>(`${API}/v1/sandbox/scenarios`, { token }),
  validateJournal: (body: { scenarioId: string; entries: Array<{ debitAccount: string; creditAccount: string; amount: number }> }, token?: string) =>
    request<{ isBalanced: boolean; score: number; feedback?: string }>(`${API}/v1/sandbox/journal`, { method: 'POST', body, token }),
};
```

Add the `SandboxScope` interface. Use the internal URL for SSR (per spec I5 + AGENTS.md BL-14 fix).

- [ ] **Step 2: Write the page test (smoke)**

Create `apps/web/app/pages/sandbox/__tests__/index.smoke.spec.ts` (or whatever test pattern the web uses; check `apps/web/package.json` for a test runner — if none, skip and rely on Playwright matrix):

```typescript
import { mount } from '@vue/test-utils';
import SandboxIndex from '../index.vue';

describe('SandboxIndex', () => {
  it('renders scenario list from server-fetched props', () => {
    const wrapper = mount(SandboxIndex, {
      props: { scenarios: [{ id: 's1', title: 'Buy inventory $100', level: 1, topicId: 't1', difficulty: 'BEGINNER' }] },
    });
    expect(wrapper.text()).toContain('Buy inventory $100');
  });
});
```

If the web has no test runner (per BL-18 in the V1 execution plan), skip this test and rely on Playwright MCP matrix verification.

- [ ] **Step 3: Implement the index page**

Create `apps/web/app/pages/sandbox/index.vue`:

```vue
<script setup lang="ts">
import type { SandboxScope } from '~/interfaces/sandbox';

const { data: scenarios } = await useFetch<SandboxScope[]>('/api/v1/sandbox/scenarios', {
  headers: useRequestHeaders(['cookie']),
  server: true,
});

useHead({ title: 'Sandbox Latihan Akuntansi — ReduCera' });
</script>

<template>
  <main>
    <h1>Sandbox Akuntansi</h1>
    <p>Latih pencatatan jurnal Anda di skenario dunia nyata.</p>

    <ul class="scenario-grid">
      <SandboxScenarioCard
        v-for="scenario in scenarios ?? []"
        :key="scenario.id"
        :scenario="scenario"
      />
    </ul>
  </main>
</template>
```

- [ ] **Step 4: Implement the ScenarioCard component**

Create `apps/web/app/components/sandbox/ScenarioCard.vue`:

```vue
<script setup lang="ts">
import type { SandboxScope } from '~/interfaces/sandbox';

defineProps<{ scenario: SandboxScope }>();
</script>

<template>
  <li class="scenario-card">
    <NuxtLink :to="`/sandbox/${scenario.id}`">
      <h2>{{ scenario.title }}</h2>
      <p class="meta">
        Level {{ scenario.level }} ·
        <span :class="`difficulty difficulty--${scenario.difficulty.toLowerCase()}`">
          {{ scenario.difficulty }}
        </span>
      </p>
      <p class="description">{{ scenario.description }}</p>
    </NuxtLink>
  </li>
</template>
```

- [ ] **Step 5: Implement the detail page**

Create `apps/web/app/pages/sandbox/[scenarioId].vue`. Use `useFetch` to load the scenario, `useFetch` to load its golden expected journal from the seed (or from a new endpoint), and a form to submit student journal entries via `sandboxApi.validateJournal`.

```vue
<script setup lang="ts">
const route = useRoute();
const scenarioId = computed(() => String(route.params.scenarioId));

const { data: scenarios } = await useFetch('/api/v1/sandbox/scenarios', {
  headers: useRequestHeaders(['cookie']),
  server: true,
});
const scenario = computed(() => scenarios.value?.find((s) => s.id === scenarioId.value));

const entries = ref<Array<{ debitAccount: string; creditAccount: string; amount: number }>>([]);
const result = ref<{ isBalanced: boolean; score: number; feedback?: string } | null>(null);
const submitting = ref(false);

async function submit() {
  submitting.value = true;
  try {
    result.value = await sandboxApi.validateJournal({ scenarioId: scenarioId.value, entries: entries.value });
  } finally {
    submitting.value = false;
  }
}

useHead({ title: () => `${scenario.value?.title ?? 'Skenario'} — ReduCera` });
</script>

<template>
  <main v-if="scenario">
    <h1>{{ scenario.title }}</h1>
    <p>{{ scenario.description }}</p>

    <form @submit.prevent="submit">
      <div v-for="(entry, i) in entries" :key="i" class="entry-row">
        <input v-model="entry.debitAccount" placeholder="Akun debit" />
        <input v-model="entry.creditAccount" placeholder="Akun kredit" />
        <input v-model.number="entry.amount" type="number" placeholder="Jumlah" min="0" />
        <button type="button" @click="entries.splice(i, 1)">Hapus</button>
      </div>
      <button type="button" @click="entries.push({ debitAccount: '', creditAccount: '', amount: 0 })">
        Tambah baris
      </button>
      <button type="submit" :disabled="submitting">{{ submitting ? 'Memvalidasi…' : 'Validasi Jurnal' }}</button>
    </form>

    <section v-if="result" :class="`result ${result.isBalanced ? 'balanced' : 'unbalanced'}`">
      <strong>{{ result.isBalanced ? 'Seimbang!' : 'Tidak seimbang' }}</strong>
      <p>Skor: {{ result.score }}</p>
      <p v-if="result.feedback">{{ result.feedback }}</p>
    </section>
  </main>
</template>
```

- [ ] **Step 6: Verify SSR**

Run: `docker compose up -d --build web`
Then: `curl -fsS http://localhost/sandbox | grep -E "Sandbox Akuntansi|scenario"`
Expected: the H1 and at least one scenario reference appear in the first response.

- [ ] **Step 7: Run the Playwright MCP matrix**

Per AGENTS.md Web verification, run the matrix at viewports 375x812, 768x1024, 1280x800, both color schemes, `reducedMotion: reduce` once. Screenshots to `.playwright-mcp/phase-1-sandbox-{viewport}-{scheme}.png`.

Pass criteria: zero console errors; no failed requests to `api` or `ai-api` apart from expected 401 before login; the page is reachable behind login; form submission shows deterministic result.

---

## Task 6: Build the onboarding placement diagnostic (SSR-first)

**Files:**
- Create: `apps/web/app/pages/onboarding/index.vue`
- Create: `apps/web/app/pages/onboarding/diagnostic.vue`
- Create: `apps/web/app/components/onboarding/DiagnosticQuestion.vue`
- Modify: `apps/web/app/lib/api.ts` (add `diagnostic` helper)
- Modify: `services/api/src/v1/learning/user-steps/` or new `services/api/src/v1/onboarding/` (placement diagnostic endpoint)

A first-time user needs a placement diagnostic that recommends a starting topic + lesson based on their answers. The result feeds `AdaptivePolicyService` later (Phase 2).

- [ ] **Step 1: Audit current user-steps module**

Run:
```
ls services/api/src/v1/learning/user-steps/ && grep -n "Post\|@Get" services/api/src/v1/learning/user-steps/user-steps.controller.ts
```
Expected: a controller with at least one POST (for recording a step completion). If not, the onboarding endpoint goes in a new module.

- [ ] **Step 2: Decide placement**

If `user-steps` already records completion, the placement result can be a new POST there:
`POST /v1/learning/placement-diagnostic` accepts answers, returns `{ recommendedLevel, recommendedTopicId, confidence }`.

If `user-steps` is too narrow, create a new module `services/api/src/v1/onboarding/` with `placement.controller.ts`, `placement.service.ts`, `placement.module.ts`.

For Phase 1, prefer extending `user-steps` to keep the module count flat (per spec I1 — no new microservices; preference should extend existing modules too where reasonable).

- [ ] **Step 3: Write the failing endpoint test**

Create `services/api/src/v1/learning/user-steps/__tests__/placement-diagnostic.int.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { UserStepsController } from '../user-steps.controller';
import { UserStepsService } from '../user-steps.service';

describe('PlacementDiagnostic (Phase 1)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [UserStepsController],
      providers: [UserStepsService],
    })
      .overrideGuard(/* JwtAuthGuard */).useValue({ canActivate: () => true })
      .compile();
    app = module.createNestApplication();
    await app.init();
  });

  it('returns a recommendation based on the answers', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/learning/placement-diagnostic')
      .send({ answers: ['A', 'B', 'C', 'A', 'B'] });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      recommendedLevel: expect.any(Number),
      recommendedTopicId: expect.any(String),
      confidence: expect.any(Number),
    });
  });

  afterAll(async () => { await app.close(); });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `cd services/api && pnpm jest src/v1/learning/user-steps/__tests__/placement-diagnostic.int.spec.ts --silent`
Expected: FAIL — endpoint doesn't exist.

- [ ] **Step 5: Implement the deterministic placement service**

Add to `UserStepsService` (or new service):

```typescript
placeDiagnostic(answers: string[]): { recommendedLevel: number; recommendedTopicId: string; confidence: number } {
  const score = answers.filter((a) => a === 'A').length / answers.length;
  let recommendedLevel = 1;
  if (score >= 0.8) recommendedLevel = 4;
  else if (score >= 0.6) recommendedLevel = 3;
  else if (score >= 0.4) recommendedLevel = 2;

  const topics = this.loadGoldenGraph();
  const levelTopics = topics.find((l: any) => l.id === recommendedLevel)?.topics ?? [];
  const recommendedTopicId = levelTopics[0]?.id ?? 'l1-t01-accounting-equation';

  return {
    recommendedLevel,
    recommendedTopicId,
    confidence: score,
  };
}
```

The placement is deterministic — no LLM call (per spec I3 / AI-7).

- [ ] **Step 6: Wire the controller**

Add `POST /v1/learning/placement-diagnostic` to `UserStepsController` calling `UserStepsService.placeDiagnostic(...)`.

- [ ] **Step 7: Re-run the test**

Run: `cd services/api && pnpm jest src/v1/learning/user-steps/__tests__/placement-diagnostic.int.spec.ts --silent`
Expected: PASS.

- [ ] **Step 8: Implement the onboarding index page**

Create `apps/web/app/pages/onboarding/index.vue`. Welcome page that introduces the platform and routes to `/onboarding/diagnostic`.

```vue
<script setup lang="ts">
useHead({ title: 'Selamat Datang — ReduCera' });
</script>

<template>
  <main>
    <h1>Selamat Datang di ReduCera</h1>
    <p>Mari mulai dengan mendiagnosis kemampuan akuntansi Anda.</p>
    <NuxtLink to="/onboarding/diagnostic">Mulai Diagnostik</NuxtLink>
  </main>
</template>
```

- [ ] **Step 9: Implement the diagnostic page**

Create `apps/web/app/pages/onboarding/diagnostic.vue`. Shows 5 questions (one per level), collects answers, calls the placement endpoint, and stores `recommendedTopicId` in a cookie (so the home page reads it on SSR per spec I1 web rendering).

```vue
<script setup lang="ts">
const questions = [
  { id: 'q1', level: 1, prompt: 'Aset = Liabilitas + ...', options: ['Ekuitas', 'Pendapatan', 'Beban'] },
  { id: 'q2', level: 2, prompt: 'Persediaan dinilai dengan ...', options: ['FIFO', 'LIFO', 'Average'] },
  { id: 'q3', level: 3, prompt: 'Variabel costing vs absorption costing adalah topik ...', options: ['Akuntansi Manajemen', 'Akuntansi Keuangan', 'Audit'] },
  { id: 'q4', level: 4, prompt: 'Konsolidasi laporan keuangan adalah topik ...', options: ['Akuntansi Keuangan Menengah', 'Akuntansi Keuangan Lanjutan', 'Audit'] },
  { id: 'q5', level: 4, prompt: 'Pajak tangguhan adalah topik ...', options: ['Pajak', 'Audit', 'Etika'] },
];
const answers = ref<string[]>(['', '', '', '', '']);
const submitting = ref(false);
const result = ref<{ recommendedLevel: number; recommendedTopicId: string } | null>(null);

async function submit() {
  submitting.value = true;
  try {
    const res = await $fetch<{ recommendedLevel: number; recommendedTopicId: string }>(
      '/api/v1/learning/placement-diagnostic',
      { method: 'POST', body: { answers: answers.value } },
    );
    result.value = res;
    document.cookie = `reducera.recommendedTopicId=${res.recommendedTopicId}; path=/; max-age=2592000`;
  } finally {
    submitting.value = false;
  }
}

useHead({ title: 'Diagnostik Awal — ReduCera' });
</script>

<template>
  <main>
    <h1>Diagnostik Awal</h1>
    <form @submit.prevent="submit">
      <fieldset v-for="(q, i) in questions" :key="q.id">
        <legend>{{ q.prompt }}</legend>
        <label v-for="opt in q.options" :key="opt">
          <input type="radio" :name="q.id" :value="opt" v-model="answers[i]" />
          {{ opt }}
        </label>
      </fieldset>
      <button type="submit" :disabled="submitting || answers.some((a) => !a)">
        {{ submitting ? 'Mengirim…' : 'Lihat Rekomendasi' }}
      </button>
    </form>
    <section v-if="result">
      <h2>Anda cocok untuk Level {{ result.recommendedLevel }}</h2>
      <NuxtLink :to="`/my-learning/topics/${result.recommendedTopicId}`">Mulai dari sini</NuxtLink>
    </section>
  </main>
</template>
```

- [ ] **Step 10: Verify SSR**

Run: `docker compose up -d --build web api`
Then: `curl -fsS http://localhost/onboarding | grep -E "Selamat Datang|Mulai Diagnostik"`
Expected: both phrases present in the first response.

- [ ] **Step 11: Run the Playwright MCP matrix for `/onboarding`**

Per AGENTS.md Web verification. Screenshots to `.playwright-mcp/phase-1-onboarding-{viewport}-{scheme}.png`.

---

## Task 7: Build the skill tree viewer (SSR-first)

**Files:**
- Create: `apps/web/app/pages/skill-tree/index.vue`
- Create: `apps/web/app/components/skill-tree/LevelColumn.vue`
- Create: `apps/web/app/components/skill-tree/TopicNode.vue`
- Modify: `apps/web/app/lib/api.ts` (add `skillTree` helper)
- Create: `apps/web/app/lib/load-golden-graph.server.ts` (server-side load)

The skill tree shows the 4 levels × topics with mastery state for the current user. SSR-rendered with the golden graph + the user's progress.

- [ ] **Step 1: Read the existing `learn/topics/` page for the existing topic list pattern**

Run: `ls apps/web/app/pages/learn/topics/ && cat apps/web/app/pages/learn/topics/index.vue 2>/dev/null | head -40`
Expected: a server-fetched topic list. If it doesn't exist, the skill tree page becomes the first one.

- [ ] **Step 2: Add the helper**

Modify `apps/web/app/lib/api.ts`. Add:

```typescript
export const skillTreeApi = {
  graph: (token?: string) => request<{ levels: Array<{ id: number; title: string; topics: any[] }> }>(`${API}/v1/sandbox/scenarios-graph`, { token }),
};
```

If the api doesn't yet expose the golden graph, add `GET /v1/sandbox/graph` to `SandboxController` that returns the loaded golden graph (loaded once at module init, served from memory — no DB write per spec I2).

- [ ] **Step 3: Add the SSR graph loader (no auth needed for read)**

Create `apps/web/app/lib/load-golden-graph.server.ts`:

```typescript
import goldenGraph from '~/../services/api/prisma/seed-data/golden-accounting-graph.json';

export function loadGoldenGraph() {
  return goldenGraph;
}
```

This file imports the JSON directly into the SSR bundle. Vite/Nuxt must allow the import path. If Nuxt doesn't allow imports from outside `apps/web/`, copy the JSON to `apps/web/app/lib/golden-accounting-graph.json` at build time, or move the JSON into the web repo's data folder.

The cleanest path: copy/symlink the JSON into `apps/web/app/lib/` during build. Document the path in a comment (wait — no comments per AGENTS.md). Document in `apps/web/README.md` instead.

- [ ] **Step 4: Implement the page**

Create `apps/web/app/pages/skill-tree/index.vue`:

```vue
<script setup lang="ts">
import { loadGoldenGraph } from '~/lib/load-golden-graph.server';

const graph = loadGoldenGraph();

useHead({ title: 'Pohon Keterampilan Akuntansi — ReduCera' });
</script>

<template>
  <main>
    <h1>Pohon Keterampilan</h1>
    <p>Setiap level membuka topik baru. Selesaikan prasyarat untuk melanjutkan.</p>

    <div class="skill-tree">
      <LevelColumn v-for="level in graph.levels" :key="level.id" :level="level" />
    </div>
  </main>
</template>
```

- [ ] **Step 5: Implement the components**

Create `apps/web/app/components/skill-tree/LevelColumn.vue`:

```vue
<script setup lang="ts">
defineProps<{ level: { id: number; title: string; topics: any[] } }>();
</script>

<template>
  <section :class="`level level--${level.id}`">
    <h2>{{ level.title }}</h2>
    <ul>
      <TopicNode v-for="topic in level.topics" :key="topic.id" :topic="topic" />
    </ul>
  </section>
</template>
```

Create `apps/web/app/components/skill-tree/TopicNode.vue`:

```vue
<script setup lang="ts">
defineProps<{ topic: { id: string; title: string; estimatedMinutes: number; prerequisites: string[] } }>();
</script>

<template>
  <li :class="`topic ${topic.prerequisites.length > 0 ? 'topic--gated' : 'topic--open'}`">
    <NuxtLink :to="`/my-learning/topics/${topic.id}`">
      <h3>{{ topic.title }}</h3>
      <p>{{ topic.estimatedMinutes }} menit</p>
    </NuxtLink>
  </li>
</template>
```

- [ ] **Step 6: Verify SSR**

Run: `curl -fsS http://localhost/skill-tree | grep -E "Pohon Keterampilan|Level 1"`
Expected: both phrases in the first response.

- [ ] **Step 7: Run the Playwright MCP matrix**

Per AGENTS.md Web verification. Screenshots to `.playwright-mcp/phase-1-skill-tree-{viewport}-{scheme}.png`.

---

## Task 8: Wire the tutor endpoint to cite the lesson (Phase 1 acceptance gate)

**Files:**
- Read: `services/ai-api/v1/learning/` (the tutor pipeline)
- Modify: tutor response format to include `lessonId` citation per spec §5.2 Acceptance Gate

The spec requires: "tutor explanation streams from `ai-api` and cites the curriculum chunk by `lessonId`".

- [ ] **Step 1: Read the current tutor response format**

Run: `grep -rn "lessonId\|citation\|source" services/ai-api/v1/learning/ 2>/dev/null | head -10`
Expected: an existing tutor pipeline that retrieves by lessonId (per Phase 0 fix). The citation may not be in the response yet.

- [ ] **Step 2: Write the failing test**

Create `services/ai-api/v1/learning/__tests__/test_tutor_citation.py`:

```python
import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_tutor_response_includes_lesson_id_citation():
    res = client.post("/v1/chat/tutor", json={"userId": "u1", "lessonId": "l1-t01-accounting-equation", "query": "What is the accounting equation?"})
    assert res.status_code == 200
    body = res.json()
    assert "citations" in body
    assert any(c.get("lessonId") == "l1-t01-accounting-equation" for c in body["citations"])
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd services/ai-api && uv run pytest v1/learning/__tests__/test_tutor_citation.py -v`
Expected: FAIL — citations field absent or empty.

- [ ] **Step 4: Implement the citation in the tutor response**

Modify the tutor pipeline to include a `citations` array in the JSON response. Each citation: `{ lessonId, chunkId, score }`. The retrieval tool already filters by `lessonId`; the response just needs to surface the top-K retrieved items.

If the tutor is a streaming endpoint (SSE), the citation must be in the final `chunk_type: citations` event. Add a final event before the stream ends.

- [ ] **Step 5: Re-run the test**

Run: `cd services/ai-api && uv run pytest v1/learning/__tests__/test_tutor_citation.py -v`
Expected: PASS.

- [ ] **Step 6: Verify with curl**

Run: `curl -fsS -H "Authorization: Bearer <test-token>" -H "Content-Type: application/json" -d '{"userId":"u1","lessonId":"l1-t01-accounting-equation","query":"apa itu persamaan akuntansi?"}' http://localhost/ai/v1/chat/tutor | jq '.citations[0].lessonId'`
Expected: `"l1-t01-accounting-equation"`.

---

## Task 9: Phase 1 acceptance gates

**Files:**
- Modify: `docs/progress-tracker.md` (final Phase 1 block)

- [ ] **Step 1: Run the full backend test suite**

Run:
```
cd services/api && pnpm jest --silent && cd ../ai-api && uv run pytest -q
```
Expected: both exit 0; cumulative test count ≥ 60 (per spec T1 budget).

- [ ] **Step 2: Bring the dev stack up and verify all 6 Phase 1 acceptance gates**

Run:
```
docker compose up -d --build
docker compose ps
```

Gates:

1. `POST /sandbox/scenarios` (test the GET endpoint via the controller) — `curl -fsS -H "Authorization: Bearer <token>" http://localhost/api/v1/sandbox/scenarios | jq 'length'` returns ≥ 6.
2. `POST /sandbox/journal` validates `Debit = Credit` — `curl -fsS -X POST -H "Authorization: Bearer <token>" -H "Content-Type: application/json" -d '{"scenarioId":"s-buy-inventory-100","entries":[{"debitAccount":"Inventory","creditAccount":"Cash","amount":100}]}' http://localhost/api/v1/sandbox/journal` returns `{ "isBalanced": true, ... }`.
3. Landing-page placement diagnostic renders SSR with theme in first byte — `curl -fsS http://localhost/onboarding | head -50 | grep -E "Selamat Datang|theme-color|data-theme"` shows both.
4. Tutor explanation streams with `lessonId` citation — see Task 8 Step 6.
5. `prisma db seed` populates golden graph — `psql ... -c "select count(*) from \"Topic\" where id like 'l%-%';"` returns ≥ 60 (4 levels × 15+ topics).
6. Sandbox route behind login with `Authorization` check — `curl -i http://localhost/api/v1/sandbox/scenarios` returns 401 (no token).

- [ ] **Step 3: Run the Playwright MCP matrix for all touched pages**

Per AGENTS.md Web verification, run the matrix at all three viewports, both color schemes, `reducedMotion: reduce` once for each of:
- `/sandbox` and `/sandbox/<id>`
- `/onboarding` and `/onboarding/diagnostic`
- `/skill-tree`

Screenshots to `.playwright-mcp/phase-1-*.png`.

- [ ] **Step 4: Append the Phase 1 verification block to `docs/progress-tracker.md`**

```
## Phase 1 Verification (YYYY-MM-DD)

| Gate | Status | Evidence |
|---|---|---|
| GET /sandbox/scenarios returns >=6 | PASS / FAIL | curl output |
| POST /sandbox/journal validates Debit=Credit | PASS / FAIL | curl output |
| SSR /onboarding with theme in first byte | PASS / FAIL | curl output |
| Tutor response includes lessonId citation | PASS / FAIL | curl output |
| Golden graph seeded (>=60 topics) | PASS / FAIL | psql output |
| Sandbox route 401 without auth | PASS / FAIL | curl -i output |
| Playwright matrix green | PASS / FAIL | screenshot list |
| Cumulative test count >= 60 | PASS / FAIL | test output |
```

- [ ] **Step 5: Owner review checkpoint**

Per AGENTS.md, the executor does not commit. Pause here for owner to:
1. `git status` and review the diff.
2. Run `pnpm build` for both services and `docker compose -f docker-compose.prod.yml config -q` to verify prod compose is also valid.
4. Stage and commit at their discretion.
5. Mark Phase 1 as `DONE` in `docs/progress-tracker.md`.

---

## Out of Scope for Phase 1 (deferred to later phases)

- MasteryService, MisconceptionDetector, AdaptivePolicyService: **Phase 2**
- SkillTree XP / Achievement / StreakRule / Leaderboard (this phase seeds the *graph*; gamification hooks land in Phase 3)
- CreatorProfile, studio routes, Reviewer capability: **Phase 4**
- Wallet, Transaction, RevenueShare, Withdrawal, HoldWindow: **Phase 5**
- VirtualCompany simulator UI (this phase ships the *sandbox*; full simulator with multi-period closing is Phase 6)
- AgentRegistry, AgentTool, AgentMemory, DecisionTrace: **Phase 7**
- EventLog, MasterySnapshot, EngagementMetric, CreatorOutcomeMetric: **Phase 8**
- RateLimit, BackupRecord, expanded AuditLog, full runbook: **Phase 9**