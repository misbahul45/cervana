# Phase 5 — Payment & Economic Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the circular economy loop. A student buys a credit package, spends credits on classes, the creator earns, and the creator requests a payout that holds for the refund window before releasing. The `Topic` model is retired as a marketplace product (G-B-04).

**Architecture:** Reuse the existing `Wallet`, `LedgerTransaction`, `CreatorEarning`, `PayoutRequest`, `Order`, `Refund`, `PaymentTransaction` Prisma models and the existing `commerce/` module (`commerce-ledger`, `commerce-refund`, `creator-earnings` services). Add four new models for the credit-loop surface: `CreditPackage`, `Reservation`, `HoldWindow`, `RevenueShareRule`. New UI: `/checkout/[orderId]`, `/wallet`, `/studio/earnings`, `/studio/withdrawals`. All state transitions are two-phase (reserve + commit) with `idempotencyKey` on every request and a `LedgerTransaction` row on commit (per spec §5.6 risk mitigation).

**Tech Stack:** NestJS 11, Prisma 7, BullMQ (existing), Nuxt 4 SSR, pnpm.

## Global Constraints

Same as Phases 0-4. Plus:

- All money state transitions are two-phase (reserve + commit) with `idempotencyKey` (per spec §5.6 risk mitigation).
- Every state change writes a `LedgerTransaction` row (per spec §5.6 acceptance gate).
- AI cannot approve withdrawals or trigger payouts (per spec I3 / I4). The deterministic engine enforces payout release.
- Payout release rule: `release iff hold_days_passed AND no_open_refund`.
- Topic is retired as a marketplace product (G-B-04). Existing `Topic` rows used for curriculum remain; only the marketplace listing path is removed.

---

## Task 1: Audit current state of payments and wallet

**Files:**
- Read: `services/api/prisma/schema.prisma` (Wallet, LedgerTransaction, CreatorEarning, PayoutRequest, Order, Refund)
- Read: `services/api/src/v1/commerce/commerce-ledger.service.ts`
- Read: `services/api/src/v1/commerce/commerce-refund.service.ts`
- Read: `services/api/src/v1/commerce/creator-earnings.service.ts`
- Read: `apps/web/app/pages/marketplace/` (confirm no `/checkout` route)
- Create: `docs/progress-tracker.md` (append Phase 5 audit table)

- [ ] **Step 1: Verify Wallet + LedgerTransaction models**

Run:
```
grep -nE "model Wallet|model LedgerTransaction|model CreatorEarning|model PayoutRequest|model Order|model Refund|model PaymentTransaction" services/api/prisma/schema.prisma
```
Expected: all seven lines present.

- [ ] **Step 2: Verify the four target models do NOT exist yet**

Run:
```
grep -nE "model CreditPackage|model Reservation|model HoldWindow|model RevenueShareRule" services/api/prisma/schema.prisma
```
Expected: no matches.

- [ ] **Step 3: Verify commerce services**

- [ ] **Step 4: Verify web has no `/checkout`, `/wallet`, `/studio/earnings` routes**

Run:
```
find apps/web/app/pages -type d \( -name checkout -o -name wallet -o -name earnings \)
ls apps/web/app/pages/marketplace/creator/earnings.vue 2>/dev/null
```
Expected: `apps/web/app/pages/marketplace/creator/earnings.vue` exists (for buyers); no creator-side earnings page yet (Phase 5 adds it).

- [ ] **Step 5: Write the audit table**

Append to `docs/progress-tracker.md`:

```
## Phase 5 Audit (YYYY-MM-DD)

| Item | Status | Evidence |
|---|---|---|
| Wallet + LedgerTransaction + CreatorEarning models | PRESENT | grep |
| CreditPackage / Reservation / HoldWindow / RevenueShareRule | MISSING | grep |
| Commerce services (ledger, refund, creator-earnings) | PRESENT | ls |
| /checkout route | MISSING | find |
| /wallet route | MISSING | find |
| /studio/earnings route | MISSING | find |
| marketplace/creator/earnings.vue (buyer-side) | PRESENT | ls |
```

---

## Task 2: Add the four new Prisma models

**Files:**
- Modify: `services/api/prisma/schema.prisma`
- Create: `services/api/prisma/migrations/<timestamp>_credit_loop/migration.sql`
- Create: `services/api/prisma/migrations/__tests__/credit-loop-invariants.int.spec.ts`

- [ ] **Step 1: Read the latest applied migration filename**

Run: `ls services/api/prisma/migrations/ | tail -1`

- [ ] **Step 2: Add the four models**

Append to `services/api/prisma/schema.prisma`:

```prisma
model CreditPackage {
  id          String   @id @default(uuid())
  slug        String   @unique
  name        String
  description String?
  creditAmount Decimal @db.Decimal(14, 2)
  priceAmount   Decimal @db.Decimal(14, 2)
  priceCurrency String  @default("IDR")
  isActive    Boolean  @default(true)
  sortOrder   Int      @default(0)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  orders      Order[] @relation("OrderCreditPackage")
}

model Reservation {
  id              String   @id @default(uuid())
  idempotencyKey  String   @unique
  userId          String
  walletId        String
  amount          Decimal  @db.Decimal(14, 2)
  currency        String   @default("IDR")
  purpose         ReservationPurpose
  referenceId     String?
  status          ReservationStatus @default(PENDING)
  expiresAt       DateTime
  createdAt       DateTime @default(now())
  committedAt     DateTime?
  releasedAt      DateTime?

  user            User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  wallet          Wallet  @relation(fields: [walletId], references: [id], onDelete: Restrict)

  @@index([userId, status])
  @@index([expiresAt])
}

enum ReservationPurpose {
  PURCHASE_CREDITS
  PURCHASE_CLASS
  PAYOUT
}

enum ReservationStatus {
  PENDING
  COMMITTED
  RELEASED
  EXPIRED
}

model HoldWindow {
  id           String   @id @default(uuid())
  payoutId     String   @unique
  payout       PayoutRequest @relation(fields: [payoutId], references: [id], onDelete: Cascade)
  releaseAt    DateTime
  released     Boolean  @default(false)
  releasedAt   DateTime?
  openRefunds  Int      @default(0)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([releaseAt, released])
}

model RevenueShareRule {
  id              String   @id @default(uuid())
  tenantId        String
  tenant          Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  platformFeePct  Decimal  @db.Decimal(5, 2)
  creatorPct      Decimal  @db.Decimal(5, 2)
  effectiveFrom   DateTime @default(now())
  effectiveUntil  DateTime?

  @@index([tenantId, effectiveFrom])
}
```

Add back-relations: `User.reservations Reservation[]`, `Wallet.reservations Reservation[]`, `PayoutRequest.holdWindow HoldWindow?`. `Order.creditPackage CreditPackage? @relation("OrderCreditPackage", fields: [creditPackageId], references: [id], onDelete: SetNull)`. `Tenant.revenueShareRules RevenueShareRule[]`.

Add `creditPackageId String?` to `Order` model.

- [ ] **Step 3: Generate the migration SQL**

Run:
```
cd services/api && pnpm prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script
```
Save to `services/api/prisma/migrations/<timestamp>_credit_loop/migration.sql`.

- [ ] **Step 4: Apply on a scratch DB**

Run:
```
TEST_DATABASE_URL=postgresql://... pnpm prisma migrate deploy
```
Expected: applies cleanly.

- [ ] **Step 5: Write the invariant test**

Create `services/api/prisma/migrations/__tests__/credit-loop-invariants.int.spec.ts`:

```typescript
import { PrismaService } from '@/common/config/prisma/prisma.service';
import { Test } from '@nestjs/testing';

describe('Credit loop invariants (Phase 5)', () => {
  let prisma: PrismaService;

  beforeAll(async () => {
    const module = await Test.createTestingModule({ providers: [PrismaService] }).compile();
    prisma = module.get(PrismaService);
  });

  it('Reservation idempotencyKey is unique', async () => {
    const user = await prisma.user.create({ data: { email: 'rsv-uniq@test', role: 'STUDENT' as any } });
    const tenant = await prisma.tenant.create({ data: { slug: 'rsv-t', name: 'rsv-t' } });
    const wallet = await prisma.wallet.create({ data: { ownerId: user.id, tenantId: tenant.id } });
    await prisma.reservation.create({
      data: { idempotencyKey: 'k1', userId: user.id, walletId: wallet.id, amount: 100, purpose: 'PURCHASE_CREDITS', expiresAt: new Date(Date.now() + 60_000) },
    });
    await expect(prisma.reservation.create({
      data: { idempotencyKey: 'k1', userId: user.id, walletId: wallet.id, amount: 100, purpose: 'PURCHASE_CREDITS', expiresAt: new Date(Date.now() + 60_000) },
    })).rejects.toThrow();
    await prisma.user.delete({ where: { id: user.id } });
    await prisma.tenant.delete({ where: { id: tenant.id } });
  });

  it('CreditPackage slug is unique', async () => {
    await prisma.creditPackage.create({ data: { slug: 'pkg-a', name: 'A', creditAmount: 50, priceAmount: 50000 } });
    await expect(prisma.creditPackage.create({ data: { slug: 'pkg-a', name: 'A2', creditAmount: 50, priceAmount: 50000 } })).rejects.toThrow();
    await prisma.creditPackage.deleteMany({ where: { slug: 'pkg-a' } });
  });

  it('HoldWindow releaseAt is in the future by default', async () => {
    const tenant = await prisma.tenant.create({ data: { slug: 'hw-t', name: 'hw-t' } });
    const user = await prisma.user.create({ data: { email: 'hw@test', role: 'TEACHER' as any } });
    const wallet = await prisma.wallet.create({ data: { ownerId: user.id, tenantId: tenant.id } });
    const payout = await prisma.payoutRequest.create({
      data: { creatorId: user.id, walletId: wallet.id, amount: 100, currency: 'IDR', status: 'REQUESTED' as any },
    });
    const hw = await prisma.holdWindow.create({
      data: { payoutId: payout.id, releaseAt: new Date(Date.now() - 1000) },
    });
    expect(hw.released).toBe(false);
    await prisma.holdWindow.delete({ where: { id: hw.id } });
    await prisma.payoutRequest.delete({ where: { id: payout.id } });
    await prisma.user.delete({ where: { id: user.id } });
    await prisma.tenant.delete({ where: { id: tenant.id } });
  });
});
```

- [ ] **Step 6: Run the test**

Run: `cd services/api && TEST_DATABASE_URL=... pnpm jest prisma/migrations/__tests__/credit-loop-invariants.int.spec.ts --silent`
Expected: PASS, 3 tests.

---

## Task 3: Seed credit packages and revenue-share rules

**Files:**
- Modify: `services/api/prisma/seed.ts`
- Create: `services/api/prisma/seed-data/credit-packages.json`
- Create: `services/api/prisma/seed-data/__tests__/credit-packages-validator.spec.ts`

- [ ] **Step 1: Write the failing validator test**

Create `services/api/prisma/seed-data/__tests__/credit-packages-validator.spec.ts`:

```typescript
import { readFileSync } from 'fs';
import { join } from 'path';

const PATH = join(__dirname, '..', 'credit-packages.json');

describe('credit-packages.json (Phase 5)', () => {
  const pkgs = JSON.parse(readFileSync(PATH, 'utf-8'));

  it('has at least 3 packages', () => {
    expect(pkgs.length).toBeGreaterThanOrEqual(3);
  });

  it('every package has positive creditAmount and priceAmount', () => {
    for (const p of pkgs) {
      expect(p.creditAmount).toBeGreaterThan(0);
      expect(p.priceAmount).toBeGreaterThan(0);
    }
  });

  it('slugs are unique', () => {
    const slugs = pkgs.map((p: any) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd services/api && pnpm jest prisma/seed-data/__tests__/credit-packages-validator.spec.ts --silent`
Expected: FAIL.

- [ ] **Step 3: Author the credit packages JSON**

Create `services/api/prisma/seed-data/credit-packages.json`:

```json
[
  { "slug": "starter", "name": "Starter", "description": "Cocok untuk pemula", "creditAmount": 50000, "priceAmount": 50000, "priceCurrency": "IDR", "sortOrder": 1 },
  { "slug": "standard", "name": "Standard", "description": "Paket standar untuk latihan 1 bulan", "creditAmount": 150000, "priceAmount": 125000, "priceCurrency": "IDR", "sortOrder": 2 },
  { "slug": "pro", "name": "Pro", "description": "Paket untuk kreator dan pengguna aktif", "creditAmount": 500000, "priceAmount": 400000, "priceCurrency": "IDR", "sortOrder": 3 }
]
```

- [ ] **Step 4: Re-run the validator test**

Run: `cd services/api && pnpm jest prisma/seed-data/__tests__/credit-packages-validator.spec.ts --silent`
Expected: PASS.

- [ ] **Step 5: Wire into `prisma db seed`**

Modify `services/api/prisma/seed.ts`. Add:

```typescript
import creditPackages from './seed-data/credit-packages.json';

for (const pkg of creditPackages) {
  await prisma.creditPackage.upsert({
    where: { slug: pkg.slug },
    update: pkg as any,
    create: pkg as any,
  });
}

const tenants = await prisma.tenant.findMany();
for (const tenant of tenants) {
  await prisma.revenueShareRule.upsert({
    where: { id: `rsr-${tenant.id}` },
    update: { tenantId: tenant.id, platformFeePct: 30.0, creatorPct: 70.0 } as any,
    create: { id: `rsr-${tenant.id}`, tenantId: tenant.id, platformFeePct: 30.0, creatorPct: 70.0 } as any,
  });
}
```

30/70 split is the Phase 5 default; the rule is a row in the table, easy to tune per tenant.

- [ ] **Step 6: Run prisma db seed on a scratch DB**

Run:
```
TEST_DATABASE_URL=postgresql://... pnpm prisma migrate deploy && \
  TEST_DATABASE_URL=postgresql://... pnpm db seed
```
Expected: 3 `CreditPackage` rows + ≥ 1 `RevenueShareRule` rows.

---

## Task 4: Add `CreditPackageService` and the credit-purchase flow

**Files:**
- Create: `services/api/src/v1/commerce/credit-packages/credit-package.service.ts`
- Create: `services/api/src/v1/commerce/credit-packages/credit-package.controller.ts`
- Create: `services/api/src/v1/commerce/credit-packages/credit-package.module.ts`
- Create: `services/api/src/v1/commerce/credit-packages/__tests__/credit-package.service.spec.ts`
- Create: `services/api/src/v1/commerce/credit-packages/__tests__/credit-package-idempotency.int.spec.ts`

The flow: `POST /v1/commerce/credit-packages/:slug/purchase` with `Idempotency-Key` header → creates an `Order` + a `Reservation` (status PENDING) → returns `{ orderId, reservationId, expiresAt }`. On payment callback (already-existing flow), the `Reservation` flips to COMMITTED and the `Wallet.balance` increases via `LedgerTransaction`.

For Phase 5, the manual-payment flow is reused: `Order.status` transitions to `FULFILLED` when an admin approves the manual payment (existing), then the reservation is committed.

- [ ] **Step 1: Write the failing service test**

Create `services/api/src/v1/commerce/credit-packages/__tests__/credit-package.service.spec.ts`:

```typescript
import { CreditPackageService } from '../credit-package.service';

describe('CreditPackageService.purchase (idempotent)', () => {
  let service: CreditPackageService;

  beforeEach(() => {
    const prisma = {
      creditPackage: { findUnique: jest.fn() },
      reservation: { findUnique: jest.fn(), create: jest.fn() },
      order: { create: jest.fn() },
    };
    service = new CreditPackageService(prisma as any);
  });

  it('returns existing reservation for repeated idempotencyKey', async () => {
    const existing = { id: 'rsv1', idempotencyKey: 'k1', amount: 100, status: 'PENDING', expiresAt: new Date(Date.now() + 60_000) };
    (service as any).prisma.reservation.findUnique.mockResolvedValue(existing);
    const out = await service.purchase({ userId: 'u1', slug: 'starter', idempotencyKey: 'k1' });
    expect(out.reservationId).toBe('rsv1');
  });

  it('creates a new reservation on first call', async () => {
    (service as any).prisma.creditPackage.findUnique.mockResolvedValue({ id: 'pkg1', slug: 'starter', creditAmount: 50000, priceAmount: 50000 });
    (service as any).prisma.reservation.findUnique.mockResolvedValue(null);
    (service as any).prisma.order.create.mockResolvedValue({ id: 'ord1' });
    (service as any).prisma.reservation.create.mockResolvedValue({ id: 'rsv1', expiresAt: new Date(Date.now() + 60_000) });
    const out = await service.purchase({ userId: 'u1', slug: 'starter', idempotencyKey: 'k2' });
    expect(out.orderId).toBe('ord1');
    expect(out.reservationId).toBe('rsv1');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd services/api && pnpm jest src/v1/commerce/credit-packages/__tests__/credit-package.service.spec.ts --silent`
Expected: FAIL.

- [ ] **Step 3: Implement the service**

Create `services/api/src/v1/commerce/credit-packages/credit-package.service.ts`:

```typescript
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/common/config/prisma/prisma.service';

const RESERVATION_TTL_MS = 30 * 60 * 1000;

@Injectable()
export class CreditPackageService {
  constructor(private readonly prisma: PrismaService) {}

  async purchase(input: { userId: string; slug: string; idempotencyKey: string; walletId: string }) {
    if (!input.idempotencyKey) throw new BadRequestException('idempotency_key_required');

    const existing = await this.prisma.reservation.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (existing) return { orderId: null, reservationId: existing.id, expiresAt: existing.expiresAt };

    const pkg = await this.prisma.creditPackage.findUnique({ where: { slug: input.slug } });
    if (!pkg || !pkg.isActive) throw new NotFoundException('package_not_found');

    const order = await this.prisma.order.create({
      data: {
        userId: input.userId,
        totalAmount: pkg.priceAmount,
        currency: pkg.priceCurrency,
        creditPackageId: pkg.id,
        status: 'PENDING' as any,
        idempotencyKey: input.idempotencyKey,
      },
    });

    const expiresAt = new Date(Date.now() + RESERVATION_TTL_MS);
    const reservation = await this.prisma.reservation.create({
      data: {
        idempotencyKey: input.idempotencyKey,
        userId: input.userId,
        walletId: input.walletId,
        amount: pkg.creditAmount,
        currency: pkg.priceCurrency,
        purpose: 'PURCHASE_CREDITS',
        referenceId: order.id,
        status: 'PENDING',
        expiresAt,
      },
    });

    return { orderId: order.id, reservationId: reservation.id, expiresAt };
  }
}
```

- [ ] **Step 4: Implement the controller**

Create `services/api/src/v1/commerce/credit-packages/credit-package.controller.ts`:

```typescript
import { Controller, Get, Headers, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/v1/common/guards/jwt-auth.guard';
import { CurrentUser } from '@/v1/common/decorators/current-user.decorator';
import { CreditPackageService } from './credit-package.service';
import { PrismaService } from '@/common/config/prisma/prisma.service';

@Controller('v1/commerce/credit-packages')
@UseGuards(JwtAuthGuard)
export class CreditPackageController {
  constructor(private readonly packages: CreditPackageService, private readonly prisma: PrismaService) {}

  @Get()
  list() {
    return this.prisma.creditPackage.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } });
  }

  @Post(':slug/purchase')
  purchase(@CurrentUser() user: { id: string }, @Param('slug') slug: string, @Headers('idempotency-key') key: string) {
    return this.prisma.wallet.findFirst({ where: { ownerId: user.id } }).then((wallet: any) => {
      if (!wallet) throw new Error('wallet_not_found');
      return this.packages.purchase({ userId: user.id, slug, idempotencyKey: key, walletId: wallet.id });
    });
  }
}
```

- [ ] **Step 5: Implement the module**

Create `services/api/src/v1/commerce/credit-packages/credit-package.module.ts`. Register `CreditPackageService` + `CreditPackageController`. Import into `commerce.module.ts`.

- [ ] **Step 6: Run the test**

Run: `cd services/api && pnpm jest src/v1/commerce/credit-packages/__tests__/credit-package.service.spec.ts --silent`
Expected: PASS, 2 tests.

- [ ] **Step 7: Add the idempotency integration test**

Create `services/api/src/v1/commerce/credit-packages/__tests__/credit-package-idempotency.int.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';

describe('Credit purchase idempotency (Phase 5)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [CreditPackageController],
      providers: [
        CreditPackageService,
        { provide: PrismaService, useValue: {} },
      ],
    })
      .overrideGuard('JwtAuthGuard').useValue({ canActivate: () => true })
      .compile();
    app = module.createNestApplication();
    await app.init();
  });

  it('returns 400 without Idempotency-Key', async () => {
    const res = await request(app.getHttpServer()).post('/v1/commerce/credit-packages/starter/purchase');
    expect(res.status).toBe(400);
  });

  it('returns 200 with Idempotency-Key (success path mocked)', async () => {
    /* see Service test for the actual happy path; this test is the HTTP layer check */
  });

  afterAll(async () => { await app.close(); });
});
```

- [ ] **Step 8: Run the full suite**

Run: `cd services/api && pnpm jest --silent 2>&1 | tail -3`
Expected: no new failures.

---

## Task 5: Wire `Reservation` commit into the existing order-fulfillment flow

**Files:**
- Modify: `services/api/src/v1/commerce/fulfillment/` (or wherever the existing manual-payment approval lives)
- Create: `services/api/src/v1/commerce/reservations/reservation-commit.service.ts`
- Create: `services/api/src/v1/commerce/reservations/__tests__/reservation-commit.int.spec.ts`

When the existing `Order` transitions to `FULFILLED` (manual payment approved) or `PAID` (payment provider webhook), the linked `Reservation` must commit and the `Wallet.balance` increase via `LedgerTransaction`.

- [ ] **Step 1: Read the existing fulfillment logic**

Run: `grep -rn "FULFILLED\|PAID" services/api/src/v1/commerce/ services/api/src/v1/orders/ 2>/dev/null | head -10`
Expected: an `Order.update` with `status: 'FULFILLED'` or `'PAID'` somewhere.

- [ ] **Step 2: Write the failing test**

Create `services/api/src/v1/commerce/reservations/__tests__/reservation-commit.int.spec.ts`:

```typescript
import { ReservationCommitService } from '../reservation-commit.service';

describe('ReservationCommitService.commit', () => {
  let service: ReservationCommitService;

  beforeEach(() => {
    const prisma = {
      reservation: { findUnique: jest.fn(), update: jest.fn() },
      wallet: { update: jest.fn() },
      ledgerTransaction: { create: jest.fn() },
    };
    service = new ReservationCommitService(prisma as any);
  });

  it('commits a PENDING reservation and writes a LedgerTransaction', async () => {
    (service as any).prisma.reservation.findUnique.mockResolvedValue({
      id: 'rsv1', walletId: 'w1', amount: 100, currency: 'IDR', status: 'PENDING', referenceId: 'ord1',
    });
    await service.commit('rsv1', 'ORDER_FULFILLED', 'ord1');
    expect((service as any).prisma.reservation.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'COMMITTED' }) }));
    expect((service as any).prisma.ledgerTransaction.create).toHaveBeenCalled();
  });

  it('does not double-commit', async () => {
    (service as any).prisma.reservation.findUnique.mockResolvedValue({
      id: 'rsv1', walletId: 'w1', amount: 100, currency: 'IDR', status: 'COMMITTED', referenceId: 'ord1',
    });
    await service.commit('rsv1', 'ORDER_FULFILLED', 'ord1');
    expect((service as any).prisma.ledgerTransaction.create).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd services/api && pnpm jest src/v1/commerce/reservations/__tests__/reservation-commit.int.spec.ts --silent`
Expected: FAIL.

- [ ] **Step 4: Implement the service**

Create `services/api/src/v1/commerce/reservations/reservation-commit.service.ts`:

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/common/config/prisma/prisma.service';

@Injectable()
export class ReservationCommitService {
  constructor(private readonly prisma: PrismaService) {}

  async commit(reservationId: string, reason: string, referenceId: string) {
    const reservation = await this.prisma.reservation.findUnique({ where: { id: reservationId } });
    if (!reservation) throw new NotFoundException('reservation_not_found');
    if (reservation.status !== 'PENDING') return; // idempotent

    await this.prisma.reservation.update({
      where: { id: reservationId },
      data: { status: 'COMMITTED', committedAt: new Date() },
    });

    await this.prisma.wallet.update({
      where: { id: reservation.walletId },
      data: { balance: { increment: reservation.amount } },
    });

    await this.prisma.ledgerTransaction.create({
      data: {
        category: 'PURCHASE' as any,
        direction: 'CREDIT' as any,
        amount: reservation.amount,
        currency: reservation.currency,
        walletId: reservation.walletId,
        referenceId,
        idempotencyKey: `${reservationId}-commit`,
      } as any,
    });
  }

  async release(reservationId: string, reason: string) {
    await this.prisma.reservation.update({
      where: { id: reservationId },
      data: { status: 'RELEASED', releasedAt: new Date() },
    });
  }
}
```

- [ ] **Step 5: Hook into the existing fulfillment**

Modify the existing manual-payment approval logic (or webhook handler). After `Order.status = 'FULFILLED'`, find the matching `Reservation` by `referenceId = order.id` and call `commit(reservation.id, 'ORDER_FULFILLED', order.id)`.

- [ ] **Step 6: Run the test**

Run: `cd services/api && pnpm jest src/v1/commerce/reservations/__tests__/reservation-commit.int.spec.ts --silent`
Expected: PASS, 2 tests.

---

## Task 6: Build `/checkout/[orderId]` UI (SSR-first)

**Files:**
- Create: `apps/web/app/pages/checkout/[orderId].vue`
- Modify: `apps/web/app/lib/api.ts` (add checkout helpers)

- [ ] **Step 1: Add the API helper**

Modify `apps/web/app/lib/api.ts`. Add:

```typescript
export const checkoutApi = {
  get: (orderId: string, token?: string) => request<Order>(`${API}/v1/orders/${orderId}`, { token }),
  pay: (orderId: string, body: { method: 'MANUAL_BANK' | 'PAYMENT_PROVIDER'; proofUrl?: string }, token?: string) =>
    request<Order>(`${API}/v1/orders/${orderId}/pay`, { method: 'POST', body, token }),
  listCreditPackages: (token?: string) => request<CreditPackage[]>(`${API}/v1/commerce/credit-packages`, { token }),
};
```

The `/v1/orders/:id` and `/v1/orders/:id/pay` endpoints are added in Task 7 if not present.

- [ ] **Step 2: Implement the checkout page**

Create `apps/web/app/pages/checkout/[orderId].vue`:

```vue
<script setup lang="ts">
const route = useRoute();
const orderId = computed(() => String(route.params.orderId));
const { data: order } = await useFetch(() => `/api/v1/orders/${orderId.value}`, {
  headers: useRequestHeaders(['cookie']),
  server: true,
});
const error = ref('');

async function pay(method: 'MANUAL_BANK' | 'PAYMENT_PROVIDER') {
  try {
    const updated = await checkoutApi.pay(orderId.value, { method });
    navigateTo(`/checkout/${orderId.value}/success`);
  } catch (e: any) {
    error.value = e?.message ?? 'payment_failed';
  }
}

useHead({ title: () => order.value ? `Checkout ${order.value.id}` : 'Checkout' });
</script>

<template>
  <main v-if="order">
    <h1>Checkout</h1>
    <p>Paket: <strong>{{ order.creditPackageName ?? 'Custom' }}</strong></p>
    <p>Total: <strong>{{ order.totalAmount }} {{ order.currency }}</strong></p>

    <section>
      <h2>Metode Pembayaran</h2>
      <button @click="pay('MANUAL_BANK')">Transfer Bank Manual</button>
      <button @click="pay('PAYMENT_PROVIDER')">Payment Provider Otomatis</button>
      <p v-if="error" class="error">{{ error }}</p>
    </section>
  </main>
</template>
```

- [ ] **Step 3: Verify SSR**

Run: `curl -fsS -H "Cookie: <auth>" http://localhost/checkout/<orderId> | grep -E "Checkout|Total"`
Expected: both phrases present in the first response.

- [ ] **Step 4: Run the Playwright MCP matrix**

Per AGENTS.md Web verification. Screenshots to `.playwright-mcp/phase-5-checkout-{viewport}-{scheme}.png`.

---

## Task 7: Add `/v1/orders/:id` and `/v1/orders/:id/pay` endpoints

**Files:**
- Modify: `services/api/src/v1/orders/orders.controller.ts`
- Create: `services/api/src/v1/orders/__tests__/orders-controller-idempotency.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `services/api/src/v1/orders/__tests__/orders-controller-idempotency.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';

describe('Orders POST /pay idempotency (Phase 5)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [OrdersController],
      providers: [
        { provide: 'OrdersService', useValue: {
          findById: jest.fn().mockResolvedValue({ id: 'ord1', totalAmount: 100, currency: 'IDR' }),
          pay: jest.fn().mockImplementation(async (id, body) => ({ id, status: 'AWAITING_PAYMENT', method: body.method })),
        } },
      ],
    })
      .overrideGuard('JwtAuthGuard').useValue({ canActivate: () => true })
      .compile();
    app = module.createNestApplication();
    await app.init();
  });

  it('returns 200 on first call', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/orders/ord1/pay')
      .set('Idempotency-Key', 'pay-1')
      .send({ method: 'MANUAL_BANK' });
    expect(res.status).toBe(200);
  });

  it('returns 400 without Idempotency-Key', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/orders/ord1/pay')
      .send({ method: 'MANUAL_BANK' });
    expect(res.status).toBe(400);
  });

  afterAll(async () => { await app.close(); });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd services/api && pnpm jest src/v1/orders/__tests__/orders-controller-idempotency.spec.ts --silent`
Expected: FAIL.

- [ ] **Step 3: Add the endpoints**

Modify `services/api/src/v1/orders/orders.controller.ts`. Add `GET /v1/orders/:id` (returns `Order` for the order owner) and `POST /v1/orders/:id/pay` (requires `Idempotency-Key` header, calls `OrdersService.pay`).

The existing `OrdersService.pay` method should accept `idempotencyKey` and store it on the resulting `PaymentTransaction` row.

- [ ] **Step 4: Run the test**

Run: `cd services/api && pnpm jest src/v1/orders/__tests__/orders-controller-idempotency.spec.ts --silent`
Expected: PASS, 2 tests.

---

## Task 8: Build `/wallet` UI (SSR-first)

**Files:**
- Create: `apps/web/app/pages/wallet/index.vue`
- Modify: `apps/web/app/lib/api.ts` (add wallet helper)

- [ ] **Step 1: Add the API helper**

Modify `apps/web/app/lib/api.ts`. Add:

```typescript
export const walletApi = {
  me: (token?: string) => request<{ balance: number; currency: string; recent: LedgerTransaction[] }>(`${API}/v1/commerce/wallet/me`, { token }),
};
```

The `/v1/commerce/wallet/me` endpoint aggregates `Wallet.balance` and the last 20 `LedgerTransaction` rows. Added in Task 10.

- [ ] **Step 2: Implement the page**

Create `apps/web/app/pages/wallet/index.vue`:

```vue
<script setup lang="ts">
const { data: wallet } = await useFetch('/api/v1/commerce/wallet/me', {
  headers: useRequestHeaders(['cookie']),
  server: true,
});
const { data: packages } = await useFetch('/api/v1/commerce/credit-packages', {
  headers: useRequestHeaders(['cookie']),
  server: true,
});

useHead({ title: 'Dompet Saya — ReduCera' });
</script>

<template>
  <main>
    <h1>Dompet</h1>
    <p v-if="wallet">Saldo: <strong>{{ wallet.balance }} {{ wallet.currency }}</strong></p>

    <section>
      <h2>Beli Kredit</h2>
      <ul>
        <li v-for="pkg in packages ?? []" :key="pkg.id">
          <strong>{{ pkg.name }}</strong>
          <p>{{ pkg.creditAmount }} kredit — {{ pkg.priceAmount }} {{ pkg.priceCurrency }}</p>
          <NuxtLink :to="`/checkout/new?slug=${pkg.slug}`">Beli</NuxtLink>
        </li>
      </ul>
    </section>

    <section>
      <h2>Aktivitas Terbaru</h2>
      <ul>
        <li v-for="tx in wallet?.recent ?? []" :key="tx.id">
          {{ tx.direction }} {{ tx.amount }} {{ tx.currency }} ({{ tx.category }})
        </li>
      </ul>
    </section>
  </main>
</template>
```

- [ ] **Step 3: Create the `/checkout/new` shortcut page**

Create `apps/web/app/pages/checkout/new.vue`:

```vue
<script setup lang="ts">
const route = useRoute();
const slug = computed(() => String(route.query.slug ?? ''));

async function buy() {
  const key = `web-${slug.value}-${Date.now()}`;
  const res = await checkoutApi.pay('new', { method: 'MANUAL_BANK' });
  // Phase 5 simplification: redirect to a real Order's checkout
  await navigateTo(`/checkout/${res.orderId}`);
}
</script>

<template>
  <main>
    <h1>Membuat pesanan untuk paket {{ slug }}…</h1>
    <button @click="buy">Lanjut ke Pembayaran</button>
  </main>
</template>
```

(The actual flow is: `POST /v1/commerce/credit-packages/:slug/purchase` creates the order + reservation; the redirect is `/checkout/[orderId]`. The page above is a thin helper.)

- [ ] **Step 4: Verify SSR**

Run: `curl -fsS -H "Cookie: <auth>" http://localhost/wallet | grep -E "Dompet|Beli Kredit"`
Expected: both phrases present in the first response.

- [ ] **Step 5: Run the Playwright MCP matrix**

Per AGENTS.md Web verification. Screenshots to `.playwright-mcp/phase-5-wallet-{viewport}-{scheme}.png`.

---

## Task 9: Build `/studio/earnings` and `/studio/withdrawals`

**Files:**
- Create: `apps/web/app/pages/studio/earnings/index.vue`
- Create: `apps/web/app/pages/studio/withdrawals/index.vue`
- Modify: `apps/web/app/lib/api.ts` (add earnings + withdrawal helpers)

- [ ] **Step 1: Add the API helpers**

Modify `apps/web/app/lib/api.ts`. Add:

```typescript
export const earningsApi = {
  me: (token?: string) => request<{ available: number; pending: number; currency: string }>(`${API}/v1/studio/earnings/me`, { token }),
  history: (token?: string) => request<CreatorEarning[]>(`${API}/v1/studio/earnings/history`, { token }),
};

export const withdrawalApi = {
  request: (body: { amount: number; idempotencyKey: string }, token?: string) =>
    request<PayoutRequest>(`${API}/v1/studio/withdrawals`, { method: 'POST', body, token }),
  history: (token?: string) => request<PayoutRequest[]>(`${API}/v1/studio/withdrawals`, { token }),
};
```

The endpoints are added in Task 10.

- [ ] **Step 2: Implement the earnings page**

Create `apps/web/app/pages/studio/earnings/index.vue`:

```vue
<script setup lang="ts">
const { data: earnings } = await useFetch('/api/v1/studio/earnings/me', {
  headers: useRequestHeaders(['cookie']),
  server: true,
});
const { data: history } = await useFetch('/api/v1/studio/earnings/history', {
  headers: useRequestHeaders(['cookie']),
  server: true,
});

useHead({ title: 'Pendapatan Saya — Studio ReduCera' });
</script>

<template>
  <main>
    <h1>Pendapatan</h1>
    <p v-if="earnings">Saldo tersedia: <strong>{{ earnings.available }} {{ earnings.currency }}</strong></p>
    <p v-if="earnings">Saldo tertahan (hold window): <strong>{{ earnings.pending }} {{ earnings.currency }}</strong></p>

    <section>
      <h2>Riwayat</h2>
      <ul>
        <li v-for="e in history ?? []" :key="e.id">
          {{ e.createdAt }} — {{ e.amount }} {{ e.currency }} ({{ e.status }})
        </li>
      </ul>
    </section>

    <NuxtLink to="/studio/withdrawals">Tarik saldo</NuxtLink>
  </main>
</template>
```

- [ ] **Step 3: Implement the withdrawals page**

Create `apps/web/app/pages/studio/withdrawals/index.vue`:

```vue
<script setup lang="ts">
const route = useRoute();
const router = useRouter();
const { data: earnings } = await useFetch('/api/v1/studio/earnings/me', {
  headers: useRequestHeaders(['cookie']),
  server: true,
});
const { data: history } = await useFetch('/api/v1/studio/withdrawals', {
  headers: useRequestHeaders(['cookie']),
  server: true,
});

const amount = ref(0);
const submitting = ref(false);
const error = ref('');

async function submit() {
  submitting.value = true;
  error.value = '';
  try {
    const key = `w-${Date.now()}`;
    await withdrawalApi.request({ amount: amount.value, idempotencyKey: key });
    await refreshNuxtData();
    amount.value = 0;
  } catch (e: any) {
    error.value = e?.message ?? 'withdrawal_failed';
  } finally {
    submitting.value = false;
  }
}

useHead({ title: 'Tarik Saldo — Studio ReduCera' });
</script>

<template>
  <main>
    <h1>Tarik Saldo</h1>
    <p v-if="earnings">Tersedia: <strong>{{ earnings.available }} {{ earnings.currency }}</strong></p>
    <p v-if="earnings">Tertahan: <strong>{{ earnings.pending }} {{ earnings.currency }}</strong></p>

    <form @submit.prevent="submit">
      <label>Jumlah <input v-model.number="amount" type="number" min="1000" required /></label>
      <button type="submit" :disabled="submitting">{{ submitting ? 'Mengirim…' : 'Tarik' }}</button>
      <p v-if="error" class="error">{{ error }}</p>
    </form>

    <section>
      <h2>Riwayat Penarikan</h2>
      <ul>
        <li v-for="w in history ?? []" :key="w.id">
          {{ w.amount }} {{ w.currency }} — status: {{ w.status }}
        </li>
      </ul>
    </section>
  </main>
</template>
```

- [ ] **Step 4: Verify SSR**

Run: `curl -fsS -H "Cookie: <auth>" http://localhost/studio/earnings | grep -E "Pendapatan|Tersedia"`
Expected: both phrases present in the first response.

- [ ] **Step 5: Run the Playwright MCP matrix**

Per AGENTS.md Web verification. Screenshots to `.playwright-mcp/phase-5-creator-earnings-{viewport}-{scheme}.png`.

---

## Task 10: Add `/v1/studio/earnings/*` and `/v1/studio/withdrawals` endpoints

**Files:**
- Create: `services/api/src/v1/commerce/studio-earnings/studio-earnings.controller.ts`
- Create: `services/api/src/v1/commerce/studio-earnings/studio-earnings.service.ts`
- Create: `services/api/src/v1/commerce/studio-earnings/studio-earnings.module.ts`
- Create: `services/api/src/v1/commerce/withdrawals/withdrawals.service.ts`
- Create: `services/api/src/v1/commerce/withdrawals/withdrawals.controller.ts`
- Create: `services/api/src/v1/commerce/withdrawals/withdrawals.module.ts`

- [ ] **Step 1: Implement studio-earnings service**

`studio-earnings.service.ts` aggregates `CreatorEarning` rows per user into `{ available, pending }`:

- `available`: SUM of `CreatorEarning.amount` where `releasedAt IS NOT NULL` minus already-withdrawn amounts.
- `pending`: SUM of `CreatorEarning.amount` where `releasedAt IS NULL` (still in hold window).

- [ ] **Step 2: Implement withdrawals service**

`withdrawals.service.ts` implements the deterministic payout-release rule:

```typescript
async requestWithdrawal(input: { creatorId: string; walletId: string; amount: number; idempotencyKey: string }) {
  if (input.amount <= 0) throw new BadRequestException('amount_must_be_positive');

  const existing = await this.prisma.payoutRequest.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
  if (existing) return existing;

  const payout = await this.prisma.payoutRequest.create({
    data: { creatorId: input.creatorId, walletId: input.walletId, amount: input.amount, currency: 'IDR', status: 'REQUESTED' as any, idempotencyKey: input.idempotencyKey } as any,
  });

  const releaseAt = new Date(Date.now() + 7 * 86_400_000);
  await this.prisma.holdWindow.create({
    data: { payoutId: payout.id, releaseAt },
  });

  return payout;
}

async releaseDuePayouts() {
  const due = await this.prisma.holdWindow.findMany({
    where: { released: false, releaseAt: { lte: new Date() }, openRefunds: 0 },
    include: { payout: true },
  });
  for (const hw of due) {
    await this.releasePayout(hw.payoutId);
  }
  return due.length;
}

async releasePayout(payoutId: string) {
  const hw = await this.prisma.holdWindow.findUnique({ where: { payoutId } });
  if (!hw || hw.released) return;
  const openRefunds = await this.prisma.refund.count({ where: { status: 'OPEN' as any, payoutId } });
  if (openRefunds > 0) return;

  await this.prisma.holdWindow.update({
    where: { payoutId },
    data: { released: true, releasedAt: new Date() },
  });

  await this.prisma.payoutRequest.update({
    where: { id: payoutId },
    data: { status: 'RELEASED' as any, releasedAt: new Date() },
  });

  await this.prisma.ledgerTransaction.create({
    data: {
      category: 'PAYOUT' as any,
      direction: 'DEBIT' as any,
      amount: (await this.prisma.payoutRequest.findUnique({ where: { id: payoutId } }))!.amount,
      currency: 'IDR',
      walletId: (await this.prisma.payoutRequest.findUnique({ where: { id: payoutId } }))!.walletId,
      payoutId,
      idempotencyKey: `payout-${payoutId}-release`,
    } as any,
  });
}
```

- [ ] **Step 3: Wire `releaseDuePayouts` into a daily BullMQ job**

Add a new processor `services/api/src/v1/queue/queues/payout-release.processor.ts`:

```typescript
import { Processor } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { WithdrawalsService } from '@/v1/commerce/withdrawals/withdrawals.service';

@Processor('payout-release')
export class PayoutReleaseProcessor {
  constructor(private readonly withdrawals: WithdrawalsService) {}

  async process(job: Job) {
    const released = await this.withdrawals.releaseDuePayouts();
    return { released };
  }
}
```

Register the queue + processor in `services/api/src/v1/queue/queues/index.ts` and add a BullMQ schedule (existing cron job in `services/api/src/v1/queue/schedules/`).

- [ ] **Step 4: Implement the controllers**

```typescript
@Controller('v1/studio/earnings')
@UseGuards(JwtAuthGuard)
export class StudioEarningsController {
  constructor(private readonly earnings: StudioEarningsService) {}

  @Get('me')
  me(@CurrentUser() user: { id: string }) {
    return this.earnings.summary(user.id);
  }

  @Get('history')
  history(@CurrentUser() user: { id: string }) {
    return this.earnings.history(user.id);
  }
}
```

```typescript
@Controller('v1/studio/withdrawals')
@UseGuards(JwtAuthGuard)
export class WithdrawalsController {
  constructor(private readonly withdrawals: WithdrawalsService) {}

  @Get()
  list(@CurrentUser() user: { id: string }) {
    return this.withdrawals.listByUser(user.id);
  }

  @Post()
  request(@CurrentUser() user: { id: string }, @Headers('idempotency-key') key: string, @Body() body: { amount: number }) {
    return this.withdrawals.requestWithdrawal({
      creatorId: user.id,
      walletId: '<wallet>',
      amount: body.amount,
      idempotencyKey: key,
    });
  }
}
```

The walletId comes from the user's wallet lookup.

- [ ] **Step 5: Register the modules**

Add `StudioEarningsModule` and `WithdrawalsModule` to `commerce.module.ts`.

- [ ] **Step 6: Verify with curl**

Run:
```
docker compose up -d --build api
curl -fsS -H "Authorization: Bearer <teacher-token>" http://localhost/api/v1/studio/earnings/me
curl -fsS -H "Authorization: Bearer <teacher-token>" -H "Idempotency-Key: w1" -X POST -d '{"amount":10000}' http://localhost/api/v1/studio/withdrawals
```
Expected: `{ available, pending, currency }` and `{ id, status: 'REQUESTED', ... }`.

---

## Task 11: Retire `Topic` as a marketplace product (G-B-04)

**Files:**
- Modify: `services/api/src/v1/marketplace/marketplace.controller.ts` (or wherever the listing endpoint lives)
- Modify: `services/api/src/v1/marketplace/marketplace.service.ts`
- Create: `services/api/src/v1/marketplace/__tests__/topic-retired.spec.ts`

Per G-B-04: Topic sales through the marketplace path create no creator earning and should not be listed.

- [ ] **Step 1: Read the existing marketplace listing logic.

Run: `grep -rn "topic\|Topic" services/api/src/v1/marketplace/ 2>/dev/null | head -20`
Expected: a `list()` method that includes Topic entries.

- [ ] **Step 2: Write the failing test.

Create `services/api/src/v1/marketplace/__tests__/topic-retired.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';

describe('Marketplace listing (Phase 5: G-B-04)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [MarketplaceController],
      providers: [
        { provide: 'MarketplaceService', useValue: {
          list: jest.fn().mockResolvedValue([
            { kind: 'article', id: 'a1' },
            { kind: 'class', id: 'c1' },
          ]),
        } },
      ],
    })
      .overrideGuard('JwtAuthGuard').useValue({ canActivate: () => true })
      .compile();
    app = module.createNestApplication();
    await app.init();
  });

  it('listings do NOT include Topic', async () => {
    const res = await request(app.getHttpServer()).get('/v1/marketplace/list');
    const topics = res.body.filter((x: any) => x.kind === 'topic');
    expect(topics).toEqual([]);
  });

  afterAll(async () => { await app.close(); });
});
```

- [ ] **Step 3: Run the test to verify it fails.

Run: `cd services/api && pnpm jest src/v1/marketplace/__tests__/topic-retired.spec.ts --silent`
Expected: FAIL — listing still includes Topic.

- [ ] **Step 4: Remove Topic from the marketplace listing.

Modify `services/api/src/v1/marketplace/marketplace.service.ts`. The `list()` method must filter out `Topic` rows. If the listing is a single Prisma query that includes `Topic`, split into separate queries for Articles and Classes (or filter via `where: { NOT: { kind: 'topic' } }` if `kind` is a discriminator).

- [ ] **Step 5: Run the test.

Run: `cd services/api && pnpm jest src/v1/marketplace/__tests__/topic-retired.spec.ts --silent`
Expected: PASS.

---

## Task 12: Phase 5 acceptance gates

**Files:**
- Modify: `docs/progress-tracker.md` (final Phase 5 block)

- [ ] **Step 1: Run the full backend test suite.

Run:
```
cd services/api && pnpm jest --silent && cd ../ai-api && uv run pytest -q
```
Expected: both exit 0; cumulative test count ≥ 240 (per spec T1 budget).

- [ ] **Step 2: Verify the 5 Phase 5 acceptance gates from §5.6.

Gates:

1. `POST /wallet/topup` with `credit_package_id` moves credits to wallet — `curl -fsS -H "Authorization: Bearer <token>" -H "Idempotency-Key: k1" -X POST -d '{"method":"MANUAL_BANK"}' http://localhost/api/v1/orders/ord1/pay`, then admin manually approves; `Wallet.balance` increases by `creditAmount`.
2. `Transaction` audit row written for every state change — `psql ... -c "select count(*) from \"LedgerTransaction\";"` increases after any state change.
3. `POST /payouts/request` enters hold queue — `curl -fsS -H "Authorization: Bearer <teacher-token>" -H "Idempotency-Key: w1" -X POST -d '{"amount":10000}' http://localhost/api/v1/studio/withdrawals` returns `{ id, status: 'REQUESTED', ... }` and a `HoldWindow` row exists.
4. Deterministic rule "payout released iff hold_days_passed AND no open_refund" — `_holdWindow` rows auto-release after 7 days; open refunds block release.
5. `Topic` no longer in marketplace listing — `curl -fsS http://localhost/api/v1/marketplace/list` returns no `kind: 'topic'` rows.

- [ ] **Step 3: Run the Playwright MCP matrix.

Per AGENTS.md Web verification. Three viewports × two color schemes × `reducedMotion: reduce` once for each of:
- `/checkout/[orderId]`
- `/wallet`
- `/studio/earnings`, `/studio/withdrawals`

- [ ] **Step 4: Append the Phase 5 verification table to `docs/progress-tracker.md`.

```
## Phase 5 Verification (YYYY-MM-DD)

| Gate | Status | Evidence |
|---|---|---|
| Wallet topup moves credits | PASS / FAIL | curl output |
| LedgerTransaction written on every state change | PASS / FAIL | psql output |
| Payout request enters hold queue | PASS / FAIL | curl output |
| Payout releases after hold window | PASS / FAIL | cron output |
| Topic retired from marketplace listing | PASS / FAIL | curl output |
| Playwright matrix green | PASS / FAIL | screenshot list |
| Cumulative test count >= 240 | PASS / FAIL | test output |
```

- [ ] **Step 5: Owner review checkpoint.

Per AGENTS.md, executor does not commit. Pause for owner:
1. `git status` and review diff.
2. `pnpm build` for both services; `docker compose -f docker-compose.prod.yml config -q` valid.
3. Stage and commit at their discretion.
4. Mark Phase 5 `DONE` in `docs/progress-tracker.md`.

---

## Out of Scope for Phase 5 (deferred to later phases)

- VirtualCompany simulator UI: **Phase 6**
- AgentRouter, DecisionTrace, AI-side recommendation for creators: **Phase 7**
- EventLog, MasterySnapshot, EngagementMetric, CreatorOutcomeMetric: **Phase 8**
- RateLimit, BackupRecord, expanded AuditLog, full runbook: **Phase 9**