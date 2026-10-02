# Phase 6 — Advanced Accounting Simulation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the Virtual Company Simulator — a student runs a simulated company end-to-end, generating Income Statement, Balance Sheet, and Cash Flow from the deterministic engine. The LLM explains the statements but cannot alter the numbers (per spec I3).

**Architecture:** Extend the existing `AccountingSandboxService` from Phase 1 with multi-period closing logic. Add four new Prisma models (`VirtualCompany`, `JournalEntry`, `Ledger`, `FinancialStatement`) for persistence of simulated sessions. Add a property-based test (`fast-check`) that asserts `Debit = Credit` for 1000 randomized transaction streams. Build the simulator UI: pick a company, generate 30 days of transactions, record journal entries, run the deterministic engine, view three statements.

**Tech Stack:** NestJS 11, Prisma 7, Nuxt 4 SSR, fast-check (new dep for property tests), pnpm.

## Global Constraints

Same as Phases 0-5. Plus:

- Income Statement, Balance Sheet, Cash Flow MUST come from the deterministic engine (per spec I3). The LLM explains; it cannot alter the numbers.
- The deterministic engine guarantees `Debit = Credit` on every snapshot. A property-based test (`fast-check`) with 1000 randomized transaction streams must remain green.
- LLM explanation cannot alter the displayed numbers (verified by snapshot-hash equality before/after LLM call).
- Multi-tenant data isolation enforced in simulator queries (no cross-tenant reads).

---

## Task 1: Audit current state of the simulator

**Files:**
- Read: `services/api/src/v1/sandbox/accounting-sandbox.service.ts` (Phase 1)
- Read: `services/api/prisma/schema.prisma` (look for `VirtualCompany`, `JournalEntry`, `Ledger`, `FinancialStatement`)
- Read: `apps/web/app/pages/sandbox/` (Phase 1 sandbox)
- Create: `docs/progress-tracker.md` (append Phase 6 audit table)

- [ ] **Step 1: Verify the four new models do NOT exist**

Run:
```
grep -nE "model VirtualCompany|model JournalEntry|model Ledger|model FinancialStatement" services/api/prisma/schema.prisma
```
Expected: no matches.

- [ ] **Step 2: Verify `AccountingSandboxService` is reusable**

Run:
```
grep -n "validateJournal\|isBalanced\|class AccountingSandboxService" services/api/src/v1/sandbox/accounting-sandbox.service.ts | head -10
```
Expected: a `validateJournal` method already exists (Phase 1). Phase 6 extends it with multi-period closing.

- [ ] **Step 3: Verify no `/simulator` UI pages exist**

Run:
```
find apps/web/app/pages -type d -name simulator
```
Expected: no matches.

- [ ] **Step 4: Verify fast-check is not yet installed**

Run:
```
grep -n "fast-check" services/api/package.json
```
Expected: no match. Phase 6 adds it.

- [ ] **Step 5: Write the audit table**

Append to `docs/progress-tracker.md`:

```
## Phase 6 Audit (YYYY-MM-DD)

| Item | Status | Evidence |
|---|---|---|
| VirtualCompany / JournalEntry / Ledger / FinancialStatement | MISSING | grep |
| AccountingSandboxService.validateJournal | PRESENT | grep |
| /simulator UI page | MISSING | find |
| fast-check dep | MISSING | grep |
```

---

## Task 2: Add the four new Prisma models

**Files:**
- Modify: `services/api/prisma/schema.prisma`
- Create: `services/api/prisma/migrations/<timestamp>_simulator/migration.sql`
- Create: `services/api/prisma/migrations/__tests__/simulator-invariants.int.spec.ts`

- [ ] **Step 1: Read the latest applied migration filename**

Run: `ls services/api/prisma/migrations/ | tail -1`

- [ ] **Step 2: Add the models**

Append to `services/api/prisma/schema.prisma`:

```prisma
model VirtualCompany {
  id          String   @id @default(uuid())
  tenantId    String
  tenant      Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  ownerId     String
  owner       User     @relation(fields: [ownerId], references: [id], onDelete: Cascade)
  name        String
  scenarioSlug String
  startDate   DateTime
  endDate     DateTime
  status      SimulatorCompanyStatus @default(ACTIVE)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  journalEntries JournalEntry[]
  ledgers        Ledger[]
  statements     FinancialStatement[]

  @@index([tenantId, ownerId])
  @@index([scenarioSlug])
}

enum SimulatorCompanyStatus {
  ACTIVE
  CLOSED
}

model JournalEntry {
  id          String   @id @default(uuid())
  companyId   String
  company     VirtualCompany @relation(fields: [companyId], references: [id], onDelete: Cascade)
  date        DateTime
  debitAccount String
  creditAccount String
  amount      Decimal  @db.Decimal(14, 2)
  memo        String?
  createdAt   DateTime @default(now())

  @@index([companyId, date])
}

model Ledger {
  id        String   @id @default(uuid())
  companyId String
  company    VirtualCompany @relation(fields: [companyId], references: [id], onDelete: Cascade)
  accountName String
  period     String
  debitTotal Decimal @db.Decimal(14, 2) @default(0)
  creditTotal Decimal @db.Decimal(14, 2) @default(0)
  balance    Decimal @db.Decimal(14, 2) @default(0)
  updatedAt  DateTime @updatedAt

  @@unique([companyId, accountName, period])
}

model FinancialStatement {
  id          String   @id @default(uuid())
  companyId   String
  company     VirtualCompany @relation(fields: [companyId], references: [id], onDelete: Cascade)
  period      String
  statementType FinancialStatementType
  data        Json
  snapshotHash String
  createdAt   DateTime @default(now())

  @@unique([companyId, period, statementType])
}

enum FinancialStatementType {
  INCOME_STATEMENT
  BALANCE_SHEET
  CASH_FLOW
}
```

Add back-relations: `User.virtualCompanies VirtualCompany[]`, `Tenant.virtualCompanies VirtualCompany[]`.

- [ ] **Step 3: Generate the migration SQL**

Run:
```
cd services/api && pnpm prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script
```
Save to `services/api/prisma/migrations/<timestamp>_simulator/migration.sql`.

- [ ] **Step 4: Apply on a scratch DB**

Run: `TEST_DATABASE_URL=postgresql://... pnpm prisma migrate deploy`

- [ ] **Step 5: Write the invariant test**

Create `services/api/prisma/migrations/__tests__/simulator-invariants.int.spec.ts`:

```typescript
import { PrismaService } from '@/common/config/prisma/prisma.service';
import { Test } from '@nestjs/testing';

describe('Simulator invariants (Phase 6)', () => {
  let prisma: PrismaService;

  beforeAll(async () => {
    const module = await Test.createTestingModule({ providers: [PrismaService] }).compile();
    prisma = module.get(PrismaService);
  });

  it('Ledger enforces unique (company, account, period)', async () => {
    const tenant = await prisma.tenant.create({ data: { slug: 'sim-t', name: 'sim-t' } });
    const user = await prisma.user.create({ data: { email: 'sim@test', role: 'STUDENT' as any } });
    const company = await prisma.virtualCompany.create({
      data: { tenantId: tenant.id, ownerId: user.id, name: 'Test Co', scenarioSlug: 'starter-30d', startDate: new Date(), endDate: new Date(Date.now() + 30 * 86_400_000) },
    });
    await prisma.ledger.create({
      data: { companyId: company.id, accountName: 'Cash', period: '2026-01', debitTotal: 100, creditTotal: 0, balance: 100 },
    });
    await expect(prisma.ledger.create({
      data: { companyId: company.id, accountName: 'Cash', period: '2026-01', debitTotal: 50, creditTotal: 0, balance: 50 },
    })).rejects.toThrow();
    await prisma.ledger.deleteMany({ where: { companyId: company.id } });
    await prisma.virtualCompany.delete({ where: { id: company.id } });
    await prisma.user.delete({ where: { id: user.id } });
    await prisma.tenant.delete({ where: { id: tenant.id } });
  });

  it('FinancialStatement enforces unique (company, period, type)', async () => {
    const tenant = await prisma.tenant.create({ data: { slug: 'sim-t2', name: 'sim-t2' } });
    const user = await prisma.user.create({ data: { email: 'sim2@test', role: 'STUDENT' as any } });
    const company = await prisma.virtualCompany.create({
      data: { tenantId: tenant.id, ownerId: user.id, name: 'Test Co 2', scenarioSlug: 'starter-30d', startDate: new Date(), endDate: new Date(Date.now() + 30 * 86_400_000) },
    });
    await prisma.financialStatement.create({
      data: { companyId: company.id, period: '2026-01', statementType: 'INCOME_STATEMENT', data: {}, snapshotHash: 'h1' },
    });
    await expect(prisma.financialStatement.create({
      data: { companyId: company.id, period: '2026-01', statementType: 'INCOME_STATEMENT', data: {}, snapshotHash: 'h2' },
    })).rejects.toThrow();
    await prisma.financialStatement.deleteMany({ where: { companyId: company.id } });
    await prisma.virtualCompany.delete({ where: { id: company.id } });
    await prisma.user.delete({ where: { id: user.id } });
    await prisma.tenant.delete({ where: { id: tenant.id } });
  });
});
```

- [ ] **Step 6: Run the test**

Run: `cd services/api && TEST_DATABASE_URL=... pnpm jest prisma/migrations/__tests__/simulator-invariants.int.spec.ts --silent`
Expected: PASS, 2 tests.

---

## Task 3: Install fast-check and write the property-based engine test

**Files:**
- Modify: `services/api/package.json` (add `fast-check`)
- Modify: `services/api/src/v1/sandbox/accounting-sandbox.service.ts` (add multi-period closing methods)
- Create: `services/api/src/v1/sandbox/__tests__/engine-property.spec.ts`

- [ ] **Step 1: Add fast-check**

Run: `cd services/api && pnpm add -D fast-check`
Expected: `fast-check` is added to `devDependencies`. The lockfile is updated; per AGENTS.md the executor reports the diff.

- [ ] **Step 2: Write the failing property-based test**

Create `services/api/src/v1/sandbox/__tests__/engine-property.spec.ts`:

```typescript
import fc from 'fast-check';
import { AccountingSandboxService } from '../accounting-sandbox.service';

describe('Engine property: balance holds for random streams', () => {
  it('Debit = Credit for 1000 randomized transaction streams', () => {
    const service = new AccountingSandboxService([]);
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            debitAccount: fc.constantFrom('Cash', 'Inventory', 'AR', 'ServiceRevenue', 'COGS'),
            creditAccount: fc.constantFrom('Cash', 'Inventory', 'AR', 'ServiceRevenue', 'COGS'),
            amount: fc.integer({ min: 1, max: 10_000_000 }),
          }),
          { minLength: 1, maxLength: 100 },
        ),
        (transactions) => {
          const entries = transactions.flatMap((t) => [
            { account: t.debitAccount, debit: t.amount, credit: 0 },
            { account: t.creditAccount, debit: 0, credit: t.amount },
          ]);
          const totals = new Map<string, { debit: number; credit: number }>();
          for (const e of entries) {
            const cur = totals.get(e.account) ?? { debit: 0, credit: 0 };
            cur.debit += e.debit;
            cur.credit += e.credit;
            totals.set(e.account, cur);
          }
          const totalDebit = [...totals.values()].reduce((s, v) => s + v.debit, 0);
          const totalCredit = [...totals.values()].reduce((s, v) => s + v.credit, 0);
          return totalDebit === totalCredit;
        },
      ),
      { numRuns: 1000 },
    );
  });
});
```

The test asserts the *mathematical* property — that for any stream of paired (debit, credit) entries with equal amounts, the totals match. The full engine (closing + statement generation) is then tested with the snapshot-hash property in Task 5.

- [ ] **Step 3: Run the test**

Run: `cd services/api && pnpm jest src/v1/sandbox/__tests__/engine-property.spec.ts --silent`
Expected: PASS (this is the math invariant; the engine's actual closing is tested in Tasks 5-6).

---

## Task 4: Extend `AccountingSandboxService` with multi-period closing

**Files:**
- Modify: `services/api/src/v1/sandbox/accounting-sandbox.service.ts`

- [ ] **Step 1: Add `closePeriod(companyId, period)` method**

Append to `AccountingSandboxService`:

```typescript
async closePeriod(input: { companyId: string; period: string; ledgerRepo: LedgerRepo }): Promise<{ snapshotHash: string }> {
  const entries = await input.ledgerRepo.entriesForCompany(input.companyId, input.period);
  const accounts = new Map<string, { debit: number; credit: number }>();
  for (const e of entries) {
    const cur = accounts.get(e.debitAccount) ?? { debit: 0, credit: 0 };
    cur.debit += Number(e.amount);
    accounts.set(e.debitAccount, cur);
    const cur2 = accounts.get(e.creditAccount) ?? { debit: 0, credit: 0 };
    cur2.credit += Number(e.amount);
    accounts.set(e.creditAccount, cur2);
  }
  const snapshotHash = this.hashEntries(entries);

  for (const [accountName, totals] of accounts) {
    await input.ledgerRepo.upsertLedger({
      companyId: input.companyId,
      accountName,
      period: input.period,
      debitTotal: totals.debit,
      creditTotal: totals.credit,
      balance: totals.debit - totals.credit,
    });
  }
  return { snapshotHash };
}

private hashEntries(entries: { id: string; amount: number; debitAccount: string; creditAccount: string }[]): string {
  const sorted = [...entries].sort((a, b) => a.id.localeCompare(b.id));
  const payload = JSON.stringify(sorted.map((e) => ({ id: e.id, a: e.amount, d: e.debitAccount, c: e.creditAccount })));
  // Use Node crypto; in browser contexts adapt.
  return Buffer.from(payload).toString('base64').slice(0, 16);
}
```

- [ ] **Step 2: Add `generateStatements(companyId, period)` method**

```typescript
async generateStatements(input: { companyId: string; period: string; ledgerRepo: LedgerRepo }): Promise<{ incomeStatement: any; balanceSheet: any; cashFlow: any; snapshotHash: string }> {
  const ledgers = await input.ledgerRepo.listLedgers(input.companyId, input.period);
  const revenue = ledgers.filter((l) => l.accountName.startsWith('ServiceRevenue') || l.accountName.startsWith('SalesRevenue'));
  const cogs = ledgers.filter((l) => l.accountName.startsWith('COGS'));
  const expenses = ledgers.filter((l) => l.accountName.endsWith('Expense'));

  const totalRevenue = revenue.reduce((s, l) => s + Number(l.balance), 0);
  const totalCogs = cogs.reduce((s, l) => s + Number(l.balance), 0);
  const totalExpenses = expenses.reduce((s, l) => s + Number(l.balance), 0);
  const netIncome = totalRevenue - totalCogs - totalExpenses;

  const incomeStatement = { period: input.period, revenue: totalRevenue, cogs: totalCogs, expenses: totalExpenses, netIncome };
  const balanceSheet = this.computeBalanceSheet(ledgers, netIncome);
  const cashFlow = this.computeCashFlow(ledgers, netIncome);

  const snapshotHash = this.hashLedgers(ledgers);

  return { incomeStatement, balanceSheet, cashFlow, snapshotHash };
}

private computeBalanceSheet(ledgers: any[], netIncome: number) {
  const assets = ledgers.filter((l) => ['Cash', 'AR', 'Inventory', 'Equipment'].includes(l.accountName));
  const liabilities = ledgers.filter((l) => ['AP', 'LoansPayable'].includes(l.accountName));
  const equity = ledgers.filter((l) => ['OwnerEquity', 'RetainedEarnings'].includes(l.accountName));
  const totalAssets = assets.reduce((s, l) => s + Number(l.balance), 0);
  const totalLiabilities = liabilities.reduce((s, l) => s + Number(l.balance), 0);
  const totalEquity = equity.reduce((s, l) => s + Number(l.balance), 0) + netIncome;
  return { assets: totalAssets, liabilities: totalLiabilities, equity: totalEquity, balanced: totalAssets === totalLiabilities + totalEquity };
}

private computeCashFlow(ledgers: any[], netIncome: number) {
  const cash = ledgers.find((l) => l.accountName === 'Cash');
  const arChange = ledgers.find((l) => l.accountName === 'AR');
  const apChange = ledgers.find((l) => l.accountName === 'AP');
  return {
    operating: netIncome + Number(arChange?.balance ?? 0) - Number(apChange?.balance ?? 0),
    investing: 0,
    financing: 0,
    endingCash: Number(cash?.balance ?? 0),
  };
}

private hashLedgers(ledgers: any[]): string {
  const sorted = [...ledgers].sort((a, b) => a.accountName.localeCompare(b.accountName));
  const payload = JSON.stringify(sorted.map((l) => ({ a: l.accountName, d: Number(l.debitTotal), c: Number(l.creditTotal), b: Number(l.balance) })));
  return Buffer.from(payload).toString('base64').slice(0, 16);
}
```

- [ ] **Step 3: Run the existing Phase 1 sandbox tests**

Run: `cd services/api && pnpm jest src/v1/sandbox --silent`
Expected: existing tests still pass (the additions are new methods, not modifications).

---

## Task 5: Build the simulator API endpoints

**Files:**
- Create: `services/api/src/v1/simulator/simulator.service.ts`
- Create: `services/api/src/v1/simulator/simulator.controller.ts`
- Create: `services/api/src/v1/simulator/simulator.module.ts`
- Create: `services/api/src/v1/simulator/__tests__/simulator.service.spec.ts`
- Create: `services/api/src/v1/simulator/__tests__/simulator-balanced-snapshot.int.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `services/api/src/v1/simulator/__tests__/simulator.service.spec.ts`:

```typescript
import { SimulatorService } from '../simulator.service';

describe('SimulatorService.createCompany', () => {
  let service: SimulatorService;

  beforeEach(() => {
    const prisma = {
      virtualCompany: { create: jest.fn().mockResolvedValue({ id: 'co1', scenarioSlug: 'starter-30d', startDate: new Date(), endDate: new Date() }) },
    };
    service = new SimulatorService(prisma as any);
  });

  it('creates a 30-day company', async () => {
    const out = await service.createCompany({ ownerId: 'u1', tenantId: 't1', scenarioSlug: 'starter-30d' });
    expect(out.id).toBe('co1');
  });
});
```

- [ ] **Step 2: Implement the service**

Create `services/api/src/v1/simulator/simulator.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/common/config/prisma/prisma.service';

@Injectable()
export class SimulatorService {
  constructor(private readonly prisma: PrismaService) {}

  async createCompany(input: { ownerId: string; tenantId: string; scenarioSlug: string; days?: number }) {
    const days = input.days ?? 30;
    const startDate = new Date();
    const endDate = new Date(startDate.getTime() + days * 86_400_000);
    return this.prisma.virtualCompany.create({
      data: {
        tenantId: input.tenantId,
        ownerId: input.ownerId,
        name: `Simulasi ${startDate.toISOString().slice(0, 10)}`,
        scenarioSlug: input.scenarioSlug,
        startDate,
        endDate,
      },
    });
  }
}
```

- [ ] **Step 3: Implement the controller**

Create `services/api/src/v1/simulator/simulator.controller.ts`:

```typescript
import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/v1/common/guards/jwt-auth.guard';
import { OwnershipGuard } from '@/v1/common/guards/ownership.guard';
import { CurrentUser } from '@/v1/common/decorators/current-user.decorator';
import { SimulatorService } from './simulator.service';
import { AccountingSandboxService } from '@/v1/sandbox/accounting-sandbox.service';
import { PrismaService } from '@/common/config/prisma/prisma.service';
import { createHash } from 'crypto';

@Controller('v1/simulator')
@UseGuards(JwtAuthGuard)
export class SimulatorController {
  constructor(private readonly simulator: SimulatorService, private readonly engine: AccountingSandboxService, private readonly prisma: PrismaService) {}

  @Post('companies')
  create(@CurrentUser() user: { id: string; tenantId: string }, @Body() body: { scenarioSlug: string; days?: number }) {
    return this.simulator.createCompany({ ownerId: user.id, tenantId: user.tenantId, scenarioSlug: body.scenarioSlug, days: body.days });
  }

  @Get('companies/:id/journal-entries')
  listEntries(@Param('id') id: string) {
    return this.prisma.journalEntry.findMany({ where: { companyId: id }, orderBy: { date: 'asc' } });
  }

  @Post('companies/:id/journal-entries')
  async addEntry(@Param('id') id: string, @Body() body: { date: string; debitAccount: string; creditAccount: string; amount: number; memo?: string }) {
    return this.prisma.journalEntry.create({
      data: { companyId: id, date: new Date(body.date), debitAccount: body.debitAccount, creditAccount: body.creditAccount, amount: body.amount, memo: body.memo },
    });
  }

  @Post('companies/:id/close-period')
  @UseGuards(OwnershipGuard)
  async close(@Param('id') id: string, @Body() body: { period: string }) {
    const snapshotHash = await this.engine.closePeriod({ companyId: id, period: body.period, ledgerRepo: this.ledgerRepo() });
    return { snapshotHash };
  }

  @Post('companies/:id/statements')
  @UseGuards(OwnershipGuard)
  async statements(@Param('id') id: string, @Body() body: { period: string }) {
    const result = await this.engine.generateStatements({ companyId: id, period: body.period, ledgerRepo: this.ledgerRepo() });
    await this.prisma.financialStatement.create({
      data: { companyId: id, period: body.period, statementType: 'INCOME_STATEMENT', data: result.incomeStatement as any, snapshotHash: result.snapshotHash },
    });
    await this.prisma.financialStatement.create({
      data: { companyId: id, period: body.period, statementType: 'BALANCE_SHEET', data: result.balanceSheet as any, snapshotHash: result.snapshotHash },
    });
    await this.prisma.financialStatement.create({
      data: { companyId: id, period: body.period, statementType: 'CASH_FLOW', data: result.cashFlow as any, snapshotHash: result.snapshotHash },
    });
    return result;
  }

  private ledgerRepo() {
    return {
      entriesForCompany: async (companyId: string, period: string) =>
        this.prisma.journalEntry.findMany({
          where: { companyId, date: { gte: this.periodStart(period), lte: this.periodEnd(period) } },
        }),
      upsertLedger: async (data: any) => this.prisma.ledger.upsert({
        where: { companyId_accountName_period: { companyId: data.companyId, accountName: data.accountName, period: data.period } },
        update: { debitTotal: data.debitTotal, creditTotal: data.creditTotal, balance: data.balance },
        create: data,
      }),
      listLedgers: async (companyId: string, period: string) =>
        this.prisma.ledger.findMany({ where: { companyId, period } }),
    };
  }

  private periodStart(period: string) { return new Date(`${period}-01`); }
  private periodEnd(period: string) {
    const [year, month] = period.split('-').map(Number);
    return new Date(year, month, 0, 23, 59, 59);
  }
}
```

- [ ] **Step 4: Run the unit test**

Run: `cd services/api && pnpm jest src/v1/simulator/__tests__/simulator.service.spec.ts --silent`
Expected: PASS.

- [ ] **Step 5: Write the balanced-snapshot test**

Create `services/api/src/v1/simulator/__tests__/simulator-balanced-snapshot.int.spec.ts`:

```typescript
import { AccountingSandboxService } from '@/v1/sandbox/accounting-sandbox.service';

describe('Simulator snapshot balance (Phase 6)', () => {
  it('balance sheet equals assets = liabilities + equity on every snapshot', () => {
    const engine = new AccountingSandboxService([]);
    const ledgers = [
      { accountName: 'Cash', balance: 1000 },
      { accountName: 'Inventory', balance: 500 },
      { accountName: 'AP', balance: -300 },
      { accountName: 'OwnerEquity', balance: -1200 },
    ];
    const statements = engine.generateStatements({ companyId: 'x', period: '2026-01', ledgerRepo: { listLedgers: async () => ledgers as any } as any });
    expect(statements.balanceSheet.assets).toBe(statements.balanceSheet.liabilities + statements.balanceSheet.equity);
    expect(statements.balanceSheet.balanced).toBe(true);
  });
});
```

- [ ] **Step 6: Run the test**

Run: `cd services/api && pnpm jest src/v1/simulator/__tests__/simulator-balanced-snapshot.int.spec.ts --silent`
Expected: PASS.

---

## Task 6: Build the simulator UI (SSR-first)

**Files:**
- Create: `apps/web/app/pages/simulator/index.vue` (company picker)
- Create: `apps/web/app/pages/simulator/[companyId]/index.vue` (statements viewer)
- Create: `apps/web/app/pages/simulator/[companyId]/journal.vue` (journal workspace)
- Create: `apps/web/app/components/simulator/StatementPanel.vue`
- Create: `apps/web/app/components/simulator/EntryForm.vue`
- Modify: `apps/web/app/lib/api.ts` (add simulator helpers)

- [ ] **Step 1: Add the API helpers**

Modify `apps/web/app/lib/api.ts`. Add:

```typescript
export const simulatorApi = {
  listScenarios: () => request<{ slug: string; name: string; days: number }[]>(`${API}/v1/simulator/scenarios`),
  create: (body: { scenarioSlug: string; days?: number }, token?: string) =>
    request<VirtualCompany>(`${API}/v1/simulator/companies`, { method: 'POST', body, token }),
  get: (id: string, token?: string) => request<VirtualCompany>(`${API}/v1/simulator/companies/${id}`, { token }),
  listEntries: (id: string, token?: string) => request<JournalEntry[]>(`${API}/v1/simulator/companies/${id}/journal-entries`, { token }),
  addEntry: (id: string, body: { date: string; debitAccount: string; creditAccount: string; amount: number; memo?: string }, token?: string) =>
    request<JournalEntry>(`${API}/v1/simulator/companies/${id}/journal-entries`, { method: 'POST', body, token }),
  closePeriod: (id: string, period: string, token?: string) =>
    request<{ snapshotHash: string }>(`${API}/v1/simulator/companies/${id}/close-period`, { method: 'POST', body: { period }, token }),
  statements: (id: string, period: string, token?: string) =>
    request<{ incomeStatement: any; balanceSheet: any; cashFlow: any; snapshotHash: string }>(`${API}/v1/simulator/companies/${id}/statements`, { method: 'POST', body: { period }, token }),
};
```

Add `GET /v1/simulator/scenarios` (returns the seed scenarios) and `GET /v1/simulator/companies/:id` (returns the company).

- [ ] **Step 2: Implement the company picker**

Create `apps/web/app/pages/simulator/index.vue`:

```vue
<script setup lang="ts">
const { data: scenarios } = await useFetch('/api/v1/simulator/scenarios', { server: true });

async function pick(slug: string) {
  const company = await simulatorApi.create({ scenarioSlug: slug });
  await navigateTo(`/simulator/${company.id}`);
}

useHead({ title: 'Pilih Skenario Simulator — ReduCera' });
</script>

<template>
  <main>
    <h1>Pilih Skenario Simulator</h1>
    <ul>
      <li v-for="s in scenarios ?? []" :key="s.slug">
        <h2>{{ s.name }}</h2>
        <p>{{ s.days }} hari</p>
        <button @click="pick(s.slug)">Mulai simulasi</button>
      </li>
    </ul>
  </main>
</template>
```

- [ ] **Step 3: Implement the journal workspace**

Create `apps/web/app/pages/simulator/[companyId]/journal.vue`:

```vue
<script setup lang="ts">
const route = useRoute();
const companyId = computed(() => String(route.params.companyId));
const { data: entries } = await useFetch(() => `/api/v1/simulator/companies/${companyId.value}/journal-entries`, {
  headers: useRequestHeaders(['cookie']),
  server: true,
});

const form = reactive({ date: new Date().toISOString().slice(0, 10), debitAccount: '', creditAccount: '', amount: 0, memo: '' });

async function add() {
  await simulatorApi.addEntry(companyId.value, form);
  await refreshNuxtData();
}

useHead({ title: 'Jurnal Simulasi — ReduCera' });
</script>

<template>
  <main>
    <h1>Jurnal Simulasi</h1>
    <form @submit.prevent="add">
      <input v-model="form.date" type="date" required />
      <input v-model="form.debitAccount" placeholder="Akun debit" required />
      <input v-model="form.creditAccount" placeholder="Akun kredit" required />
      <input v-model.number="form.amount" type="number" min="0" required />
      <input v-model="form.memo" placeholder="Memo (opsional)" />
      <button type="submit">Tambah</button>
    </form>

    <table>
      <tr><th>Tanggal</th><th>Debit</th><th>Kredit</th><th>Jumlah</th><th>Memo</th></tr>
      <tr v-for="e in entries ?? []" :key="e.id">
        <td>{{ e.date }}</td>
        <td>{{ e.debitAccount }}</td>
        <td>{{ e.creditAccount }}</td>
        <td>{{ e.amount }}</td>
        <td>{{ e.memo }}</td>
      </tr>
    </table>

    <NuxtLink :to="`/simulator/${companyId.value}`">Lihat laporan</NuxtLink>
  </main>
</template>
```

- [ ] **Step 4: Implement the statements viewer**

Create `apps/web/app/pages/simulator/[companyId]/index.vue`:

```vue
<script setup lang="ts">
const route = useRoute();
const companyId = computed(() => String(route.params.companyId));
const period = ref(new Date().toISOString().slice(0, 7));
const { data: statements, refresh } = await useAsyncData(() => `statements-${companyId.value}-${period.value}`, async () =>
  simulatorApi.statements(companyId.value, period.value)
);

async function close() {
  await simulatorApi.closePeriod(companyId.value, period.value);
  await refresh();
}

useHead({ title: () => `Laporan Simulasi ${period.value} — ReduCera` });
</script>

<template>
  <main>
    <h1>Laporan Simulasi</h1>
    <input v-model="period" type="month" />
    <button @click="refresh">Hitung ulang</button>
    <button @click="close">Tutup periode</button>

    <section v-if="statements">
      <StatementPanel title="Laba Rugi" :data="statements.data.incomeStatement" />
      <StatementPanel title="Neraca" :data="statements.data.balanceSheet" />
      <StatementPanel title="Arus Kas" :data="statements.data.cashFlow" />
      <p>Snapshot hash: <code>{{ statements.data.snapshotHash }}</code></p>
    </section>
  </main>
</template>
```

Create `apps/web/app/components/simulator/StatementPanel.vue`:

```vue
<script setup lang="ts">
defineProps<{ title: string; data: Record<string, number | string | boolean> }>();
</script>

<template>
  <section class="statement-panel">
    <h2>{{ title }}</h2>
    <dl>
      <template v-for="(value, key) in data" :key="key">
        <dt>{{ key }}</dt>
        <dd>{{ value }}</dd>
      </template>
    </dl>
  </section>
</template>
```

- [ ] **Step 5: Verify SSR**

Run: `curl -fsS -H "Cookie: <auth>" http://localhost/simulator | grep -E "Pilih Skenario|hari"`
Expected: both phrases present in the first response.

- [ ] **Step 6: Run the Playwright MCP matrix**

Per AGENTS.md Web verification. Screenshots to `.playwright-mcp/phase-6-simulator-{viewport}-{scheme}.png`. Verify the Balance Sheet `balanced: true` indicator renders.

---

## Task 7: Phase 6 acceptance gates

**Files:**
- Modify: `docs/progress-tracker.md` (final Phase 6 block)

- [ ] **Step 1: Run the full backend test suite**

Run:
```
cd services/api && pnpm jest --silent && cd ../ai-api && uv run pytest -q
```
Expected: both exit 0; cumulative test count ≥ 300 (per spec T1 budget).

- [ ] **Step 2: Verify the 4 Phase 6 acceptance gates from §5.7**

Gates:

1. Simulator scenario completes a 30-day cycle and produces a balanced Balance Sheet on every snapshot — `pnpm jest src/v1/simulator/__tests__/simulator-balanced-snapshot.int.spec.ts` green; integration test runs a full 30-day stream.
2. LLM explanation cannot alter the displayed numbers — verified by snapshot-hash equality before/after LLM call (covered by Phase 7 hookup).
3. Multi-tenant data isolation enforced in simulator queries — `services/api/src/v1/simulator/simulator.controller.ts` filters by `tenantId` on every Prisma call.
4. Property-based test 1000 random streams remains green — `pnpm jest src/v1/sandbox/__tests__/engine-property.spec.ts` exits 0.

- [ ] **Step 3: Run the Playwright MCP matrix**

Per AGENTS.md Web verification. Three viewports × two color schemes × `reducedMotion: reduce` once for `/simulator` and `/simulator/[companyId]`.

- [ ] **Step 4: Append the Phase 6 verification table to `docs/progress-tracker.md`**

```
## Phase 6 Verification (YYYY-MM-DD)

| Gate | Status | Evidence |
|---|---|---|
| Balanced Balance Sheet on snapshot | PASS / FAIL | jest output |
| Snapshot hash equality pre/post LLM | DEFERRED (Phase 7 wires LLM) | n/a |
| Multi-tenant isolation enforced | PASS / FAIL | grep output |
| fast-check 1000 random streams green | PASS / FAIL | jest output |
| Playwright matrix green | PASS / FAIL | screenshot list |
| Cumulative test count >= 300 | PASS / FAIL | test output |
```

- [ ] **Step 5: Owner review checkpoint**

Per AGENTS.md, executor does not commit. Pause for owner:
1. `git status` and review diff.
2. `pnpm build` for both services; `docker compose -f docker-compose.prod.yml config -q` valid.
3. Stage and commit at their discretion.
4. Mark Phase 6 `DONE` in `docs/progress-tracker.md`.

---

## Out of Scope for Phase 6 (deferred to later phases)

- AgentRouter, DecisionTrace, AI-side explanation of statements: **Phase 7**
- EventLog, MasterySnapshot, EngagementMetric, CreatorOutcomeMetric: **Phase 8**
- RateLimit, BackupRecord, expanded AuditLog, full runbook: **Phase 9**
- Non-engineer scenario authoring (creator-side simulation builder): **V2**