import { StudioEarningsService } from '../studio-earnings.service';

describe('StudioEarningsService.summarize (deterministic)', () => {
  let service: StudioEarningsService;

  beforeEach(() => {
    const prisma = {
      creatorEarning: { findMany: jest.fn() },
    };
    service = new StudioEarningsService(prisma as any);
  });

  it('returns zeros when no earnings', async () => {
    (service as any).prisma.creatorEarning.findMany.mockResolvedValue([]);
    const out = await service.summarize('u1');
    expect(out).toEqual({ available: 0, pending: 0, currency: 'IDR' });
  });

  it('sums released vs pending', async () => {
    (service as any).prisma.creatorEarning.findMany.mockResolvedValue([
      { creatorAmount: 100, currency: 'IDR', releasedAt: new Date() },
      { creatorAmount: 50, currency: 'IDR', releasedAt: null },
      { creatorAmount: 25, currency: 'IDR', releasedAt: new Date() },
    ]);
    const out = await service.summarize('u1');
    expect(out.available).toBe(125);
    expect(out.pending).toBe(50);
  });
});