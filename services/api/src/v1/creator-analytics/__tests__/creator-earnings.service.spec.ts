import { EarningStatus } from '@prisma/client';
import { CreatorAnalyticsService } from '../creator-analytics.service';

type EarningRow = {
  id: string;
  creatorId: string;
  creatorAmount: { toString: () => string };
  currency: string;
  status: EarningStatus;
  orderItemId: string;
  createdAt: Date;
};

function money(value: number) {
  return { toString: () => String(value) };
}

function row(overrides: Partial<EarningRow> & { id: string }): EarningRow {
  return {
    creatorId: 'creator-1',
    creatorAmount: money(0),
    currency: 'IDR',
    status: EarningStatus.PENDING,
    orderItemId: `item-${overrides.id}`,
    createdAt: new Date('2026-09-30T10:00:00Z'),
    ...overrides,
  };
}

function buildPrisma(all: EarningRow[]) {
  const matches = (
    e: EarningRow,
    where: { creatorId?: string; status?: { in?: EarningStatus[]; not?: EarningStatus } },
  ) => {
    if (where.creatorId && e.creatorId !== where.creatorId) return false;
    if (where.status?.in && !where.status.in.includes(e.status)) return false;
    if (where.status?.not && e.status === where.status.not) return false;
    return true;
  };
  const aggregate = jest.fn(async ({ where }: { where: Parameters<typeof matches>[1] }) => {
    const sum = all
      .filter((e) => matches(e, where))
      .reduce((s, e) => s + Number(e.creatorAmount.toString()), 0);
    return { _sum: { creatorAmount: sum } };
  });
  const findMany = jest.fn(async ({ where }: { where: Parameters<typeof matches>[1] }) =>
    all.filter((e) => matches(e, where)),
  );
  return {
    prisma: { creatorEarning: { aggregate, findMany } } as never,
    aggregate,
    findMany,
  };
}

describe('CreatorAnalyticsService earnings', () => {
  it('separates pending payout from lifetime earnings', async () => {
    const { prisma } = buildPrisma([
      row({ id: 'e1', creatorAmount: money(50000), status: EarningStatus.PENDING }),
      row({ id: 'e2', creatorAmount: money(30000), status: EarningStatus.AVAILABLE }),
      row({ id: 'e3', creatorAmount: money(75000), status: EarningStatus.PAID_OUT }),
    ]);
    const out = await new CreatorAnalyticsService(prisma).getCreatorEarnings('creator-1');
    expect(out.pendingPayout).toBe(80000);
    expect(out.lifetimeEarnings).toBe(155000);
    expect(out.recent).toHaveLength(3);
  });

  it('excludes reversed earnings from totals but still lists them', async () => {
    const { prisma } = buildPrisma([
      row({ id: 'e1', creatorAmount: money(100000), status: EarningStatus.PAID_OUT }),
      row({ id: 'e2', creatorAmount: money(40000), status: EarningStatus.REVERSED }),
    ]);
    const out = await new CreatorAnalyticsService(prisma).getCreatorEarnings('creator-1');
    expect(out.lifetimeEarnings).toBe(100000);
    expect(out.totalEarned).toBe(100000);
    expect(out.pendingPayout).toBe(0);
    expect(out.recent.map((r) => r.id)).toEqual(['e1', 'e2']);
  });

  it('only counts earnings owned by the requested creator', async () => {
    const { prisma, aggregate, findMany } = buildPrisma([
      row({ id: 'e1', creatorId: 'creator-1', creatorAmount: money(10000) }),
      row({ id: 'e2', creatorId: 'someone-else', creatorAmount: money(999999) }),
    ]);
    const out = await new CreatorAnalyticsService(prisma).getCreatorEarnings('creator-1');
    expect(out.lifetimeEarnings).toBe(10000);
    expect(out.recent.map((r) => r.id)).toEqual(['e1']);
    for (const call of [...aggregate.mock.calls, ...findMany.mock.calls]) {
      expect(call[0].where.creatorId).toBe('creator-1');
    }
  });

  it('returns zeros when the creator has no earnings', async () => {
    const { prisma } = buildPrisma([]);
    const out = await new CreatorAnalyticsService(prisma).getCreatorEarnings('creator-new');
    expect(out).toEqual({ pendingPayout: 0, lifetimeEarnings: 0, totalEarned: 0, recent: [] });
  });

  it('maps a row with the order item as source and the paid-out flag', async () => {
    const { prisma } = buildPrisma([
      row({ id: 'e1', creatorAmount: money(100), orderItemId: 'item-A', status: EarningStatus.PAID_OUT }),
    ]);
    const out = await new CreatorAnalyticsService(prisma).getCreatorEarnings('creator-1');
    expect(out.recent[0]).toMatchObject({
      source: 'item-A',
      amount: 100,
      currency: 'IDR',
      paidOut: true,
    });
  });
});
