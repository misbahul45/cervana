import { randomUUID } from 'crypto';
import { AiCreditsService } from '../ai-credits.service';
import { AICreditEntryType } from '@prisma/client';

function buildPrismaStub(initial: {
  wallet?: { balance: number; reserved: number; lifetimeEarned: number; lifetimePurchased: number; lifetimeSpent: number };
  ledger?: Array<{ id: string; amount: number; type: AICreditEntryType; userId: string; balanceAfter: number; sourceType: string; idempotencyKey: string; metadata?: Record<string, unknown> }>;
} = {}) {
  type Tx = {
    aICreditWallet: {
      findUnique: (args: unknown) => Promise<unknown>;
      findUniqueOrThrow: (args: unknown) => Promise<unknown>;
      create: (args: unknown) => Promise<unknown>;
      update: (args: unknown) => Promise<unknown>;
    };
    aICreditLedgerEntry: {
      findUnique: (args: unknown) => Promise<unknown>;
      findMany: (args: unknown) => Promise<unknown>;
      create: (args: unknown) => Promise<unknown>;
      update: (args: unknown) => Promise<unknown>;
    };
  };

  const txStore = {
    wallet: initial.wallet
      ? { ...initial.wallet }
      : { balance: 100, reserved: 0, lifetimeEarned: 0, lifetimePurchased: 0, lifetimeSpent: 0 },
    ledger: [...(initial.ledger ?? [])],
  };

  const walletApi: Tx['aICreditWallet'] = {
    findUnique: jest.fn(async ({ where }: { where: { userId: string } }) => {
      return { id: `wallet-${where.userId}`, userId: where.userId, ...txStore.wallet };
    }),
    findUniqueOrThrow: jest.fn(async ({ where }: { where: { userId: string } }) => {
      return { id: `wallet-${where.userId}`, userId: where.userId, ...txStore.wallet };
    }),
    create: jest.fn(async ({ data }: { data: { userId: string } }) => {
      txStore.wallet = { ...txStore.wallet };
      return { id: `wallet-${data.userId}`, userId: data.userId, ...txStore.wallet };
    }),
    update: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
      txStore.wallet = { ...txStore.wallet };
      if (typeof data.balance === 'number') txStore.wallet.balance = data.balance;
      if (data.reserved && typeof (data.reserved as { increment?: number }).increment === 'number') {
        txStore.wallet.reserved += (data.reserved as { increment: number }).increment!;
      }
      if (data.reserved && typeof (data.reserved as { decrement?: number }).decrement === 'number') {
        txStore.wallet.reserved -= (data.reserved as { decrement: number }).decrement!;
      }
      if (data.lifetimeSpent && typeof (data.lifetimeSpent as { increment?: number }).increment === 'number') {
        txStore.wallet.lifetimeSpent += (data.lifetimeSpent as { increment: number }).increment!;
      }
      if (data.lifetimePurchased && typeof (data.lifetimePurchased as { increment?: number }).increment === 'number') {
        txStore.wallet.lifetimePurchased += (data.lifetimePurchased as { increment: number }).increment!;
      }
      if (data.lifetimeEarned && typeof (data.lifetimeEarned as { increment?: number }).increment === 'number') {
        txStore.wallet.lifetimeEarned += (data.lifetimeEarned as { increment: number }).increment!;
      }
      return { id: `wallet-${data.balance}`, userId: '', ...txStore.wallet };
    }),
  };

  const ledgerApi: Tx['aICreditLedgerEntry'] = {
    findUnique: jest.fn(async ({ where }: { where: { id?: string } }) => {
      return txStore.ledger.find((e) => e.id === where.id) ?? null;
    }),
    findMany: jest.fn(async () => txStore.ledger.slice()),
    create: jest.fn(async ({ data }: { data: { userId: string; type: AICreditEntryType; amount: number; balanceAfter: number; sourceType: string; idempotencyKey: string; metadata?: Record<string, unknown> } }) => {
      const entry = {
        id: randomUUID(),
        metadata: {},
        ...data,
      };
      txStore.ledger.unshift(entry);
      return entry;
    }),
    update: jest.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
      const idx = txStore.ledger.findIndex((e) => e.id === where.id);
      if (idx === -1) return null;
      const existing = txStore.ledger[idx]!;
      const merged = { ...existing, ...data, metadata: { ...(existing.metadata ?? {}), ...(data.metadata as Record<string, unknown> ?? {}) } };
      txStore.ledger[idx] = merged;
      return merged;
    }),
  };

  const tx: Tx = { aICreditWallet: walletApi, aICreditLedgerEntry: ledgerApi };
  const prisma = {
    $transaction: jest.fn(async (fn: (tx: Tx) => unknown) => fn(tx)),
    aICreditWallet: walletApi,
    aICreditLedgerEntry: ledgerApi,
  };

  return { prisma: prisma as never, txStore };
}

describe('AiCreditsService', () => {
  describe('AC-197 reserve / settle / release lifecycle', () => {
    it('reserve decrements available balance and increments reserved', async () => {
      const { prisma } = buildPrismaStub({ wallet: { balance: 100, reserved: 0, lifetimeEarned: 0, lifetimePurchased: 0, lifetimeSpent: 0 } });
      const service = new AiCreditsService(prisma);
      const out = await service.reserve({
        userId: 'u1',
        amount: 30,
        sourceType: 'tutor-message',
        operationId: 'op-1',
      });
      expect(out.ok).toBe(true);
    });

    it('reserve rejects when balance insufficient', async () => {
      const { prisma } = buildPrismaStub({ wallet: { balance: 10, reserved: 0, lifetimeEarned: 0, lifetimePurchased: 0, lifetimeSpent: 0 } });
      const service = new AiCreditsService(prisma);
      const out = await service.reserve({
        userId: 'u1',
        amount: 30,
        sourceType: 'tutor-message',
        operationId: 'op-2',
      });
      expect(out.ok).toBe(false);
      if (!out.ok) expect(out.available).toBe(10);
    });

    it('settle deducts reserved + spent correctly with refund', async () => {
      const { prisma, txStore } = buildPrismaStub({ wallet: { balance: 100, reserved: 50, lifetimeEarned: 0, lifetimePurchased: 0, lifetimeSpent: 0 } });
      txStore.ledger.unshift({
        id: 'res-1',
        userId: 'u1',
        type: AICreditEntryType.SPEND,
        amount: 30,
        balanceAfter: 100,
        sourceType: 'tutor',
        idempotencyKey: 'reserve:op-1',
      });
      const service = new AiCreditsService(prisma);
      await service.settle({
        userId: 'u1',
        reservationId: 'res-1',
        actualAmount: 22,
      });
      expect(txStore.wallet.balance).toBe(78);
      expect(txStore.wallet.reserved).toBe(20);
      expect(txStore.wallet.lifetimeSpent).toBe(22);
      expect(txStore.ledger.find((e) => e.idempotencyKey.startsWith('refund:'))).toBeDefined();
    });

    it('release frees reserved credits without spending', async () => {
      const { prisma, txStore } = buildPrismaStub({ wallet: { balance: 100, reserved: 30, lifetimeEarned: 0, lifetimePurchased: 0, lifetimeSpent: 0 } });
      txStore.ledger.unshift({
        id: 'res-2',
        userId: 'u1',
        type: AICreditEntryType.SPEND,
        amount: 30,
        balanceAfter: 100,
        sourceType: 'tutor',
        idempotencyKey: 'reserve:op-3',
      });
      const service = new AiCreditsService(prisma);
      await service.release('res-2', 'circuit-open');
      expect(txStore.wallet.balance).toBe(100);
      expect(txStore.wallet.reserved).toBe(0);
      expect(txStore.wallet.lifetimeSpent).toBe(0);
    });
  });

  describe('AC-197 idempotency', () => {
    it('rejects amount <= 0', async () => {
      const { prisma } = buildPrismaStub();
      const service = new AiCreditsService(prisma);
      await expect(
        service.reserve({ userId: 'u1', amount: 0, sourceType: 'x', operationId: 'op' }),
      ).rejects.toThrow();
    });
  });

  describe('topUp', () => {
    const emptyWallet = { balance: 0, reserved: 0, lifetimeEarned: 0, lifetimePurchased: 0, lifetimeSpent: 0 };

    it('increments balance + lifetimePurchased on PURCHASE', async () => {
      const { prisma, txStore } = buildPrismaStub({ wallet: emptyWallet });
      const service = new AiCreditsService(prisma);
      await service.topUp({
        userId: 'u1',
        amount: 50,
        sourceType: 'PURCHASE',
        idempotencyKey: 'top-1',
      });
      expect(txStore.wallet.balance).toBe(50);
      expect(txStore.wallet.lifetimePurchased).toBe(50);
      expect(txStore.wallet.lifetimeEarned).toBe(0);
    });

    it('increments lifetimeEarned on EARN (no purchase)', async () => {
      const { prisma, txStore } = buildPrismaStub({ wallet: emptyWallet });
      const service = new AiCreditsService(prisma);
      await service.topUp({
        userId: 'u1',
        amount: 10,
        sourceType: 'EARN',
        idempotencyKey: 'top-2',
      });
      expect(txStore.wallet.lifetimeEarned).toBe(10);
      expect(txStore.wallet.lifetimePurchased).toBe(0);
    });
  });

  describe('getBalance lazy-creates wallet', () => {
    it('returns zeros for new user and creates wallet', async () => {
      const { prisma } = buildPrismaStub({
        wallet: { balance: 0, reserved: 0, lifetimeEarned: 0, lifetimePurchased: 0, lifetimeSpent: 0 },
      });
      const service = new AiCreditsService(prisma);
      const out = await service.getBalance('u-new');
      expect(out.balance).toBe(0);
      expect(out.available).toBe(0);
    });
  });
});
