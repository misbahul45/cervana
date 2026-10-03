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
      id: 'rsv1',
      walletId: 'w1',
      amount: 100,
      currency: 'IDR',
      status: 'PENDING',
      referenceId: 'ord1',
    });
    const result = await service.commit('rsv1', 'ORDER_FULFILLED', 'ord1');
    expect(result.deduplicated).toBe(false);
    expect((service as any).prisma.reservation.update).toHaveBeenCalled();
    expect((service as any).prisma.ledgerTransaction.create).toHaveBeenCalled();
  });

  it('does not double-commit', async () => {
    (service as any).prisma.reservation.findUnique.mockResolvedValue({
      id: 'rsv1',
      walletId: 'w1',
      amount: 100,
      currency: 'IDR',
      status: 'COMMITTED',
      referenceId: 'ord1',
    });
    const result = await service.commit('rsv1', 'ORDER_FULFILLED', 'ord1');
    expect(result.deduplicated).toBe(true);
    expect((service as any).prisma.ledgerTransaction.create).not.toHaveBeenCalled();
  });
});