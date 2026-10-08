import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { CreditPackageService } from '../credit-package.service';

const PACKAGE = { id: 'pkg1', slug: 'starter', creditAmount: 50000, priceAmount: 50000, priceCurrency: 'IDR', isActive: true };

const buildService = () => {
  const tx = {
    order: { create: jest.fn() },
    reservation: { create: jest.fn() },
  };
  const prisma = {
    creditPackage: { findUnique: jest.fn() },
    reservation: { findUnique: jest.fn() },
    $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
  };
  return { service: new CreditPackageService(prisma as any), prisma, tx };
};

const input = (overrides: Partial<{ userId: string; idempotencyKey: string }> = {}) => ({
  userId: 'u1',
  slug: 'starter',
  idempotencyKey: 'k1-0000-0000',
  walletId: 'w1',
  ...overrides,
});

describe('CreditPackageService.purchase', () => {
  it('replays the original order for the same user and key', async () => {
    const { service, prisma, tx } = buildService();
    const expiresAt = new Date(Date.now() + 60_000);
    prisma.reservation.findUnique.mockResolvedValue({ id: 'rsv1', userId: 'u1', referenceId: 'ord1', expiresAt });

    const out = await service.purchase(input());

    expect(out).toEqual({ orderId: 'ord1', reservationId: 'rsv1', expiresAt, deduplicated: true });
    expect(tx.order.create).not.toHaveBeenCalled();
  });

  it('refuses a key that already belongs to another user without leaking it', async () => {
    const { service, prisma } = buildService();
    prisma.reservation.findUnique.mockResolvedValue({ id: 'rsv1', userId: 'someone-else', referenceId: 'ord9', expiresAt: new Date() });

    await expect(service.purchase(input())).rejects.toBeInstanceOf(ConflictException);
  });

  it('creates the order and the reservation inside one transaction', async () => {
    const { service, prisma, tx } = buildService();
    const expiresAt = new Date(Date.now() + 60_000);
    prisma.reservation.findUnique.mockResolvedValue(null);
    prisma.creditPackage.findUnique.mockResolvedValue(PACKAGE);
    tx.order.create.mockResolvedValue({ id: 'ord1' });
    tx.reservation.create.mockResolvedValue({ id: 'rsv1', expiresAt });

    const out = await service.purchase(input({ idempotencyKey: 'k2-0000-0000' }));

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(out).toEqual({ orderId: 'ord1', reservationId: 'rsv1', expiresAt, deduplicated: false });
    expect(tx.reservation.create.mock.calls[0][0].data).toMatchObject({
      userId: 'u1',
      referenceId: 'ord1',
      idempotencyKey: 'k2-0000-0000',
    });
  });

  it('collapses a concurrent duplicate into a replay instead of failing', async () => {
    const { service, prisma } = buildService();
    const expiresAt = new Date(Date.now() + 60_000);
    prisma.reservation.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'rsv1', userId: 'u1', referenceId: 'ord1', expiresAt });
    prisma.creditPackage.findUnique.mockResolvedValue(PACKAGE);
    prisma.$transaction.mockRejectedValue(Object.assign(new Error('Unique constraint failed'), { code: 'P2002' }));

    const out = await service.purchase(input());

    expect(out).toEqual({ orderId: 'ord1', reservationId: 'rsv1', expiresAt, deduplicated: true });
  });

  it('rethrows unexpected database errors', async () => {
    const { service, prisma } = buildService();
    prisma.reservation.findUnique.mockResolvedValue(null);
    prisma.creditPackage.findUnique.mockResolvedValue(PACKAGE);
    prisma.$transaction.mockRejectedValue(new Error('connection lost'));

    await expect(service.purchase(input())).rejects.toThrow('connection lost');
  });

  it('rejects a missing idempotency key', async () => {
    const { service } = buildService();

    await expect(service.purchase(input({ idempotencyKey: '' }))).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an unknown or inactive package', async () => {
    const { service, prisma } = buildService();
    prisma.reservation.findUnique.mockResolvedValue(null);
    prisma.creditPackage.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ ...PACKAGE, isActive: false });

    await expect(service.purchase(input())).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.purchase(input())).rejects.toBeInstanceOf(NotFoundException);
  });
});
