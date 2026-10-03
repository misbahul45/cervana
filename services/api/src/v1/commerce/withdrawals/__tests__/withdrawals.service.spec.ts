import { WithdrawalsService } from '../withdrawals.service';

describe('WithdrawalsService.requestWithdrawal (deterministic hold rule)', () => {
  let service: WithdrawalsService;

  beforeEach(() => {
    const prisma = {
      payoutRequest: { findFirst: jest.fn(), create: jest.fn() },
      holdWindow: { create: jest.fn() },
    };
    service = new WithdrawalsService(prisma as any);
  });

  it('rejects non-positive amounts', async () => {
    await expect(
      service.requestWithdrawal({ creatorId: 'u1', walletId: 'w1', amount: 0 }),
    ).rejects.toThrow('amount_must_be_positive');
  });

  it('creates a payout with a 7-day hold window', async () => {
    (service as any).prisma.payoutRequest.findFirst.mockResolvedValue(null);
    (service as any).prisma.payoutRequest.create.mockResolvedValue({ id: 'p1' });

    const result = await service.requestWithdrawal({
      creatorId: 'u1',
      walletId: 'w1',
      amount: 100,
    });
    expect(result.payout.id).toBe('p1');
    expect(result.deduplicated).toBe(false);
    expect((service as any).prisma.holdWindow.create).toHaveBeenCalled();
  });

  it('returns the existing payout on duplicate idempotencyKey', async () => {
    (service as any).prisma.payoutRequest.findFirst.mockResolvedValue({ id: 'p1' });
    const result = await service.requestWithdrawal({
      creatorId: 'u1',
      walletId: 'w1',
      amount: 100,
      idempotencyKey: 'k1',
    });
    expect(result.deduplicated).toBe(true);
    expect(result.payout.id).toBe('p1');
    expect((service as any).prisma.payoutRequest.create).not.toHaveBeenCalled();
  });
});