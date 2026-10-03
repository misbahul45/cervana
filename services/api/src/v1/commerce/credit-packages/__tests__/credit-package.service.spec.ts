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
    const out = await service.purchase({ userId: 'u1', slug: 'starter', idempotencyKey: 'k1', walletId: 'w1' });
    expect(out.reservationId).toBe('rsv1');
    expect(out.deduplicated).toBe(true);
  });

  it('creates a new reservation on first call', async () => {
    (service as any).prisma.creditPackage.findUnique.mockResolvedValue({ id: 'pkg1', slug: 'starter', creditAmount: 50000, priceAmount: 50000, isActive: true });
    (service as any).prisma.reservation.findUnique.mockResolvedValue(null);
    (service as any).prisma.order.create.mockResolvedValue({ id: 'ord1' });
    (service as any).prisma.reservation.create.mockResolvedValue({ id: 'rsv1', expiresAt: new Date(Date.now() + 60_000) });
    const out = await service.purchase({ userId: 'u1', slug: 'starter', idempotencyKey: 'k2', walletId: 'w1' });
    expect(out.orderId).toBe('ord1');
    expect(out.reservationId).toBe('rsv1');
    expect(out.deduplicated).toBe(false);
  });

  it('rejects missing idempotencyKey', async () => {
    await expect(
      service.purchase({ userId: 'u1', slug: 'starter', idempotencyKey: '', walletId: 'w1' }),
    ).rejects.toThrow('idempotency_key_required');
  });

  it('throws when package not found', async () => {
    (service as any).prisma.reservation.findUnique.mockResolvedValue(null);
    (service as any).prisma.creditPackage.findUnique.mockResolvedValue(null);
    await expect(
      service.purchase({ userId: 'u1', slug: 'nope', idempotencyKey: 'k1', walletId: 'w1' }),
    ).rejects.toThrow('package_not_found');
  });
});