import { AdminAnalyticsController } from '../admin-analytics.controller';

describe('AdminAnalyticsController top concepts', () => {
  it('ranks concepts by learners with evidence, with titles and the average score', async () => {
    const prisma = {
      conceptMastery: {
        groupBy: jest.fn().mockResolvedValue([
          { conceptId: 'c2', _count: { _all: 5 }, _avg: { score: 0.61 } },
          { conceptId: 'c1', _count: { _all: 3 }, _avg: { score: null } },
        ]),
      },
      concept: { findMany: jest.fn().mockResolvedValue([{ id: 'c1', title: 'Title 1' }, { id: 'c2', title: 'Title 2' }]) },
    };
    const controller = new AdminAnalyticsController(prisma as never);

    const result = await controller.topConcepts();

    expect(prisma.conceptMastery.groupBy).toHaveBeenCalledWith({
      by: ['conceptId'],
      where: { evidenceCount: { gt: 0 }, concept: { status: 'ACTIVE' } },
      _count: { _all: true },
      _avg: { score: true },
      orderBy: { _count: { conceptId: 'desc' } },
      take: 10,
    });
    expect(result).toEqual([
      { conceptId: 'c2', title: 'Title 2', learners: 5, avgScore: 0.61 },
      { conceptId: 'c1', title: 'Title 1', learners: 3, avgScore: 0 },
    ]);
  });

  it('has no legacy top-topics reader left', () => {
    expect((AdminAnalyticsController.prototype as unknown as Record<string, unknown>).topTopics).toBeUndefined();
  });
});
