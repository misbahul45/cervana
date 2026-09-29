# Accounting Sandbox

> **Status**: `planned` · **Owner**: `accounting-architect` · **Last reviewed**: `2026-09-30`
>
> A deterministic accounting practice environment for accounting learning and AI agent testing. Completely isolated from the platform's real commerce ledger.

---

## 1. Purpose

The Accounting Sandbox is a **learning tool**. It is **not** the platform's actual financial system. It is a safe, deterministic environment for:

- Learning accounting mechanics.
- Practicing journal entries.
- Verifying debit/credit integrity.
- Testing AI agents against synthetic accounting scenarios.

It is intentionally separated from the Platform Commerce Ledger by **hard data boundaries** — no cross-table references, no shared accounts.

---

## 2. Hard invariants

```
TOTAL DEBITS = TOTAL CREDITS  (per posted journal entry)
```

This is enforced by deterministic code, **never** by an LLM.

Other invariants:

- A `SandboxAccount` cannot be deleted if it has `LedgerEntry` rows.
- A `SandboxTransaction` cannot be posted if any line is unbalanced.
- A `SandboxPeriod` that is `CLOSED` rejects new transactions.
- A `SandboxJournalEntry` that is `POSTED` cannot be edited — must be reversed.
- A reversal must reference the original entry and re-balance.

---

## 3. Two ledgers, never mixed

### 3.1 Platform Commerce Ledger (real money)

```
Wallet
Payout
Order
Payment
Stripe webhook
CreatorEarning
Refund
```

Tracks real IDR (or other currency). Authoritative.

### 3.2 Sandbox Accounting Ledger (synthetic)

```
SandboxAccount       (chart of accounts)
SandboxTransaction   (a business event)
JournalEntry
JournalLine
LedgerEntry
TrialBalance
SandboxPeriod        (accounting period)
AdjustingEntry
FinancialStatement
Scenario             (the test scenario)
SandboxAttempt       (a learner's practice attempt)
```

Tracks **synthetic** values in a separate currency code (e.g., `SANDBOX_IDR`). These are clearly labeled `simulation_only = true`.

**Hard rule**: a sandbox row must never reference a real row. There is no foreign key between the two ledgers. No migration script ever touches both in one transaction.

---

## 4. Domain model

```prisma
model ChartOfAccounts {
  id              String   @id @default(uuid())
  standardProfile AccountingStandardProfile  // GENERAL, IFRS, LOCAL_CURRICULUM, COURSE_SPECIFIC
  ownerId         String                       // Tutor / Creator
  description    String?
  createdAt       DateTime @default(now())
  accounts        SandboxAccount[]
  @@unique([standardProfile, ownerId])
}

model SandboxAccount {
  id              String   @id @default(uuid())
  chartId         String
  chart           ChartOfAccounts @relation(fields: [chartId], references: [id], onDelete: Cascade)
  code            String
  name            String
  type            AccountType                      // ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE
  isActive        Boolean  @default(true)
  description     String?
  ledger          LedgerEntry[]
  @@unique([chartId, code])
  @@index([chartId, type])
}

model SandboxPeriod {
  id          String   @id @default(uuid())
  chartId     String
  startDate   DateTime
  endDate     DateTime
  status      PeriodStatus                         // OPEN / CLOSING / CLOSED
  chart       ChartOfAccounts @relation(fields: [chartId], references: [id])
  @@unique([chartId, startDate])
}

model SandboxScenario {
  id              String   @id @default(uuid())
  standardProfile AccountingStandardProfile
  ownerId         String
  title           String
  description     String?
  difficulty      Float
  stepsJson       Json                              // ordered business transactions
  expectedOutcome Json                              // for evaluation
  createdAt       DateTime @default(now())
  attempts        SandboxAttempt[]
}

model SandboxTransaction {
  id              String   @id @default(uuid())
  periodId        String
  period          SandboxPeriod @relation(fields: [periodId], references: [id])
  scenarioId      String?
  scenario        SandboxScenario? @relation(fields: [scenarioId], references: [id])
  description     String
  amount          Decimal  @db.Decimal(18, 4)
  status          TxStatus                          // DRAFT / POSTED / REVERSED / VOID
  postedAt        DateTime?
  journalEntry    JournalEntry?
  attempts        SandboxAttempt[]
}

model JournalEntry {
  id              String   @id @default(uuid())
  transactionId   String
  transaction     SandboxTransaction @relation(fields: [transactionId], references: [id], onDelete: Cascade)
  description     String
  status          JournalStatus                     // DRAFT / VALIDATED / POSTED / REVERSED
  postedAt        DateTime?
  reversedById    String?
  reversedBy      JournalEntry? @relation("Reversal", fields: [reversedById], references: [id])
  reversesId      String?
  reverses        JournalEntry? @relation("Reversal", fields: [reversesId], references: [id])
  lines           JournalLine[]
  @@unique([transactionId])
}

model JournalLine {
  id              String   @id @default(uuid())
  journalEntryId  String
  journalEntry    JournalEntry @relation(fields: [journalEntryId], references: [id], onDelete: Cascade)
  accountId       String
  account         SandboxAccount @relation(fields: [accountId], references: [id])
  direction       Direction                          // DEBIT / CREDIT
  amount          Decimal  @db.Decimal(18, 4)
  @@index([journalEntryId])
}

model LedgerEntry {
  id          String   @id @default(uuid())
  accountId   String
  account     SandboxAccount @relation(fields: [accountId], references: [id])
  journalEntryId String
  journalEntry JournalEntry @relation(fields: [journalEntryId], references: [id])
  postedAt    DateTime
  direction   Direction
  amount      Decimal @db.Decimal(18, 4)
  periodId    String
  @@index([accountId, postedAt])
}

model AdjustingEntry {
  id              String   @id @default(uuid())
  journalEntryId  String
  journalEntry    JournalEntry @relation(fields: [journalEntryId], references: [id])
  reason          String  // ACCRUAL, DEFERRAL, DEPRECIATION, etc.
  createdAt       DateTime @default(now())
}

model SandboxAttempt {
  id              String   @id @default(uuid())
  userId          String
  user            User @relation(fields: [userId], references: [id], onDelete: Cascade)
  scenarioId      String
  scenario        SandboxScenario @relation(fields: [scenarioId], references: [id])
  startedAt       DateTime
  completedAt     DateTime?
  score           Float?
  transactionIds  Json
  feedback        String?
  learningEventId String?
  @@index([userId, completedAt])
}
```

### 4.1 Enums

```prisma
enum AccountingStandardProfile {
  GENERAL
  IFRS
  LOCAL_CURRICULUM
  COURSE_SPECIFIC
}

enum AccountType {
  ASSET
  LIABILITY
  EQUITY
  REVENUE
  EXPENSE
  CONTRA_ASSET
  CONTRA_LIABILITY
  CONTRA_EQUITY
  CONTRA_REVENUE
  CONTRA_EXPENSE
}

enum PeriodStatus {
  OPEN
  CLOSING
  CLOSED
}

enum TxStatus {
  DRAFT
  POSTED
  REVERSED
  VOID
}

enum JournalStatus {
  DRAFT
  VALIDATED
  POSTED
  REVERSED
}

enum Direction {
  DEBIT
  CREDIT
}
```

---

## 5. The deterministic accounting engine

This is **not** an AI capability. It is a pure function in the `api` service.

```typescript
@Injectable()
export class AccountingEngineService {
  validateAndPost(transaction: SandboxTransaction): JournalEntry {
    // 1. Ensure debits == credits
    // 2. Ensure all accounts exist and are active
    // 3. Ensure period is OPEN
    // 4. Validate account-type rules (e.g., asset increases with debit)
    // 5. Generate LedgerEntry rows
    // 6. Mark transaction POSTED
    // 7. Mark journal entry POSTED
    // 8. Atomic in a single Prisma $transaction
  }

  computeTrialBalance(periodId: string): TrialBalanceReport {
    // Pure aggregation over LedgerEntry
  }

  computeFinancialStatements(periodId: string): FinancialStatements {
    // Income Statement + Balance Sheet from TrialBalance
  }
}
```

All errors are deterministic and well-typed:

```typescript
type AccountingError =
  | { code: 'UNBALANCED', debit: Decimal, credit: Decimal }
  | { code: 'INVALID_ACCOUNT', accountId: string }
  | { code: 'PERIOD_CLOSED', periodId: string }
  | { code: 'ACCOUNT_TYPE_VIOLATION', accountId: string, rule: string }
  | { code: 'CANNOT_EDIT_POSTED', journalEntryId: string };
```

---

## 6. AI agent integration

The AI can **propose** a journal entry via `AIAgentProduct`. The agent submits `JournalEntry` in `DRAFT` status. The `AccountingEngineService` then validates and posts.

```
AIAgent (in sandbox)
    ↓
POST /v1/accounting/sandbox/:id/entries/draft
   (returns DRAFT JournalEntry)
    ↓
Agent calls /validate → engine checks balance, accounts, period
    ↓ (if valid)
Agent calls /post → engine posts atomically
    ↓
Returns structured result: { status: 'POSTED', ledgerEntries: [...] }
```

The agent never posts directly. The engine is the only writer.

---

## 7. Sandbox modes

| Mode | Description |
|---|---|
| LEARN | High guidance. AI hints and step-by-step. |
| PRACTICE | Moderate guidance. AI explains after learner attempt. |
| CHALLENGE | Low guidance. AI only comments after completion. |
| EXAM | Minimal guidance. Timer. Strict grading. |
| AGENT_TEST | Run an AI agent against a scenario; report accuracy. |

---

## 8. Educational alignment

Per ISO 21001:2025, every scenario declares:

- Learning outcomes.
- Prerequisite accounting concepts.
- Standards profile (`GENERAL` / `IFRS` / `LOCAL_CURRICULUM` / `COURSE_SPECIFIC`).
- Difficulty (0..1).
- Expected outcome (for AI agent testing).

The sandbox is **educational**, not professional accounting compliance. Scenarios carry a clear disclaimer: "simulation only; not professional accounting advice".

---

## 9. Cross-references

- Circular economy model: [`circular-economy-model.md`](./circular-economy-model.md)
- Service responsibility: [`service-responsibility-matrix.md`](./service-responsibility-matrix.md) §3.1, §3.2
- AI agent marketplace: [`ai-agent-marketplace.md`](./ai-agent-marketplace.md)
- Master prompt §12–17
- Data model: [`data-model.md`](./data-model.md)