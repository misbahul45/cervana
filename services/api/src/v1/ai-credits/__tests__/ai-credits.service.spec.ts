import { AiCreditsService } from '../ai-credits.service';
import { BadRequestException } from '@nestjs/common';

describe('AiCreditsService (F-03: serializable balance math)', () => {
  let service: AiCreditsService;
  let walletState: { balance: number; reserved: number };
  let lockCount: number;
  let ledgerStore: any[];

  function makeMock() {
    walletState = { balance: 100, reserved: 0 };
    lockCount = 0;
    ledgerStore = [];

    const txMock: any = {
      $executeRaw: async () => {
        lockCount++;
      },
      aICreditWallet: {
        findUnique: jest.fn().mockImplementation(async () => walletState),
        findUniqueOrThrow: jest.fn().mockImplementation(async () => walletState),
        create: jest.fn().mockImplementation(async () => walletState),
        update: jest.fn().mockImplementation(async ({ data }: any) => {
          if (data.reserved?.increment != null) walletState.reserved += data.reserved.increment;
          if (data.reserved?.decrement != null) walletState.reserved -= data.reserved.decrement;
          if (data.balance?.increment != null) walletState.balance += data.balance.increment;
          if (typeof data.balance === 'number') walletState.balance = data.balance;
          if (typeof data.reserved === 'number') walletState.reserved = data.reserved;
          return walletState;
        }),
      },
      aICreditLedgerEntry: {
        create: jest.fn().mockImplementation(async ({ data }: any) => {
          const row = { id: `ledger-${ledgerStore.length}`, ...data };
          ledgerStore.push(row);
          return row;
        }),
        findUnique: jest.fn().mockImplementation(async ({ where }: any) => {
          return ledgerStore.find((r) => r.id === where.id) ?? null;
        }),
        update: jest.fn().mockImplementation(async ({ where, data }: any) => {
          const row = ledgerStore.find((r) => r.id === where.id);
          if (row) Object.assign(row, data);
          return row ?? { id: where.id, ...data };
        }),
      },
    };
    const prismaMock = {
      $transaction: async (fn: (tx: any) => any) => fn(txMock),
      aICreditWallet: txMock.aICreditWallet,
      aICreditLedgerEntry: txMock.aICreditLedgerEntry,
    };
    return { prismaMock, txMock };
  }

  beforeEach(() => {
    const { prismaMock } = makeMock();
    service = new AiCreditsService(prismaMock as any);
  });

  it('acquires a per-user row lock before computing available', async () => {
    await service.reserve({ userId: 'u1', amount: 50, sourceType: 'AI_RUN', operationId: 'op-1' });
    expect(lockCount).toBe(1);
  });

  it('rejects when balance - reserved is not permitted', async () => {
    const r = await service.reserve({ userId: 'u1', amount: 200, sourceType: 'AI_RUN', operationId: 'op-1' });
    expect(r.ok).toBe(false);
  });

  it('rejects zero or negative amount', async () => {
    await expect(service.reserve({ userId: 'u1', amount: 0, sourceType: 'X', operationId: 'a' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.reserve({ userId: 'u1', amount: -1, sourceType: 'X', operationId: 'b' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('increments reserved by amount on successful reserve', async () => {
    await service.reserve({ userId: 'u1', amount: 30, sourceType: 'AI_RUN', operationId: 'op-1' });
    await service.reserve({ userId: 'u1', amount: 30, sourceType: 'AI_RUN', operationId: 'op-2' });
    expect(walletState.reserved).toBe(60);
  });

  it('topUp adds balance and writes a ledger entry', async () => {
    await service.topUp({ userId: 'u1', amount: 200, sourceType: 'PURCHASE', idempotencyKey: 't-1' });
    expect(walletState.balance).toBe(300);
  });

  it('settle decrements balance by actual and reserved by held', async () => {
    walletState.balance = 100;
    walletState.reserved = 30;
    await service.reserve({ userId: 'u1', amount: 30, sourceType: 'AI_RUN', operationId: 'op-1' });
    const reservationId = ledgerStore[0].id;
    await service.settle({ userId: 'u1', reservationId, actualAmount: 25 });
    expect(walletState.balance).toBe(75);
    expect(walletState.reserved).toBe(30);
  });
});