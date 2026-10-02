import { LeaderboardsRepo } from '@/v1/gamify/leaderboards/leaderboards.repo';
import { LeaderboardScope } from '@prisma/client';

describe('leaderboard-cohort (Phase 0)', () => {
  let repo: LeaderboardsRepo;
  let prisma: { leaderboardScore: { findFirst: jest.Mock; update: jest.Mock; create: jest.Mock } };
  let emitter: { leaderboardUpdated: jest.Mock; leaderboardDeleted: jest.Mock };

  beforeEach(() => {
    prisma = {
      leaderboardScore: {
        findFirst: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
      },
    };
    emitter = {
      leaderboardUpdated: jest.fn(),
      leaderboardDeleted: jest.fn(),
    };
    repo = new LeaderboardsRepo(prisma as any, emitter as any);
  });

  it('isolates scores across leaderboard scopes (GLOBAL vs CATEGORY)', async () => {
    prisma.leaderboardScore.findFirst
      .mockResolvedValueOnce({ id: 'lb-global', userId: 'u-1', scope: LeaderboardScope.GLOBAL, score: 100 })
      .mockResolvedValueOnce(null);
    prisma.leaderboardScore.update.mockResolvedValue({ id: 'lb-global', score: 110 });
    prisma.leaderboardScore.create.mockResolvedValue({ id: 'lb-cat', score: 10 });

    await repo.incrementScore('u-1', LeaderboardScope.GLOBAL, 10);
    await repo.incrementScore('u-1', LeaderboardScope.CATEGORY, 10);

    expect(prisma.leaderboardScore.update).toHaveBeenCalledWith({
      where: { id: 'lb-global' },
      data: { score: { increment: 10 } },
    });
    expect(prisma.leaderboardScore.create).toHaveBeenCalledWith({
      data: { userId: 'u-1', scope: LeaderboardScope.CATEGORY, score: 10 },
    });
  });

  it('does not leak GLOBAL scores into a CATEGORY query', async () => {
    prisma.leaderboardScore.findFirst.mockImplementation(async ({ where }) => {
      if (where.scope === LeaderboardScope.CATEGORY) return null;
      return { id: 'lb-global', userId: 'u-1', scope: LeaderboardScope.GLOBAL, score: 100 };
    });

    await repo.incrementScore('u-1', LeaderboardScope.CATEGORY, 5);

    expect(prisma.leaderboardScore.findFirst).toHaveBeenCalledWith({
      where: { userId: 'u-1', scope: LeaderboardScope.CATEGORY },
    });
    expect(prisma.leaderboardScore.update).not.toHaveBeenCalled();
    expect(prisma.leaderboardScore.create).toHaveBeenCalledWith({
      data: { userId: 'u-1', scope: LeaderboardScope.CATEGORY, score: 5 },
    });
  });
});